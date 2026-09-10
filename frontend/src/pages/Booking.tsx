import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/PlayerAvatar";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, Clock, Minus, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SlotType = "tee_time" | "training";
type TrainingType = "individual" | "on_course";
type TrainerTier = "coach" | "pro";

type Slot = {
  id: number;
  type: SlotType;
  date: string;
  time: string;
  durationMinutes: number;
  capacity: number;
  trainerName: string | null;
  notes: string | null;
  startHole: number | null;
  holesCount: number | null;
  trainingType: TrainingType | null;
  trainerTier: TrainerTier | null;
  priceFrom: number | null;
  trainerPhotoUrl: string | null;
  trainerBio: string | null;
  available: number;
  bookedByMe: boolean;
};

type MyBooking = {
  bookingId: number;
  slotId: number;
  type: SlotType;
  date: string;
  time: string;
  durationMinutes: number;
  trainerName: string | null;
  notes: string | null;
  playersCount: number;
};

type Coach = {
  name: string;
  tier: TrainerTier | null;
  priceFrom: number | null;
  notes: string | null;
  photoUrl: string | null;
  bio: string | null;
  slots: Slot[];
};

const DAYS_AHEAD = 14;
const EXIT_MS = 200;

function buildDateStrip() {
  const days: { iso: string; label: string; weekday: string }[] = [];
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      iso,
      label: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      weekday: d.toLocaleDateString("ru-RU", { weekday: "short" }).toUpperCase(),
    });
  }
  return days;
}

const BookingPage = () => {
  const navigate = useNavigate();
  const days = useMemo(buildDateStrip, []);
  const [tab, setTab] = useState<SlotType>("tee_time");
  const [selectedDate, setSelectedDate] = useState(days[0].iso);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [playersCount, setPlayersCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [leavingBookingIds, setLeavingBookingIds] = useState<Set<number>>(new Set());

  // Tee-time filters
  const [startHole, setStartHole] = useState<1 | 10>(1);
  const [holesCount, setHolesCount] = useState<9 | 18>(18);

  // Training filters
  const [trainingFormat, setTrainingFormat] = useState<TrainingType>("individual");
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);

  const loadSlots = () => {
    setSlots(null);
    api
      .get<Slot[]>(`/api/booking/slots?type=${tab}&date=${selectedDate}`)
      .then(setSlots)
      .catch(() => setSlots([]));
  };

  const loadMyBookings = () => {
    api.get<MyBooking[]>("/api/booking/my").then(setMyBookings).catch(() => {});
  };

  useEffect(loadSlots, [tab, selectedDate]);
  useEffect(loadMyBookings, []);

  // Tee-time slots matching the selected start hole / holes count. A slot
  // with no value set (generated before this filter existed) matches any
  // selection rather than disappearing.
  const teeSlots = useMemo(() => {
    if (!slots) return null;
    return slots.filter(
      (s) =>
        (s.startHole == null || s.startHole === startHole) &&
        (s.holesCount == null || s.holesCount === holesCount)
    );
  }, [slots, startHole, holesCount]);

  // Training slots grouped into coaches, one card per trainer name.
  const coaches = useMemo<Coach[]>(() => {
    if (!slots) return [];
    const byName = new Map<string, Coach>();
    slots
      .filter((s) => s.trainingType == null || s.trainingType === trainingFormat)
      .forEach((s) => {
        const name = s.trainerName ?? "Тренер";
        const entry = byName.get(name) ?? { name, tier: s.trainerTier, priceFrom: s.priceFrom, notes: s.notes, photoUrl: s.trainerPhotoUrl, bio: s.trainerBio, slots: [] };
        entry.slots.push(s);
        if (s.priceFrom != null && (entry.priceFrom == null || s.priceFrom < entry.priceFrom)) entry.priceFrom = s.priceFrom;
        byName.set(name, entry);
      });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [slots, trainingFormat]);

  useEffect(() => {
    if (coaches.length === 0) { setSelectedCoach(null); return; }
    if (!coaches.find((c) => c.name === selectedCoach)) setSelectedCoach(coaches[0].name);
  }, [coaches]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCoach = coaches.find((c) => c.name === selectedCoach) ?? null;

  const openBooking = (slot: Slot) => {
    setPlayersCount(1);
    setBookingSlot(slot);
  };

  const confirmBooking = async () => {
    if (!bookingSlot) return;
    setSubmitting(true);
    try {
      const updated = await api.post<Slot & { bookingId: number; playersCount: number }>(
        `/api/booking/slots/${bookingSlot.id}/book`,
        { playersCount }
      );
      toast.success("Записаны!");
      setBookingSlot(null);

      // Update the slot in place (no full-list reload/flash) and let the new
      // booking animate into "Мои записи" instead of popping in on refetch.
      setSlots((prev) => prev?.map((s) => (s.id === updated.id
        ? { ...s, available: updated.available, bookedByMe: updated.bookedByMe }
        : s)) ?? prev);
      setMyBookings((prev) => [
        ...prev,
        {
          bookingId: updated.bookingId,
          slotId: updated.id,
          type: updated.type,
          date: updated.date,
          time: updated.time,
          durationMinutes: updated.durationMinutes,
          trainerName: updated.trainerName,
          notes: updated.notes,
          playersCount: updated.playersCount,
        },
      ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось записаться");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelBooking = (booking: MyBooking) => {
    // Play the exit animation first, then actually remove/cancel once it's
    // finished — an instant unmount would just make the row vanish.
    setLeavingBookingIds((prev) => new Set(prev).add(booking.bookingId));
    setTimeout(async () => {
      try {
        await api.delete(`/api/booking/bookings/${booking.bookingId}`);
        setMyBookings((prev) => prev.filter((b) => b.bookingId !== booking.bookingId));
        setSlots((prev) => prev?.map((s) => (s.id === booking.slotId
          ? { ...s, bookedByMe: false, available: s.available + booking.playersCount }
          : s)) ?? prev);
        toast.success("Запись отменена");
      } catch {
        toast.error("Не удалось отменить запись");
      } finally {
        setLeavingBookingIds((prev) => {
          const next = new Set(prev);
          next.delete(booking.bookingId);
          return next;
        });
      }
    }, EXIT_MS);
  };

  const timeSlots = tab === "tee_time" ? teeSlots : activeCoach?.slots ?? [];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={() => navigate("/round")} className="flex items-center gap-1 text-action font-bold text-lg">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Букинг
      </button>

      {myBookings.length > 0 && (
        <Card className="p-4 space-y-2 animate-in fade-in duration-300">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Мои записи</div>
          {myBookings.map((b) => (
            <div
              key={b.bookingId}
              className={cn(
                "flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50",
                leavingBookingIds.has(b.bookingId)
                  ? "animate-out fade-out slide-out-to-right-4 duration-200 fill-mode-forwards"
                  : "animate-in fade-in slide-in-from-top-1 duration-300"
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {b.type === "tee_time" ? "Ти-тайм" : "Тренировка"} · {new Date(`${b.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в {b.time}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.type === "tee_time" ? `${b.playersCount} игрок(ов)` : b.trainerName}
                </div>
              </div>
              <button onClick={() => cancelBooking(b)} className="text-destructive shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      <div className="flex rounded-full p-1 gap-1 bg-muted">
        <button
          onClick={() => setTab("tee_time")}
          className="flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-all"
          style={tab === "tee_time" ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
        >
          Ти-таймы
        </button>
        <button
          onClick={() => setTab("training")}
          className="flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-all"
          style={tab === "training" ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
        >
          Тренировки
        </button>
      </div>

      {tab === "tee_time" ? (
        <Card className="p-4 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Старт</div>
            <div className="flex gap-2">
              {([1, 10] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setStartHole(h)}
                  className="flex-1 h-10 rounded-xl text-xs font-bold transition-all"
                  style={startHole === h ? { background: "#15361f", color: "#f3ede1" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  С {h}-й лунки
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Лунки</div>
            <div className="flex gap-1 p-1 rounded-xl bg-muted">
              {([18, 9] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setHolesCount(n)}
                  className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                  style={holesCount === n ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
                >
                  {n} лунок
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Формат</div>
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            <button
              onClick={() => setTrainingFormat("individual")}
              className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
              style={trainingFormat === "individual" ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
            >
              Индивидуальная
            </button>
            <button
              onClick={() => setTrainingFormat("on_course")}
              className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
              style={trainingFormat === "on_course" ? { background: "#c9a24b", color: "#15361f" } : { color: "hsl(var(--muted-foreground))" }}
            >
              Игра с тренером
            </button>
          </div>

          {slots !== null && coaches.length > 0 && (
            <div className="space-y-2 pt-1">
              {coaches.map((c) => {
                const active = c.name === selectedCoach;
                return (
                  <button
                    key={c.name}
                    onClick={() => setSelectedCoach(c.name)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    )}
                    style={active ? { borderColor: "#15361f" } : { borderColor: "hsl(var(--border))" }}
                  >
                    <Avatar name={c.name} tone={active ? "orange" : "muted"} photoUrl={c.photoUrl ?? undefined} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold text-sm truncate">{c.name}</div>
                        {c.tier === "pro" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#15361f", color: "#f3ede1" }}>ПРО</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(c.bio?.split("\n")[0] ?? (c.tier === "pro" ? "Golf Pro" : "Тренер"))}
                        {c.notes ? ` · ${c.notes}` : ""}
                        {c.priceFrom ? ` · от ${c.priceFrom} BYN` : ""}
                      </div>
                    </div>
                    {active && (
                      <div className="h-6 w-6 rounded-full grid place-items-center shrink-0" style={{ background: "#15361f" }}>
                        <Check className="h-3.5 w-3.5" style={{ color: "#f3ede1" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => setSelectedDate(d.iso)}
            className="shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all"
            style={selectedDate === d.iso
              ? { borderColor: "#15361f", background: "var(--accent-tint)" }
              : { borderColor: "transparent", background: "hsl(var(--muted))" }}
          >
            <div className="text-[9px] font-bold uppercase text-muted-foreground">{d.weekday}</div>
            <div className="text-sm font-bold">{d.label}</div>
          </button>
        ))}
      </div>

      {slots === null ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
        </div>
      ) : tab === "training" && coaches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">На этот день нет запланированных тренировок</Card>
      ) : timeSlots.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {tab === "tee_time" ? "На этот день нет открытых ти-таймов с такими параметрами" : "У этого тренера нет свободного времени в этот день"}
        </Card>
      ) : (
        <div className="space-y-2">
          {timeSlots.map((s) => {
            const full = s.available <= 0 && !s.bookedByMe;
            return (
              <Card key={s.id} className="p-3.5 flex items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--accent-tint)" }}>
                    <Clock className="h-5 w-5" style={{ color: "#15361f" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{s.time}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.type === "training" ? (s.notes ?? "Индивидуальная тренировка") : `${s.available} из ${s.capacity} мест`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openBooking(s)}
                  disabled={full || s.bookedByMe}
                  className="h-9 px-4 rounded-full font-bold text-xs shrink-0 disabled:opacity-50"
                  style={s.bookedByMe
                    ? { background: "var(--accent-tint)", color: "#15361f" }
                    : { background: "#c9a24b", color: "#15361f" }}
                >
                  {s.bookedByMe ? "Записан" : full ? "Нет мест" : "Записаться"}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/40" onClick={() => setBookingSlot(null)} />
          <div className="relative w-full animate-in slide-in-from-bottom duration-250 bg-card border-t rounded-t-3xl" style={{ borderColor: "#c9a24b", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1 bg-border" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <div className="font-display font-semibold text-foreground">
                  {bookingSlot.type === "tee_time" ? "Ти-тайм" : "Тренировка"} в {bookingSlot.time}
                </div>
                {bookingSlot.type === "tee_time" ? (
                  <div className="text-muted-foreground text-xs">
                    Старт с {bookingSlot.startHole ?? 1}-й лунки · {bookingSlot.holesCount ?? 18} лунок
                  </div>
                ) : bookingSlot.trainerName && (
                  <div className="text-muted-foreground text-xs">Тренер: {bookingSlot.trainerName}</div>
                )}
              </div>
              <button onClick={() => setBookingSlot(null)} className="h-9 w-9 rounded-full grid place-items-center border border-border">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2 space-y-4">
              {bookingSlot.type === "tee_time" && (
                <div>
                  <div className="gm-eyebrow mb-2 text-muted-foreground">Количество игроков</div>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => setPlayersCount((n) => Math.max(1, n - 1))}
                      className="h-11 w-11 rounded-full grid place-items-center border border-border"
                    >
                      <Minus className="h-4 w-4 text-foreground" />
                    </button>
                    <div className="font-display text-3xl font-bold text-foreground tabular-nums w-10 text-center">{playersCount}</div>
                    <button
                      onClick={() => setPlayersCount((n) => Math.min(bookingSlot.available, n + 1))}
                      className="h-11 w-11 rounded-full grid place-items-center border border-border"
                    >
                      <Plus className="h-4 w-4 text-foreground" />
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={confirmBooking}
                disabled={submitting}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform disabled:opacity-40 bg-action text-action-foreground"
              >
                {submitting ? "Записываю…" : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingPage;
