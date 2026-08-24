import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useGolf, type Round, type CustomTournament } from "@/store/golfStore";
import { getFormat } from "@/lib/formats";
import { compressImage } from "@/lib/imageUtils";
import { api } from "@/lib/api";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ShareRoundModal } from "@/components/ShareRoundModal";
import { toast } from "sonner";
import {
  ChevronLeft, QrCode, Plus, PlayCircle, Settings, Camera, X,
  Trophy, Users, ClipboardList, Lock, CalendarClock, Trash2,
} from "lucide-react";

type Tab = "live" | "schedule" | "results" | "participants" | "registrations";

type TournamentOption = { id: number; name: string; date: string; slug: string | null };
type RegistrationSummary = {
  id: string; name: string; date: string;
  total: number; pending: number; awaiting: number; paid: number;
};

type LiveEntry = { tournament: CustomTournament; round: Round | null; isActive: boolean };

type ScheduleSlotType = "tee_time" | "training";
type ScheduleSlot = {
  id: number;
  type: ScheduleSlotType;
  date: string;
  time: string;
  durationMinutes: number;
  capacity: number;
  trainerName: string | null;
  notes: string | null;
  bookings: { playersCount: number; name: string }[];
};

const tabs: { id: Tab; label: string; icon: typeof QrCode }[] = [
  { id: "live", label: "Live", icon: QrCode },
  { id: "schedule", label: "Расписание", icon: CalendarClock },
  { id: "results", label: "Результаты", icon: Trophy },
  { id: "participants", label: "Участники", icon: Users },
  { id: "registrations", label: "Заявки", icon: ClipboardList },
];

const AdminPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("live");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-action border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <button onClick={() => navigate("/tournaments")} className="flex items-center gap-1 text-action font-bold text-lg">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Назад
        </button>
        <Card className="p-8 text-center space-y-2">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="font-bold">Нет доступа</div>
          <div className="text-sm text-muted-foreground">Эта страница доступна только администратору клуба</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={() => navigate("/tournaments")} className="flex items-center gap-1 text-action font-bold text-lg">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> Админ-панель
      </button>

      <div className="flex rounded-full p-1 gap-1 bg-muted overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
            style={tab === id ? { background: "#22c55e", color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "live" && <LiveToolsTab />}
      {tab === "schedule" && <ScheduleTab />}
      {tab === "results" && (
        <PhotoImportPanel
          title="Ввести результаты турнира"
          hint="Фото таблицы с местами и счётом — бот распознает всех игроков"
          fields={[
            { key: "place", label: "Место", numeric: true },
            { key: "name", label: "Имя" },
            { key: "score", label: "Счёт", numeric: true },
            { key: "group", label: "Группа" },
          ]}
          keyName="results"
          parseUrl={(id) => `/api/admin/tournaments/${id}/results/parse`}
          saveUrl={(id) => `/api/admin/tournaments/${id}/results/save`}
        />
      )}
      {tab === "participants" && (
        <PhotoImportPanel
          title="Ввести участников турнира"
          hint="Фото флайта/списка участников — имя, гандикап, контакты"
          fields={[
            { key: "name", label: "Имя" },
            { key: "handicap", label: "HCP", numeric: true },
            { key: "phone", label: "Телефон" },
            { key: "email", label: "Email" },
          ]}
          keyName="participants"
          parseUrl={(id) => `/api/admin/tournaments/${id}/participants/parse`}
          saveUrl={(id) => `/api/admin/tournaments/${id}/participants/save`}
          includeImageOnSave
        />
      )}
      {tab === "registrations" && <RegistrationsTab />}
    </div>
  );
};

/* ── Live tools: QR / share for your quick tournaments ── */
const LiveToolsTab = () => {
  const navigate = useNavigate();
  const { customTournaments, rounds, activeRound } = useGolf();
  const [shareRoundId, setShareRoundId] = useState<string | null>(null);

  const entries: LiveEntry[] = useMemo(() => {
    return [...customTournaments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((tournament) => {
        const isActive = activeRound?.tournamentId === tournament.id;
        const round = isActive ? activeRound : rounds.find((r) => r.tournamentId === tournament.id) ?? null;
        return { tournament, round, isActive };
      });
  }, [customTournaments, rounds, activeRound]);

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-action/15 grid place-items-center mx-auto">
          <Settings className="h-6 w-6 text-action" />
        </div>
        <div className="text-muted-foreground text-sm">Вы ещё не создавали турниры</div>
        <button
          onClick={() => navigate("/create-tournament")}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl font-bold text-sm"
          style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Создать турнир
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(({ tournament, round, isActive }) => {
        const fmt = getFormat(tournament.format);
        return (
          <Card key={tournament.id} className="p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{fmt.emoji}</span>
                  <div className="font-bold text-sm truncate">{tournament.name}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tournament.month} {tournament.date} · {round?.courseName ?? "—"}
                </div>
                <div className="mt-2">
                  {isActive && !round?.completed ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
                      В игре
                    </span>
                  ) : round?.completed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">Завершён</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">Нет раунда</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => round && setShareRoundId(round.id)}
                  disabled={!round}
                  className="h-9 w-9 rounded-full grid place-items-center disabled:opacity-30"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.3)" }}
                  title="QR для участников"
                >
                  <QrCode className="h-4 w-4" style={{ color: "#22c55e" }} />
                </button>
                {isActive && (
                  <button
                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-action"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Продолжить
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {shareRoundId && (
        <ShareRoundModal roundId={shareRoundId} onClose={() => setShareRoundId(null)} />
      )}
    </div>
  );
};

/* ── Schedule: generate tee times, create trainings, manage slots ── */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ScheduleTab = () => {
  const [subTab, setSubTab] = useState<ScheduleSlotType>("tee_time");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [intervalMinutes, setIntervalMinutes] = useState("10");
  const [teeCapacity, setTeeCapacity] = useState("4");
  const [generating, setGenerating] = useState(false);

  const [trainingTime, setTrainingTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [trainerName, setTrainerName] = useState("");
  const [trainingCapacity, setTrainingCapacity] = useState("1");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const loadSlots = () => {
    setSlots(null);
    api
      .get<ScheduleSlot[]>(`/api/admin/schedule/slots?type=${subTab}&date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]));
  };

  useEffect(loadSlots, [subTab, date]);

  const generateTeeTimes = async () => {
    setGenerating(true);
    try {
      const data = await api.post<{ created: number }>("/api/admin/schedule/tee-times/generate", {
        date, startTime, endTime, intervalMinutes: Number(intervalMinutes), capacity: Number(teeCapacity),
      });
      toast.success(`Создано слотов: ${data.created}`);
      loadSlots();
    } catch {
      toast.error("Ошибка создания ти-таймов");
    } finally {
      setGenerating(false);
    }
  };

  const createTraining = async () => {
    if (!trainerName.trim()) { toast.error("Укажите тренера"); return; }
    setCreating(true);
    try {
      await api.post("/api/admin/schedule/trainings", {
        date, time: trainingTime, durationMinutes: Number(duration),
        trainerName: trainerName.trim(), capacity: Number(trainingCapacity),
        notes: notes.trim() || undefined,
      });
      toast.success("Тренировка создана");
      setTrainerName("");
      setNotes("");
      loadSlots();
    } catch {
      toast.error("Ошибка создания тренировки");
    } finally {
      setCreating(false);
    }
  };

  const deleteSlot = async (slot: ScheduleSlot) => {
    if (slot.bookings.length > 0 && !window.confirm(`На это время уже записаны: ${slot.bookings.map(b => b.name).join(", ")}. Удалить и уведомить их?`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/schedule/slots/${slot.id}`);
      toast.success("Слот удалён");
      loadSlots();
    } catch {
      toast.error("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex rounded-full p-1 gap-1 bg-muted">
        <button
          onClick={() => setSubTab("tee_time")}
          className="flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-all"
          style={subTab === "tee_time" ? { background: "#22c55e", color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
        >
          Ти-таймы
        </button>
        <button
          onClick={() => setSubTab("training")}
          className="flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-all"
          style={subTab === "training" ? { background: "#22c55e", color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
        >
          Тренировки
        </button>
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full h-11 rounded-xl px-3 bg-muted text-sm outline-none"
      />

      {subTab === "tee_time" ? (
        <Card className="p-4 space-y-3">
          <div className="font-bold text-sm">Сгенерировать ти-таймы на день</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Начало
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">
              Конец
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">
              Интервал, мин
              <input type="number" min={5} value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">
              Мест на слот
              <input type="number" min={1} value={teeCapacity} onChange={(e) => setTeeCapacity(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
          </div>
          <button
            onClick={generateTeeTimes}
            disabled={generating}
            className="w-full h-11 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: "#22c55e", color: "#000" }}
          >
            {generating ? "Создаю…" : "Сгенерировать"}
          </button>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          <div className="font-bold text-sm">Создать тренировку</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Время
              <input type="time" value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">
              Длительность, мин
              <input type="number" min={10} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
            </label>
          </div>
          <label className="text-xs text-muted-foreground block">
            Тренер
            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder="Имя тренера" className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
          </label>
          <label className="text-xs text-muted-foreground block">
            Мест
            <input type="number" min={1} value={trainingCapacity} onChange={(e) => setTrainingCapacity(e.target.value)} className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
          </label>
          <label className="text-xs text-muted-foreground block">
            Заметка (необязательно)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Например: групповая тренировка" className="w-full h-10 rounded-lg px-2 mt-1 bg-background border border-border text-sm" />
          </label>
          <button
            onClick={createTraining}
            disabled={creating}
            className="w-full h-11 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: "#22c55e", color: "#000" }}
          >
            {creating ? "Создаю…" : "Создать"}
          </button>
        </Card>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Слоты на {new Date(`${date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
        {slots === null ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Нет слотов на этот день</Card>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => {
              const bookedCount = s.bookings.reduce((a, b) => a + b.playersCount, 0);
              return (
                <Card key={s.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{s.time} {s.trainerName ? `· ${s.trainerName}` : ""}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {bookedCount}/{s.capacity} занято
                      {s.bookings.length > 0 && ` — ${s.bookings.map((b) => b.name).join(", ")}`}
                    </div>
                  </div>
                  <button onClick={() => deleteSlot(s)} className="text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Generic photo → AI parse → editable preview → save ── */
type ImportField = { key: string; label: string; numeric?: boolean };

const PhotoImportPanel = ({
  title,
  hint,
  fields,
  keyName,
  parseUrl,
  saveUrl,
  includeImageOnSave,
}: {
  title: string;
  hint: string;
  fields: ImportField[];
  keyName: string;
  parseUrl: (tournamentId: number) => string;
  saveUrl: (tournamentId: number) => string;
  includeImageOnSave?: boolean;
}) => {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<TournamentOption[]>("/api/admin/tournaments").then(setTournaments).catch(() => {});
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImage(compressed);
    setRows([]);
    e.target.value = "";
  };

  const parse = async () => {
    if (!tournamentId || !image) return;
    setParsing(true);
    try {
      const data = await api.post<Record<string, Record<string, string | number>[]>>(
        parseUrl(Number(tournamentId)),
        { image }
      );
      const parsed = data[keyName] ?? [];
      setRows(parsed);
      if (parsed.length === 0) toast.error("Не удалось распознать фото");
    } catch {
      toast.error("Ошибка распознавания");
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (idx: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () => setRows((prev) => [...prev, Object.fromEntries(fields.map((f) => [f.key, ""]))]);

  const save = async () => {
    if (!tournamentId || rows.length === 0) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { [keyName]: rows };
      if (includeImageOnSave && image) body.image = image;
      const data = await api.post<{ saved: number }>(saveUrl(Number(tournamentId)), body);
      toast.success(`Сохранено: ${data.saved}`);
      setRows([]);
      setImage(null);
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>

      <select
        value={tournamentId}
        onChange={(e) => setTournamentId(e.target.value)}
        className="w-full h-11 rounded-xl px-3 bg-muted text-sm outline-none"
      >
        <option value="">Выберите турнир…</option>
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({new Date(t.date).toLocaleDateString("ru-RU")})
          </option>
        ))}
      </select>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full h-11 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground flex items-center justify-center gap-2"
      >
        <Camera className="h-4 w-4" /> {image ? "Фото загружено — заменить" : "Загрузить фото"}
      </button>

      {image && rows.length === 0 && (
        <button
          onClick={parse}
          disabled={!tournamentId || parsing}
          className="w-full h-11 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{ background: "#22c55e", color: "#000" }}
        >
          {parsing ? "Распознаю…" : "Распознать"}
        </button>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-muted/50">
              {fields.map((f) => (
                <input
                  key={f.key}
                  value={row[f.key] ?? ""}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                  inputMode={f.numeric ? "decimal" : "text"}
                  className="h-9 rounded-lg px-2 text-xs bg-background border border-border flex-1 min-w-[70px]"
                />
              ))}
              <button onClick={() => removeRow(idx)} className="text-destructive shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button onClick={addRow} className="text-xs text-action font-semibold flex items-center gap-1">
            <Plus className="h-3 w-3" /> Добавить строку
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-11 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: "#22c55e", color: "#000" }}
          >
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      )}
    </Card>
  );
};

/* ── Registrations overview ── */
const RegistrationsTab = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<RegistrationSummary[] | null>(null);

  useEffect(() => {
    api.get<RegistrationSummary[]>("/api/admin/registrations").then(setItems).catch(() => setItems([]));
  }, []);

  if (items === null) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Нет активных заявок на турниры</Card>;
  }

  return (
    <div className="space-y-3">
      {items.map((t) => (
        <Card
          key={t.id}
          onClick={() => navigate(`/tournament-registrations/${t.id}`)}
          className="p-4 shadow-soft cursor-pointer hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(t.date).toLocaleDateString("ru-RU")} · {t.total} заявок
              </div>
              <div className="flex gap-2 mt-1.5 text-[10px] font-bold uppercase tracking-wide">
                {t.pending > 0 && <span className="text-yellow-600">{t.pending} на рассмотрении</span>}
                {t.awaiting > 0 && <span className="text-orange-600">{t.awaiting} ждут оплаты</span>}
                {t.paid > 0 && <span className="text-green-600">{t.paid} оплачено</span>}
              </div>
            </div>
            <div className="text-action text-2xl shrink-0">›</div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AdminPage;
