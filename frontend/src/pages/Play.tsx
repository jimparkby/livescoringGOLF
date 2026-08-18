import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/PlayerAvatar";
import { COURSES, TEE_CONFIG, type TeeColor, getAllCourses, getCustomCourses, saveCustomCourse, type Course } from "@/lib/courses";
import { useGolf, type Player, type Round, type HolesMode } from "@/store/golfStore";
import { calcCourseHcpForMode, holeRankInSet, holeStrokesInSet } from "@/lib/handicap";
import { compressImage } from "@/lib/imageUtils";
import { api, BASE } from "@/lib/api";
import { ChevronLeft, ChevronRight, Plus, X, PlayCircle, Flag, Camera, Check, Search, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useIsMobile } from "@/hooks/use-mobile";
import heroImg from "@/assets/golfminsk/hero.jpg";
import photo1 from "@/assets/golfminsk/photo1.jpg";
import photo2 from "@/assets/golfminsk/photo2.jpg";

type Step = "home" | "setup" | "playing";

const PlayPage = () => {
  // ── All hooks must come before any conditional returns ────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('confirm')
  );
  const { profile, frequent, activeRound, startRound, cancelActiveRound, rounds } = useGolf();
  const [step, setStep] = useState<Step>(activeRound ? "playing" : "home");
  const initialHadRound = useRef(!!activeRound);

  const sendPregameInsight = (currentCourse?: { id: string; name: string }) => {
    const token = localStorage.getItem("golf_jwt");
    if (!token) return;
    const completedRounds = rounds.filter(r => r.completed);
    const trimmedRounds = completedRounds.slice(0, 10).map(r => ({
      date: r.date, scores: r.scores, tee: r.tee, rating: r.rating, slope: r.slope, holesMode: r.holesMode, courseId: r.courseId, courseName: r.courseName,
    }));
    fetch(`${BASE}/api/ai/pregame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        rounds: trimmedRounds,
        profile: { hcp: profile.hcp, firstName: profile.firstName },
        currentCourse,
      }),
    }).catch(() => {});
  };
  const [courseId, setCourseId] = useState<string>(COURSES[0].id);
  const [extraCourses, setExtraCourses] = useState<Course[]>(() => getCustomCourses());

  const allCourses = [...COURSES, ...extraCourses];

  const addExtraCourse = (course: Course) => {
    saveCustomCourse(course);
    setExtraCourses(getCustomCourses());
  };

  const [players, setPlayers] = useState<Player[]>([
    { id: "me", name: `${profile.firstName} ${profile.lastName}`, initials: profile.initials, hcp: profile.hcp, tee: profile.defaultTee ?? "yellow", isMe: true },
  ]);

  useEffect(() => {
    if (confirmId) window.history.replaceState({}, '', window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When activeRound loads from DB (localStorage was cleared by Telegram), auto-navigate
  useEffect(() => {
    if (activeRound && step === "home" && !initialHadRound.current) {
      setStep("playing");
    }
  }, [activeRound]);

  const course = allCourses.find((c) => c.id === courseId) ?? COURSES[0];

  // ── Conditional renders (after all hooks) ────────────────────────────────
  if (confirmId) {
    return (
      <ScorecardConfirmModal
        pendingId={confirmId}
        onDone={() => setConfirmId(null)}
        onCancel={() => setConfirmId(null)}
      />
    );
  }

  if (step === "playing") return <RoundPlayer onExit={() => { cancelActiveRound(); setStep("home"); }} onCancel={() => setStep("home")} />;
  if (activeRound && step === "home") return (
    <HomeScreen
      onStart={(id) => { if (id) setCourseId(id); setStep("setup"); }}
      activeRound={activeRound}
      onResume={() => setStep("playing")}
      onAbandon={() => { cancelActiveRound(); }}
      extraCourses={extraCourses}
      onAddCourse={addExtraCourse}
    />
  );

  if (step === "setup") {
    return (
      <SetupScreen
        course={course}
        players={players}
        setPlayers={setPlayers}
        frequent={frequent}
        onBack={() => setStep("home")}
        onPregame={() => sendPregameInsight({ id: course.id, name: course.name })}
        onStart={(mode) => {
          startRound(course, players, undefined, undefined, mode);
          setStep("playing");
        }}
      />
    );
  }

  return (
    <HomeScreen
      onStart={(id?: string) => {
        if (id) setCourseId(id);
        setStep("setup");
      }}
      extraCourses={extraCourses}
      onAddCourse={addExtraCourse}
    />
  );

};

/* ────────── HOME ────────── */
const RUSSIA_IDS = ["pestovo", "skolkovo", "petergolf", "mcc-nakhabino", "agalarov", "tseleevo"];

const CourseRow = ({ course, onStart }: { course: Course; onStart: () => void }) => (
  <button
    onClick={onStart}
    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform text-left"
  >
    <div className="min-w-0">
      <div className="font-semibold text-sm truncate">{course.name}</div>
      <div className="text-xs text-muted-foreground truncate">{course.club}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{course.holes.length} holes · Par {course.totalPar}</div>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
  </button>
);

const HomeScreen = ({ onStart, activeRound, onResume, onAbandon, extraCourses, onAddCourse }: {
  onStart: (courseId?: string) => void;
  activeRound?: import("@/store/golfStore").Round | null;
  onResume?: () => void;
  onAbandon?: () => void;
  extraCourses?: Course[];
  onAddCourse?: (course: Course) => void;
}) => {
  const { t } = useTranslation();
  const { rounds, profile, updateProfile } = useGolf();
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const russianCourses = COURSES.filter(c => RUSSIA_IDS.includes(c.id));
  const customCourses = extraCourses ?? [];

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Player";

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400);
    updateProfile({ photoUrl: compressed });
    toast.success(t.profilePhotoUpdated);
    e.target.value = "";
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* ── Profile photo ── */}
      <button
        onClick={() => photoInputRef.current?.click()}
        className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform text-left"
      >
        {profile.photoUrl ? (
          <img src={profile.photoUrl} alt={name} className="h-12 w-12 rounded-full object-cover shrink-0" />
        ) : (
          <Avatar name={name} tone="orange" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Загрузить фото профиля</div>
        </div>
        <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      {/* ── Unfinished round ── */}
      {activeRound && onResume && (
        <Card className="p-4 shadow-elevated" style={{ border: "1.5px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.06)" }}>
          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "#22c55e" }}>
            {t.unfinishedRound}
          </div>
          <div className="font-semibold text-foreground mb-1">{activeRound.courseName.split(" · ")[0]}</div>
          <div className="text-sm text-muted-foreground mb-3">
            {Object.values(activeRound.scores).flat().filter(s => s.score > 0).length > 0
              ? `${t.holesPlayed}: ${Math.max(...Object.values(activeRound.scores).flat().map(s => s.hole), 0)}`
              : t.roundStartedNoScores}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onResume}
              className="flex-1 h-10 rounded-xl font-bold text-sm"
              style={{ background: "#22c55e", color: "#000" }}
            >
              {t.continue}
            </button>
            <button
              onClick={onAbandon}
              className="h-10 px-4 rounded-xl font-bold text-sm"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1.5px solid rgba(239,68,68,0.25)" }}
            >
              {t.cancel}
            </button>
          </div>
        </Card>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t.rounds} value={String(rounds.length)} />
        <StatTile label={t.best} value={rounds.length === 0 ? "—" : String(Math.min(...rounds.map((r) => r.players[0] ? (r.scores[r.players[0].id] ?? []).reduce((a, s) => a + s.score, 0) : 999)))} />
      </div>

      {/* ── Search any course ── */}
      <button
        onClick={() => setShowSearch(true)}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border text-left active:scale-[0.98] transition-transform"
      >
        <div className="h-10 w-10 rounded-full grid place-items-center shrink-0" style={{ background: "rgba(34,197,94,0.1)", border: "1.5px solid rgba(34,197,94,0.3)" }}>
          <Search className="h-5 w-5" style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="font-semibold text-sm">{t.findAnyCourse}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Al Hamra, Wentworth, Augusta…</div>
        </div>
      </button>

      {/* ── Play button ── */}
      <button
        onClick={() => onStart("championship")}
        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-3 shadow-glow active:scale-[0.98] transition-transform"
        style={{ background: "#22c55e", color: "#000" }}
      >
        <Flag className="h-5 w-5" strokeWidth={2.5} />
        {t.play}
      </button>

      {/* ── Tee times & trainings ── */}
      <button
        onClick={() => navigate("/booking")}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left active:scale-[0.98] transition-transform"
        style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)" }}
      >
        <div className="h-10 w-10 rounded-full grid place-items-center shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
          <CalendarClock className="h-5 w-5" style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="font-semibold text-sm">Записаться</div>
          <div className="text-xs text-muted-foreground mt-0.5">Ти-таймы и тренировки</div>
        </div>
      </button>

      {/* ── Golf Club Minsk ── */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-1">{t.golfClubMinsk}</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onStart("championship")}
            className="overflow-hidden rounded-xl shadow-soft aspect-[4/3] relative group focus:outline-none active:scale-[0.97] transition-transform"
          >
            <img src={photo1} alt="Championship" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-spring group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-3">
              <div className="text-primary-foreground text-xs font-bold uppercase tracking-wider">Championship</div>
              <div className="text-primary-foreground/60 text-[10px] mt-0.5">18 {t.holes} · Par 72</div>
            </div>
          </button>
          <button
            onClick={() => onStart("academy")}
            className="overflow-hidden rounded-xl shadow-soft aspect-[4/3] relative group focus:outline-none active:scale-[0.97] transition-transform"
          >
            <img src={photo2} alt="Academy" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-spring group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-3">
              <div className="text-primary-foreground text-xs font-bold uppercase tracking-wider">Academy</div>
              <div className="text-primary-foreground/60 text-[10px] mt-0.5">9 {t.holes} · Par 27</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Course Search Sheet ── */}
      {showSearch && (
        <CourseSearchSheet
          quickCourses={russianCourses}
          onQuickSelect={(course) => onStart(course.id)}
          onFound={(course) => {
            onAddCourse?.(course);
            onStart(course.id);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
};

/* ────────── COURSE SEARCH SHEET ────────── */
const CourseSearchSheet = ({
  quickCourses,
  onQuickSelect,
  onFound,
  onClose,
}: {
  quickCourses?: Course[];
  onQuickSelect?: (course: Course) => void;
  onFound: (course: Course) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError(null);
    setFound(null);
    try {
      const token = localStorage.getItem("golf_jwt");
      const base = (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL
        ? `https://${(import.meta as { env: { VITE_BACKEND_URL: string } }).env.VITE_BACKEND_URL}`
        : "";
      const res = await fetch(`${base}/api/ai/course`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { course: Course };
      if (!data.course) throw new Error("No course data");
      setFound(data.course);
    } catch {
      setError(t.failedToLoadCourse);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250 flex flex-col"
        style={{ background: "hsl(var(--popover))", maxHeight: "90vh", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        {/* Drag handle */}
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <div className="text-white font-bold text-lg">{t.findCourse}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
              <input
                type="text"
                autoFocus
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="w-full h-12 rounded-xl pl-10 pr-4 text-white text-sm outline-none placeholder:text-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <button
              onClick={search}
              disabled={loading || query.trim().length < 2}
              className="h-12 px-5 rounded-xl font-bold text-sm disabled:opacity-40 transition-opacity"
              style={{ background: "#22c55e", color: "#000" }}
            >
              {t.find}
            </button>
          </div>
          <p className="text-xs mt-2 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            Enter name in any language: «Skolkovo», «Al Hamra Golf», «Augusta National»
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5">
          {!found && !loading && quickCourses && quickCourses.length > 0 && (
            <div className="pb-4">
              <div className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: "rgba(255,255,255,0.4)" }}>{t.russianCourses}</div>
              <div className="space-y-2">
                {quickCourses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onQuickSelect?.(c)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl active:scale-[0.98] transition-transform text-left"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{c.club}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{c.holes.length} {t.holes} · Par {c.totalPar}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 ml-3" style={{ color: "rgba(255,255,255,0.3)" }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-t-green-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">⛳</div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold">{t.loadingCourse}</div>
                <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {t.getting} {t.course.toLowerCase()} {t.courseInfo}
                </div>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="text-2xl mb-2">❌</div>
              <div className="text-white font-semibold text-sm mb-1">{t.courseNotFound}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{error}</div>
            </div>
          )}

          {found && !loading && (
            <div className="space-y-4 pb-4">
              <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
                <div className="px-5 py-4">
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#22c55e" }}>{t.courseFound}</div>
                  <div className="text-white font-black text-xl">{found.name}</div>
                  <div className="text-white/60 text-sm mt-0.5">{found.club}</div>
                  <div className="text-white/40 text-xs mt-1">{found.address}</div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
                  <div className="flex flex-col items-center py-3">
                    <div className="text-white font-black text-xl">{found.totalPar}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Par</div>
                  </div>
                  <div className="flex flex-col items-center py-3">
                    <div className="text-white font-black text-xl">{found.holes.length}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.holes}</div>
                  </div>
                  <div className="flex flex-col items-center py-3">
                    <div className="text-white font-black text-xl">{found.tees.length}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.tees}</div>
                  </div>
                </div>

                {found.tees.length > 0 && (
                  <div className="px-5 pb-4 pt-3 border-t border-white/10">
                    <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{t.tees}</div>
                    <div className="space-y-1.5">
                      {found.tees.map(tee => (
                        <div key={tee.color} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm" style={{ background: tee.cssColor, border: "1px solid rgba(255,255,255,0.2)" }} />
                            <span className="text-white text-sm font-semibold">{tee.label}</span>
                          </div>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {tee.totalMeters}m · CR {tee.rating} / {tee.slope}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {found.designer && (
                  <div className="px-5 pb-4">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {t.designer} {found.designer}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onFound(found)}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: "#22c55e", color: "#000" }}
              >
                <PlayCircle className="h-5 w-5" strokeWidth={2.5} />
                {t.startRound}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <Card className="p-4 text-center shadow-soft">
    <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </Card>
);

/* ────────── SETUP ────────── */
const SetupScreen = ({
  course, players, setPlayers, frequent, onBack, onPregame, onStart,
}: {
  course: Course;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  frequent: Player[];
  onBack: () => void;
  onPregame: () => void;
  onStart: (mode: HolesMode) => void;
}) => {
  const { t } = useTranslation();
  const { addFrequent } = useGolf();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [teePickerFor, setTeePickerFor] = useState<string | null>(null);
  const [holesMode, setHolesMode] = useState<HolesMode>("18");
  const is9Hole = holesMode !== "18";
  const slots = Array.from({ length: 4 });

  const updatePlayerTee = (playerId: string, tee: TeeColor) => {
    setPlayers(players.map((p) => (p.id === playerId ? { ...p, tee } : p)));
    setTeePickerFor(null);
  };

  const addPlayer = (p: Player) => {
    if (players.length >= 4 || players.find((x) => x.id === p.id)) return;
    setPlayers([...players, p]);
    addFrequent(p);
  };
  const removePlayer = (id: string) => setPlayers(players.filter((p) => p.id !== id || (p as Player).isMe));

  return (
    <>
      <div className="space-y-5 animate-in slide-in-from-right duration-300">
        <button onClick={onBack} className="flex items-center gap-1 text-action font-bold text-lg">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} /> PLAYER SETUP
        </button>

        {/* Selected course (chosen on the previous step) */}
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">{t.course}</div>
          <div className="font-semibold text-sm">{course.name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {course.club} · Par {course.totalPar}
          </div>
        </Card>

        {/* Players */}
        <Card className="overflow-hidden shadow-soft">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 bg-muted/50 text-xs text-muted-foreground font-semibold">
            <div>{t.players} / HCP</div>
            <div className="w-14 text-center">{t.tee}</div>
            <div className="w-16 text-center">{t.suggested}</div>
          </div>
          {slots.map((_, i) => {
            const p = players[i];
            if (!p) {
              return (
                <div key={i} className="flex items-center justify-between px-4 py-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full border-2 border-dashed border-border" />
                    <div className="text-muted-foreground">{t.player} {i + 1}</div>
                  </div>
                  <button
                    className="flex items-center gap-1 text-action font-semibold text-sm"
                    onClick={() => setShowAddSheet(true)}
                  >
                    <Plus className="h-4 w-4" /> {t.add}
                  </button>
                </div>
              );
            }
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    {(() => {
                      const teeInfo = course?.tees.find(t => t.color === (p.tee ?? "yellow")) ?? course?.tees[0]
                      const ch = teeInfo ? calcCourseHcpForMode(p.hcp, teeInfo.slope, teeInfo.rating, course!.totalPar, holesMode) : p.hcp
                      return <div className="text-xs text-muted-foreground">HCP {p.hcp} · CH {ch}</div>
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTeePickerFor(p.id)}
                    className="w-10 h-10 rounded-md border-2 transition-base"
                    style={{
                      background: TEE_CONFIG[p.tee ?? "yellow"].cssColor,
                      borderColor: TEE_CONFIG[p.tee ?? "yellow"].border,
                    }}
                    title={TEE_CONFIG[p.tee ?? "yellow"].label}
                  />
                  <div className="relative">
                    {(() => {
                      const teeInfo = course?.tees.find(t => t.color === (p.tee ?? "yellow")) ?? course?.tees[0]
                      const ch = teeInfo ? calcCourseHcpForMode(p.hcp, teeInfo.slope, teeInfo.rating, course!.totalPar, holesMode) : Math.round(p.hcp)
                      return (
                        <div className="h-12 w-12 rounded-full bg-warning grid place-items-center font-bold text-primary">
                          {ch}
                        </div>
                      )
                    })()}
                  </div>
                  {!p.isMe && (
                    <button onClick={() => removePlayer(p.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        {/* Round format */}
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">{t.round}</div>
          <div className="grid grid-cols-3 gap-2">
            {(["18", "front9", "back9"] as HolesMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setHolesMode(m)}
                className={cn(
                  "py-3 rounded-xl border-2 text-sm font-semibold transition-base",
                  holesMode === m
                    ? "border-action bg-action/10 text-action"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30",
                )}
              >
                {m === "18" ? `18 ${t.holes}` : m === "front9" ? t.front9 : t.back9}
              </button>
            ))}
          </div>
        </Card>

        <Button
          onClick={() => { onPregame(); onStart(holesMode); }}
          size="lg"
          className="h-14 bg-action hover:bg-action/90 text-action-foreground rounded-xl text-base font-semibold shadow-glow transition-spring"
        >
          {t.startRound} · {course?.name}
        </Button>
      </div>

      {showAddSheet && (
        <AddPlayerSheet
          players={players}
          frequent={frequent}
          onAdd={(p) => { addPlayer(p); setShowAddSheet(false); }}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {teePickerFor && (
        <TeePickerSheet
          course={course!}
          currentTee={players.find(p => p.id === teePickerFor)?.tee ?? "yellow"}
          onSelect={(tee) => updatePlayerTee(teePickerFor, tee)}
          onClose={() => setTeePickerFor(null)}
        />
      )}
    </>
  );
};

/* ────────── TEE PICKER SHEET ────────── */
const TeePickerSheet = ({
  course,
  currentTee,
  onSelect,
  onClose,
}: {
  course: import("@/lib/courses").Course;
  currentTee: TeeColor;
  onSelect: (tee: TeeColor) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250"
        style={{ background: "hsl(var(--popover))", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="flex items-center justify-between px-5 pb-4">
          <div className="text-white font-bold text-lg">{t.selectTee}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
        <div className="px-4 pb-4 space-y-2">
          {course.tees.map((teeOption) => (
            <button
              key={teeOption.color}
              onClick={() => onSelect(teeOption.color)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform"
              style={{
                background: currentTee === teeOption.color ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                border: currentTee === teeOption.color ? "2px solid rgba(255,255,255,0.25)" : "2px solid transparent",
              }}
            >
              <div
                className="w-10 h-10 rounded-md shrink-0 border-2"
                style={{ background: teeOption.cssColor, borderColor: TEE_CONFIG[teeOption.color].border }}
              />
              <div className="text-left flex-1">
                <div className="text-white font-bold">{teeOption.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {teeOption.totalMeters}m · CR {teeOption.rating} / Slope {teeOption.slope}
                </div>
              </div>
              {currentTee === teeOption.color && <Check className="h-5 w-5" style={{ color: "#22c55e" }} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ────────── ADD PLAYER SHEET ────────── */
type UserResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  hcp: number | null;
  photo_url: string | null;
};

const mkPlayerName = (u: UserResult) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Player";

const mkInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

const AddPlayerSheet = ({
  players,
  onAdd,
  onClose,
}: {
  players: Player[];
  frequent: Player[];
  onAdd: (p: Player) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UserResult[]>("/api/users/all")
      .then(setAllUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const alreadyAdded = (id: string) => !!players.find((p) => p.id === id);

  const q = query.trim().toLowerCase();
  const filtered = q.length === 0
    ? allUsers
    : allUsers.filter((u) => {
        const name = mkPlayerName(u).toLowerCase();
        const uname = (u.username ?? "").toLowerCase();
        return name.includes(q) || uname.includes(q);
      });

  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250 flex flex-col"
        style={{ background: "hsl(var(--popover))", maxHeight: "85vh", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />

        <div className="flex items-center justify-between px-5 pb-3">
          <div className="text-white font-bold text-lg">{t.addPlayer}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
            <input
              type="text"
              autoFocus
              placeholder={t.searchPlayers}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 rounded-xl pl-10 pr-4 text-white text-sm outline-none placeholder:text-white/30"
              style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-3 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              {q ? t.noPlayersFound : t.noOtherPlayers}
            </div>
          ) : (
            filtered.map((u) => {
              const name = mkPlayerName(u);
              const added = alreadyAdded(u.id);
              return (
                <button
                  key={u.id}
                  disabled={added}
                  onClick={() => onAdd({
                    id: u.id,
                    name,
                    initials: mkInitials(name),
                    hcp: u.hcp ?? 0,
                    photoUrl: u.photo_url ?? undefined,
                  })}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 active:scale-[0.98] transition-transform disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  {u.photo_url ? (
                    <img
                      src={u.photo_url}
                      alt={name}
                      className="h-12 w-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <Avatar name={name} tone="muted" />
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{name}</div>
                    <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {u.username ? `@${u.username}` : `HCP ${u.hcp ?? "—"}`}
                    </div>
                  </div>
                  {added
                    ? <div className="text-xs font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{t.added}</div>
                    : <div className="text-sm font-semibold shrink-0" style={{ color: "#22c55e" }}>+ {t.add}</div>
                  }
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ────────── PLAYING ────────── */
const scoreLabel = (score: number, par: number) => {
  const d = score - par;
  if (d <= -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  return `+${d}`;
};

const scoreLabelColor = (score: number, par: number) => {
  const d = score - par;
  if (d <= -2) return "text-yellow-400";
  if (d === -1) return "text-action";
  if (d === 0) return "text-primary-foreground";
  if (d === 1) return "text-orange-400";
  return "text-red-400";
};

const RoundPlayer = ({ onExit, onCancel }: { onExit: () => void; onCancel: () => void }) => {
  const { t } = useTranslation();
  const { activeRound, enterScore, finishRound, setRoundPhoto, syncRound, setCurrentHole, refreshActiveRound, profile } = useGolf();

  // Poll partner scores every 15s when there are other registered players
  useEffect(() => {
    if (!activeRound) return;
    const hasPartners = activeRound.players.some(p => !p.isMe);
    if (!hasPartners) return;
    const id = setInterval(() => refreshActiveRound(), 15000);
    return () => clearInterval(id);
  }, [activeRound?.id]);

  // Compute play holes before useState so initializer can use them
  const _course = getAllCourses().find(c => c.id === activeRound?.courseId) ?? COURSES[0];
  const _mode = activeRound?.holesMode ?? "18";
  const playHoles = _mode === "front9"
    ? _course.holes.filter(h => h.number <= 9)
    : _mode === "back9"
    ? _course.holes.filter(h => h.number > 9)
    : _course.holes;

  // Course Handicap for a player (based on their tee and holes mode)
  const getCh = (p: Player) => {
    const teeInfo = _course.tees.find(t => t.color === (p.tee ?? "yellow")) ?? _course.tees[0]
    return calcCourseHcpForMode(p.hcp, teeInfo.slope, teeInfo.rating, _course.totalPar, _mode)
  }

  // Strokes received/given on a specific hole for a player
  const getHoleStrokes = (p: Player, h: typeof _course.holes[0]) => {
    const rank = holeRankInSet(h, playHoles)
    return holeStrokesInSet(getCh(p), rank, playHoles.length)
  }

  // Running net vs par (gross - strokes - par per each played hole)
  const calcNetVsPar = (p: Player) =>
    (activeRound?.scores[p.id] ?? []).reduce((acc, s) => {
      const h = playHoles.find(h => h.number === s.hole)
      if (!h) return acc
      return acc + s.score - getHoleStrokes(p, h) - h.par
    }, 0)

  const [holeIdx, setHoleIdx] = useState(() => {
    if (!activeRound) return 0;
    if (activeRound.currentHoleIndex != null) {
      const idx = activeRound.currentHoleIndex;
      if (idx >= 0 && idx < playHoles.length) return idx;
    }
    const firstUnscored = playHoles.findIndex(h =>
      !activeRound.players.every(p =>
        activeRound.scores[p.id]?.some(s => s.hole === h.number)
      )
    );
    return firstUnscored >= 0 ? firstUnscored : playHoles.length - 1;
  });

  // Persist current hole to store → saved to DB on visibilitychange (Telegram close)
  useEffect(() => {
    setCurrentHole(holeIdx);
  }, [holeIdx]);

  const [sheetPlayer, setSheetPlayer] = useState<Player | null>(null);
  const [hole, setHole] = useState({ score: 4, putts: 2, driving: false, gir: false, bunker: 0, penalties: 0 });
  const [completedRound, setCompletedRound] = useState<Round | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const isMobile = useIsMobile();

  // Экран подтверждения после 18 лунки
  if (showConfirmation && activeRound) {
    const confirmFinish = () => {
      const snapshot = activeRound;
      finishRound();
      setCompletedRound({ ...snapshot, completed: true });
      setShowConfirmation(false);
    };

    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "hsl(var(--background))" }}
      >
        <div className="shrink-0 flex items-center justify-center" style={{ paddingTop: "calc(var(--tg-safe-top) + 10px)", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-white font-bold tracking-[0.18em] text-base">GOLF</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="text-center mb-6">
            <div className="text-white/60 text-sm uppercase tracking-wider mb-2">{t.confirmation}</div>
            <div className="text-white font-black text-3xl">{t.completedRound}</div>
          </div>

          {/* Players scorecard summary */}
          <div className="space-y-4">
            {activeRound.players.map((p) => {
              const scores = activeRound.scores[p.id] ?? [];
              const total = scores.reduce((a, s) => a + s.score, 0);
              const vsPar = scores.reduce((a, s) => {
                const h = _course.holes.find((h) => h.number === s.hole);
                return a + (s.score - (h?.par ?? 4));
              }, 0);
              const vsParText = vsPar === 0 ? "E" : vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
              const ch = getCh(p);
              const netVsParVal = vsPar - ch;
              const netVsParText = netVsParVal === 0 ? "E" : netVsParVal > 0 ? `+${netVsParVal}` : `${netVsParVal}`;
              return (
                <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--card))" }}>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                      <div>
                        <div className="text-white font-bold">{p.name}</div>
                        <div className="text-white/50 text-sm">HCP {p.hcp} · CH {ch}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-white tabular-nums">{total}</div>
                      <div className="text-sm font-bold" style={{ color: vsPar < 0 ? "#22c55e" : vsPar === 0 ? "rgba(255,255,255,0.6)" : "#f87171" }}>
                        {vsParText}
                      </div>
                      <div className="text-xs font-semibold" style={{ color: netVsParVal < 0 ? "#22c55e" : netVsParVal === 0 ? "rgba(255,255,255,0.4)" : "#fbbf24" }}>
                        Net {netVsParText}
                      </div>
                    </div>
                  </div>

                  {/* All hole scores */}
                  <div className="grid grid-cols-9 gap-1 px-3 pb-3">
                    {scores.slice(0, 18).map((s) => {
                      const h = _course.holes.find((hole) => hole.number === s.hole);
                      return (
                        <div
                          key={s.hole}
                          className="aspect-square rounded-lg flex flex-col items-center justify-center text-center"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                        >
                          <div className="text-white/40 text-[10px] leading-none">Hole {s.hole}</div>
                          <div className={cn("text-xl font-black leading-none mt-1", scoreLabelColor(s.score, h?.par ?? 4))}>
                            {s.score}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <button
            onClick={confirmFinish}
            className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: "#22c55e", color: "#000" }}
          >
            <Check className="h-5 w-5" strokeWidth={3} />
            {t.finishRound}
          </button>
          <button
            onClick={() => setShowConfirmation(false)}
            className="w-full h-12 rounded-2xl font-semibold text-sm"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            {t.editScore}
          </button>
        </div>
      </div>
    );
  }

  if (completedRound) {
    const completedCourse = getAllCourses().find((c) => c.id === completedRound.courseId);
    const cme = completedRound.players.find((p) => p.isMe) ?? completedRound.players[0];
    const cScores = cme ? (completedRound.scores[cme.id] ?? []) : [];
    const cTotal = cScores.reduce((a, s) => a + s.score, 0);
    const cVsPar = cScores.reduce((a, s) => {
      const h = completedCourse?.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 4));
    }, 0);
    const vpText = cVsPar === 0 ? "E" : cVsPar > 0 ? `+${cVsPar}` : `${cVsPar}`;
    const vpColor = cVsPar < 0 ? "#22c55e" : cVsPar === 0 ? "rgba(255,255,255,0.8)" : "#f87171";

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const compressed = await compressImage(file);
      setRoundPhoto(completedRound.id, compressed);
      setCompletedRound({ ...completedRound, photoUrl: compressed });
      toast.success(t.photoAdded);
      e.target.value = "";
    };

    const handleShareInstagram = async () => {
      setIsGeneratingStory(true);
      toast.info(t.sharingRound);
      try {
        console.log('[Instagram] Starting generation...', { round: completedRound.id });
        const blob = await generateStoryImage(completedRound, profile);
        console.log('[Instagram] Generated blob:', blob.size, 'bytes');
        await shareToInstagram(blob);
        toast.success(t.shareSuccess);
      } catch (err) {
        console.error('[Instagram] Error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`${t.shareFailed}: ${errorMsg}`);
      } finally {
        setIsGeneratingStory(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "hsl(var(--background))" }}
      >
        <div className="shrink-0 flex items-center justify-center" style={{ paddingTop: "calc(var(--tg-safe-top) + 10px)", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-white font-bold tracking-[0.18em] text-base">GOLF</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6 overflow-y-auto">
          <div className="text-center">
            <div
              className="h-16 w-16 rounded-full mx-auto mb-4 grid place-items-center"
              style={{ background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }}
            >
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                <path d="M2 11L10 19L26 3" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
              {t.completedRound}
            </div>
            <div className="text-white font-black text-5xl tabular-nums leading-none mt-2">{cTotal}</div>
            <div className="text-xl font-bold mt-1" style={{ color: vpColor }}>{vpText}</div>
            <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              {completedRound.courseName.split(" · ")[0]}
            </div>
          </div>

          {completedRound.photoUrl ? (
            <div className="w-full">
              <div className="w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: 220 }}>
                <img src={completedRound.photoUrl} alt="Round" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => photoRef.current?.click()}
                className="flex items-center justify-center gap-2 w-full mt-2 py-2 text-sm font-semibold"
                style={{ color: "#22c55e" }}
              >
                <Camera className="h-4 w-4" /> {t.replacePhoto}
              </button>
            </div>
          ) : (
            <button
              onClick={() => photoRef.current?.click()}
              className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-10"
              style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.12)" }}
            >
              <Camera className="h-8 w-8" style={{ color: "#22c55e" }} />
              <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                {t.addRoundPhoto}
              </div>
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        <div className="px-5 pt-4 space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
          <button
            onClick={onExit}
            className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform"
            style={{ background: "#22c55e", color: "#000" }}
          >
            {t.done}
          </button>
        </div>
      </div>
    );
  }

  if (!activeRound) {
    return (
      <Card className="p-8 text-center">
        <div className="text-muted-foreground mb-4">No active round</div>
        <Button onClick={onExit}>Back</Button>
      </Card>
    );
  }

  const course = _course;
  const currentHole = playHoles[holeIdx] ?? playHoles[0];
  const totalHoles = playHoles.length;
  const mePlayer = activeRound.players.find((p) => p.isMe);

  const openSheet = (p: Player) => {
    const existing = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
    setHole({
      score: currentHole.par,
      putts: existing?.putts ?? 2,
      driving: existing?.driving ?? false,
      gir: existing?.gir ?? false,
      bunker: existing?.bunker ?? 0,
      penalties: existing?.penalties ?? 0,
    });
    setSheetPlayer(p);
  };

  const openNextPlayer = () => {
    const next = activeRound.players.find(
      (p) => !activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number)
    ) ?? activeRound.players[0];
    openSheet(next);
  };

  const submit = () => {
    if (!sheetPlayer) return;
    enterScore(sheetPlayer.id, { hole: currentHole.number, ...hole });
    setSheetPlayer(null);

    const allOthersScored = activeRound.players
      .filter((p) => p.id !== sheetPlayer.id)
      .every((p) => !!activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number));

    if (allOthersScored) {
      // Build updated scores including the score just entered (state not yet updated)
      const updatedScores = {
        ...activeRound.scores,
        [sheetPlayer.id]: [
          ...(activeRound.scores[sheetPlayer.id]?.filter((x) => x.hole !== currentHole.number) ?? []),
          { hole: currentHole.number, ...hole },
        ],
      };

      // Round is complete only when ALL play holes have scores for ALL players
      const allHolesScored = playHoles.every((h) =>
        activeRound.players.every((p) => updatedScores[p.id]?.some((s) => s.hole === h.number))
      );

      if (allHolesScored) {
        setTimeout(() => setShowConfirmation(true), 600);
      } else if (holeIdx === totalHoles - 1) {
        // Last index but not all holes done — wrap to first unscored hole
        const nextIdx = playHoles.findIndex((h) =>
          !activeRound.players.every((p) => updatedScores[p.id]?.some((s) => s.hole === h.number))
        );
        if (nextIdx >= 0) setTimeout(() => setHoleIdx(nextIdx), 600);
      } else {
        setTimeout(() => setHoleIdx((h) => Math.min(totalHoles - 1, h + 1)), 600);
      }
    }
  };

  const handleFinish = () => {
    const snapshot = activeRound;
    finishRound();
    setCompletedRound({ ...snapshot!, completed: true });
  };

  const total = (p: Player) =>
    activeRound.scores[p.id]?.reduce((a, s) => a + (s.score || 0), 0) ?? 0;
  const totalVsPar = (p: Player) => {
    const played = activeRound.scores[p.id] ?? [];
    return played.reduce((a, s) => {
      const h = course.holes.find((h) => h.number === s.hole);
      return a + (s.score - (h?.par ?? 0));
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(var(--background))" }}>

      {/* ── Header + hole navigation in one row ── */}
      <div
        className="shrink-0 flex items-center justify-between px-5"
        style={{
          paddingTop: "calc(var(--tg-safe-top) + 10px)",
          paddingBottom: 10,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button
          onClick={() => setShowExitConfirm(true)}
          className="h-9 w-9 rounded-full grid place-items-center"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <X className="h-4 w-4 text-white" strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setHoleIdx(Math.max(0, holeIdx - 1))}
            disabled={holeIdx === 0}
            className="h-9 w-9 grid place-items-center disabled:opacity-20"
          >
            <ChevronLeft className="h-6 w-6 text-white" strokeWidth={2.5} />
          </button>
          <span className="text-white font-bold text-base tracking-wider min-w-[90px] text-center">
            Лунка {currentHole.number}
          </span>
          <button
            onClick={() => setHoleIdx(Math.min(totalHoles - 1, holeIdx + 1))}
            disabled={holeIdx === totalHoles - 1}
            className="h-9 w-9 grid place-items-center disabled:opacity-20"
          >
            <ChevronRight className="h-6 w-6 text-white" strokeWidth={2.5} />
          </button>
        </div>

        <button
          onClick={handleFinish}
          className="h-9 px-4 rounded-full font-bold text-xs tracking-wider"
          style={{ background: "rgba(255,255,255,0.1)", color: "#4ade80" }}
        >
          ФИНИШ
        </button>
      </div>

      {/* ── Main card (widget style) ── */}
      <div className="flex-1 flex flex-col justify-center px-5 pb-4 gap-4 overflow-y-auto">

        {/* Widget card */}
        <div className="rounded-3xl overflow-hidden" style={{ background: "hsl(var(--card))" }}>

          {/* Card header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6L12 2z"
                stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
            </svg>
            <span className="text-white/70 font-semibold text-sm tracking-[0.15em]">GOLF</span>
          </div>

          {/* Par + HCP */}
          <div className="flex items-baseline gap-6 px-5 pb-4">
            <div>
              <span className="text-white font-black text-4xl tracking-tight">PAR {currentHole.par}</span>
            </div>
            <div>
              <span className="text-white/50 font-bold text-2xl tracking-tight">HCP {currentHole.hcp}</span>
            </div>
          </div>

          {/* ВВЕСТИ СЧЁТ button */}
          <div className="px-5 pb-4">
            <button
              onClick={openNextPlayer}
              className="w-full h-12 rounded-full font-black text-sm tracking-[0.15em] active:scale-[0.97] transition-transform"
              style={{ background: "#22c55e", color: "#000" }}
            >
              ВВЕСТИ СЧЁТ
            </button>
          </div>

          {/* Card footer: course + hole number */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ background: "rgba(255,255,255,0.05)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <div className="text-white/80 text-sm font-semibold">{course.club}</div>
              <div className="text-white/40 text-xs">{course.name} · {currentHole.meters[mePlayer?.tee ?? "yellow"]} m</div>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5" style={{ color: "#22c55e" }} />
              <span className="text-white font-black text-2xl tabular-nums">{currentHole.number}</span>
            </div>
          </div>
        </div>

        {/* Player score cards */}
        {activeRound.players.map((p) => {
          const tp = totalVsPar(p);
          const sign = tp === 0 ? "E" : tp > 0 ? `+${tp}` : `${tp}`;
          const np = calcNetVsPar(p);
          const netSign = np === 0 ? "E" : np > 0 ? `+${np}` : `${np}`;
          const pCh = getCh(p);
          const has = activeRound.scores[p.id]?.find((x) => x.hole === currentHole.number);
          return (
            <button
              key={p.id}
              onClick={() => openSheet(p)}
              className="w-full rounded-2xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={p.name} tone={p.isMe ? "orange" : "muted"} photoUrl={p.photoUrl} />
                <div className="text-left min-w-0">
                  <div className="text-white font-semibold truncate">
                    {p.name.split(" ")[0]}
                    <span className="text-white/40 text-sm font-normal ml-1">CH {pCh}</span>
                  </div>
                  <div className="text-white/50 text-sm">{sign} · Net {netSign}</div>
                </div>
              </div>
              <div
                className="min-w-[60px] h-14 rounded-xl flex flex-col items-center justify-center"
                style={has
                  ? { background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }
                  : { background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.1)" }
                }
              >
                {has ? (
                  <>
                    <div className="text-white font-black text-2xl tabular-nums leading-none">{has.score}</div>
                    <div className={cn("text-[10px] font-bold mt-0.5", scoreLabelColor(has.score, currentHole.par))}>
                      {scoreLabel(has.score, currentHole.par)}
                    </div>
                  </>
                ) : (
                  <div className="text-white/25 text-2xl font-light">—</div>
                )}
              </div>
            </button>
          );
        })}

        {/* Hole progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {playHoles.map((h, i) => (
            <button
              key={i}
              onClick={() => setHoleIdx(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === holeIdx ? 20 : 8,
                height: 8,
                background: i === holeIdx
                  ? "#22c55e"
                  : activeRound.players.some((p) =>
                      activeRound.scores[p.id]?.find((s) => s.hole === h.number)
                    )
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Exit confirmation ── */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-in fade-in duration-150" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full rounded-3xl p-6 space-y-4" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center">
              <div className="text-white font-black text-xl mb-1">Leave round?</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Round saved — come back anytime and continue where you left off
              </div>
            </div>
            <button
              onClick={() => {
                setShowExitConfirm(false);
                if (activeRound) syncRound(activeRound).catch(() => {});
                onCancel();
              }}
              className="w-full h-13 rounded-2xl font-bold text-sm py-4"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
            >
              Minimize — continue later
            </button>
            <button
              onClick={() => { setShowExitConfirm(false); onExit(); }}
              className="w-full h-13 rounded-2xl font-bold text-sm py-4"
              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1.5px solid rgba(239,68,68,0.3)" }}
            >
              Cancel round
            </button>
          </div>
        </div>
      )}

      {/* ── Score Sheet ── */}
      {sheetPlayer && (
        <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
          <button className="absolute inset-0 bg-black/70" onClick={() => setSheetPlayer(null)} />
          <div
            className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250"
            style={{ background: "hsl(var(--card))", paddingBottom: `max(env(safe-area-inset-bottom), 24px)` }}
          >
            {/* drag handle */}
            <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "rgba(255,255,255,0.15)" }} />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <Avatar name={sheetPlayer.name} tone={sheetPlayer.isMe ? "orange" : "muted"} photoUrl={sheetPlayer.photoUrl} />
                <div>
                  <div className="text-white font-bold">{sheetPlayer.name.split(" ")[0]}</div>
                  <div className="text-white/40 text-xs">
                    Hole {currentHole.number} · Par {currentHole.par}
                    {(() => { const s = getHoleStrokes(sheetPlayer, currentHole); return s !== 0 ? <span style={{ color: s > 0 ? "#22c55e" : "#f87171" }}> · {s > 0 ? `+${s}` : s} stroke</span> : null })()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSheetPlayer(null)}
                className="h-9 w-9 rounded-full grid place-items-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            <div className="px-5 pt-5 pb-2">
              {/* Score + Putts counters */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <ScoreCounter
                  label="SCORE"
                  value={hole.score}
                  onChange={(v) => setHole({ ...hole, score: v })}
                  sublabel={scoreLabel(hole.score, currentHole.par)}
                  sublabelColor={scoreLabelColor(hole.score, currentHole.par)}
                />
                <ScoreCounter
                  label="PUTTS"
                  value={hole.putts}
                  onChange={(v) => setHole((h) => ({ ...h, putts: v, score: Math.max(1, h.score + (v - h.putts)) }))}
                />
              </div>

              {/* Stats toggles and counters */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                <StatToggle label="FIR" active={hole.driving} onClick={() => setHole({ ...hole, driving: !hole.driving })} />
                <StatToggle label="GIR" active={hole.gir} onClick={() => setHole({ ...hole, gir: !hole.gir })} />
                <StatCounter label="BUNKER" value={hole.bunker} onChange={(v) => setHole((h) => ({ ...h, bunker: v, score: Math.max(1, h.score + (v - h.bunker)) }))} />
                <StatCounter label="PENALTIES" value={hole.penalties} onChange={(v) => setHole((h) => ({ ...h, penalties: v, score: Math.max(1, h.score + (v - h.penalties)) }))} />
              </div>

              {/* Save button */}
              <button
                onClick={submit}
                className="w-full h-14 rounded-2xl font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform"
                style={{ background: "#22c55e", color: "#000" }}
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ScoreCounter = ({
  label, value, onChange, sublabel, sublabelColor,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  sublabel?: string;
  sublabelColor?: string;
}) => (
  <div className="rounded-2xl flex flex-col items-center" style={{ background: "rgba(255,255,255,0.06)" }}>
    <div className="text-[10px] font-bold uppercase tracking-widest pt-3 pb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
    <button
      onClick={() => onChange(value + 1)}
      className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-white/10"
      style={{ color: "#22c55e" }}
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
    <div className="text-4xl font-black tabular-nums text-white py-0.5">{value}</div>
    {sublabel
      ? <div className={cn("text-[11px] font-bold mb-0.5", sublabelColor)}>{sublabel}</div>
      : <div className="mb-0.5 h-4" />
    }
    <button
      onClick={() => onChange(Math.max(1, value - 1))}
      className="w-full h-14 grid place-items-center rounded-xl transition-colors active:bg-white/10"
      style={{ color: "#22c55e" }}
    >
      <span className="text-3xl leading-none font-bold">−</span>
    </button>
  </div>
);

/* ────────── SCORECARD CONFIRM MODAL ────────── */
type PendingScore = { hole: number; score: number };
type PendingPlayer = { label: string; name: string | null; holes: PendingScore[]; outTotal: number | null; inTotal: number | null };
type ScorecardData = { id: string; scores: { players: PendingPlayer[] } | PendingScore[]; courseName: string | null; holesCount: number };

const ScorecardConfirmModal = ({
  pendingId,
  onDone,
  onCancel,
}: {
  pendingId: string;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const { profile, addRound, loadRounds } = useGolf();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PendingPlayer[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [courseId, setCourseId] = useState<string>(COURSES[0].id);
  const [tee, setTee] = useState<TeeColor>("yellow");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    api
      .get<ScorecardData>(`/api/scorecards/${pendingId}`)
      .then((data) => {
        // Support both new {players:[]} format and legacy flat array
        let parsedPlayers: PendingPlayer[];
        const raw = data.scores;
        if (Array.isArray(raw)) {
          // Legacy format — single player
          parsedPlayers = [{ label: "A", name: null, holes: [...raw].sort((a, b) => a.hole - b.hole), outTotal: null, inTotal: null }];
        } else if (raw && typeof raw === "object" && Array.isArray((raw as { players: PendingPlayer[] }).players)) {
          parsedPlayers = (raw as { players: PendingPlayer[] }).players.map(p => ({
            ...p,
            holes: [...p.holes].sort((a, b) => a.hole - b.hole),
          }));
        } else {
          parsedPlayers = [];
        }
        setPlayers(parsedPlayers);
        setSelectedLabel(parsedPlayers[0]?.label ?? "");
        if (data.courseName) {
          const match = getAllCourses().find(
            (c) =>
              c.name.toLowerCase().includes(data.courseName!.toLowerCase()) ||
              data.courseName!.toLowerCase().includes(c.name.toLowerCase())
          );
          if (match) setCourseId(match.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Scorecard not found");
        setLoading(false);
      });
  }, [pendingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPlayer = players.find(p => p.label === selectedLabel) ?? players[0];
  const scores = selectedPlayer?.holes ?? [];

  const updateScore = (hole: number, val: number) => {
    setPlayers(prev => prev.map(p =>
      p.label === selectedLabel
        ? { ...p, holes: p.holes.map(s => s.hole === hole ? { ...s, score: val } : s) }
        : p
    ));
  };

  const course = getAllCourses().find((c) => c.id === courseId) ?? COURSES[0];
  const teeInfo = course.tees.find((t) => t.color === tee) ?? course.tees[0];
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const outSum = scores.filter(s => s.hole <= 9).reduce((a, s) => a + s.score, 0);
  const inSum = scores.filter(s => s.hole >= 10).reduce((a, s) => a + s.score, 0);
  const outMismatch = selectedPlayer?.outTotal != null && Math.abs(outSum - selectedPlayer.outTotal) > 1;
  const inMismatch = selectedPlayer?.inTotal != null && Math.abs(inSum - selectedPlayer.inTotal) > 1;

  const determineHolesMode = (): HolesMode => {
    if (scores.length > 9) return "18";
    const max = Math.max(...scores.map((s) => s.hole));
    return max <= 9 ? "front9" : "back9";
  };

  const confirm = async () => {
    if (!scores.length) return;
    setConfirming(true);
    try {
      const playerName =
        `${profile.firstName} ${profile.lastName}`.trim() || profile.username || "Me";
      const round: Round = {
        id: `r-${Date.now()}`,
        date: new Date(date + "T12:00:00").toISOString(),
        courseId,
        courseName: `${course.name} · ${course.club}`,
        tee: teeInfo.label,
        rating: teeInfo.rating,
        slope: teeInfo.slope,
        players: [
          {
            id: "me",
            name: playerName,
            initials: profile.initials || playerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
            hcp: profile.hcp,
            isMe: true,
          },
        ],
        scores: {
          me: scores.map((s) => ({
            hole: s.hole,
            score: s.score,
            putts: 0,
            driving: false,
            gir: false,
            bunker: 0,
            penalties: 0,
          })),
        },
        completed: true,
        holesMode: determineHolesMode(),
      };

      await api.post("/api/rounds", { round });
      api.delete(`/api/scorecards/${pendingId}`).catch(() => {});
      addRound({ ...round, updatedAt: new Date().toISOString() });
      await loadRounds();
      onDone();
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Save error";
      alert(`Ошибка сохранения раунда:\n${msg}\n\nURL: ${window.location.origin}`);
      setConfirming(false);
    }
  };

  const discard = async () => {
    try { await api.delete(`/api/scorecards/${pendingId}`); } catch { /* ignore */ }
    onCancel();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm">Loading scorecard…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Card className="p-6 text-center">
          <div className="text-3xl mb-3">❌</div>
          <div className="font-semibold mb-1">Scorecard not found</div>
          <div className="text-sm text-muted-foreground mb-4">{error}</div>
          <Button onClick={onCancel} variant="outline" className="w-full">Back</Button>
        </Card>
      </div>
    );
  }

  const front9 = scores.filter((s) => s.hole <= 9);
  const back9 = scores.filter((s) => s.hole >= 10);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#22c55e" }}>
          Scorecard Import
        </div>
        <h2 className="text-xl font-bold">Confirm Scores</h2>
        <p className="text-sm text-muted-foreground">Выберите свой ряд и проверьте счёт</p>
      </div>

      {/* Player selector — shown when multiple players detected */}
      {players.length > 1 && (
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Это мой ряд</div>
          <div className="flex gap-2 flex-wrap">
            {players.map((p) => (
              <button
                key={p.label}
                onClick={() => setSelectedLabel(p.label)}
                className={cn(
                  "flex-1 min-w-0 py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all text-left",
                  selectedLabel === p.label ? "border-action bg-action/10 text-action" : "border-border text-muted-foreground"
                )}
              >
                <div>Игрок {p.label}</div>
                {p.name && <div className="text-[11px] font-normal truncate mt-0.5 opacity-70">{p.name}</div>}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Cross-validation warning */}
      {(outMismatch || inMismatch) && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
          ⚠️ Сумма не совпадает с карточкой:{" "}
          {outMismatch && `OUT: найдено ${outSum}, на карте ${selectedPlayer?.outTotal}`}
          {outMismatch && inMismatch && " · "}
          {inMismatch && `IN: найдено ${inSum}, на карте ${selectedPlayer?.inTotal}`}
          <div className="text-xs mt-1 opacity-80">Проверьте и поправьте лунки вручную</div>
        </div>
      )}

      {/* Date */}
      <Card className="p-4 shadow-soft">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Date</div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-transparent text-foreground text-sm font-medium focus:outline-none"
        />
      </Card>

      {/* Course */}
      <Card className="p-4 shadow-soft">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Поле</div>
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {getAllCourses().map((c) => (
            <button
              key={c.id}
              onClick={() => setCourseId(c.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-base",
                courseId === c.id ? "border-action bg-action/5" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{c.club} · Par {c.totalPar}</div>
              </div>
              {courseId === c.id && <Check className="h-4 w-4 text-action shrink-0" />}
            </button>
          ))}
        </div>
      </Card>

      {/* Tee */}
      <Card className="p-4 shadow-soft">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tee</div>
        <div className="flex gap-2">
          {course.tees.map((t) => (
            <button
              key={t.color}
              onClick={() => setTee(t.color)}
              className={cn(
                "flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-base",
                tee === t.color ? "border-action bg-action/5" : "border-border"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Scores grid */}
      <Card className="p-4 shadow-soft">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Scores</div>

        {front9.length > 0 && (
          <div className="mb-3">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${front9.length}, 1fr)` }}>
              {front9.map((s) => (
                <div key={s.hole} className="text-center text-[10px] text-muted-foreground font-semibold">{s.hole}</div>
              ))}
            </div>
            <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: `repeat(${front9.length}, 1fr)` }}>
              {front9.map((s) => (
                <input
                  key={s.hole}
                  type="number"
                  min={1}
                  max={15}
                  value={s.score}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(15, parseInt(e.target.value) || 1));
                    updateScore(s.hole, v);
                  }}
                  className="w-full h-10 rounded-lg border border-border bg-transparent text-center text-sm font-bold focus:outline-none focus:border-action"
                />
              ))}
            </div>
            {front9.length === 9 && (
              <div className={cn("text-right text-xs font-semibold mt-1", outMismatch ? "text-orange-400" : "text-muted-foreground")}>
                OUT: {outSum}{selectedPlayer?.outTotal != null ? ` (карта: ${selectedPlayer.outTotal})` : ""}
              </div>
            )}
          </div>
        )}

        {back9.length > 0 && (
          <div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${back9.length}, 1fr)` }}>
              {back9.map((s) => (
                <div key={s.hole} className="text-center text-[10px] text-muted-foreground font-semibold">{s.hole}</div>
              ))}
            </div>
            <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: `repeat(${back9.length}, 1fr)` }}>
              {back9.map((s) => (
                <input
                  key={s.hole}
                  type="number"
                  min={1}
                  max={15}
                  value={s.score}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(15, parseInt(e.target.value) || 1));
                    updateScore(s.hole, v);
                  }}
                  className="w-full h-10 rounded-lg border border-border bg-transparent text-center text-sm font-bold focus:outline-none focus:border-action"
                />
              ))}
            </div>
            {back9.length === 9 && (
              <div className={cn("text-right text-xs font-semibold mt-1", inMismatch ? "text-orange-400" : "text-muted-foreground")}>
                IN: {inSum}{selectedPlayer?.inTotal != null ? ` (карта: ${selectedPlayer.inTotal})` : ""}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{scores.length} holes · Total</span>
          <span className="text-2xl font-bold tabular-nums">{totalScore}</span>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={discard}
          className="flex-1 h-12 rounded-xl border-2 border-border text-sm font-semibold text-muted-foreground active:scale-[0.98] transition-transform"
        >
          {t.discard}
        </button>
        <button
          onClick={confirm}
          disabled={confirming || !scores.length}
          className="flex-[2] h-12 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: "#22c55e", color: "#000" }}
        >
          {confirming ? t.saving : t.confirmRound}
        </button>
      </div>
    </div>
  );
};

const StatToggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 py-3 rounded-xl transition-colors"
    style={active
      ? { background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e", color: "#22c55e" }
      : { background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
    }
  >
    <div className="h-8 w-8 rounded-full grid place-items-center" style={{ background: active ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)" }}>
      {active && <Check className="h-5 w-5" strokeWidth={3} />}
    </div>
    <div className="text-[9px] font-semibold leading-tight text-center px-1">{label}</div>
  </button>
);

const StatCounter = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div
    className="flex flex-col items-center rounded-xl overflow-hidden"
    style={value > 0
      ? { background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }
      : { background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }
    }
  >
    <div className="text-[9px] font-semibold uppercase tracking-widest pt-2" style={{ color: value > 0 ? "#22c55e" : "rgba(255,255,255,0.4)" }}>{label}</div>
    <button
      onClick={() => onChange(value + 1)}
      className="w-full h-8 grid place-items-center active:bg-white/10"
      style={{ color: value > 0 ? "#22c55e" : "rgba(255,255,255,0.35)" }}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </button>
    <div className="text-xl font-black tabular-nums leading-none" style={{ color: value > 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>{value}</div>
    <button
      onClick={() => onChange(Math.max(0, value - 1))}
      disabled={value === 0}
      className="w-full h-8 grid place-items-center active:bg-white/10 disabled:opacity-25"
      style={{ color: value > 0 ? "#22c55e" : "rgba(255,255,255,0.35)" }}
    >
      <span className="text-xl leading-none font-bold">−</span>
    </button>
  </div>
);

export default PlayPage;
