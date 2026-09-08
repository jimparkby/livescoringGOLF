import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOURNAMENTS, isTournamentUpcoming, tournamentStartDate } from "@/lib/tournaments";
import { getTournamentData } from "@/lib/tournament-data";
import { Card } from "@/components/ui/card";
import { Image, Trophy, QrCode, MapPin, ArrowRight, BarChart3 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { NextTournamentHero } from "@/components/NextTournamentHero";
import { LatestResultsCard } from "@/components/LatestResultsCard";

type ActiveRound = { active: boolean; accessToken?: string; tournamentName?: string; flightLabel?: string };

const TournamentsPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { userId } = useAuth();
  const [tournamentsWithResults, setTournamentsWithResults] = useState<Set<string>>(new Set());
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);

  useEffect(() => {
    // Fetch list of tournaments with results from API
    fetch("/api/tournaments/list/with-results")
      .then(res => res.json())
      .then(data => {
        if (data.tournaments) {
          setTournamentsWithResults(new Set(data.tournaments));
        }
      })
      .catch(err => console.error("Failed to fetch tournaments with results:", err));
  }, []);

  useEffect(() => {
    if (!userId) { setActiveRound(null); return; }
    api.get<ActiveRound>("/api/tournaments/my-active-round").then(setActiveRound).catch(() => {});
  }, [userId]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof TOURNAMENTS>();
    TOURNAMENTS.forEach((t) => {
      const arr = map.get(t.month) ?? [];
      arr.push(t);
      map.set(t.month, arr);
    });
    return Array.from(map.entries());
  }, []);

  const upcoming = useMemo(
    () =>
      TOURNAMENTS.filter(isTournamentUpcoming)
        .sort((a, b) => tournamentStartDate(a).getTime() - tournamentStartDate(b).getTime())
        .slice(1, 3),
    [],
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="gm-eyebrow">Calendar</div>
        <h1 className="text-3xl mt-1">Tournaments 2026</h1>
        <p className="text-sm text-muted-foreground mt-1">Golf Club Minsk · {TOURNAMENTS.length} events</p>
      </div>

      {activeRound?.active && (
        <div
          onClick={() => navigate(`/tlive/${activeRound.accessToken}`)}
          className="px-5 py-4 flex items-center gap-4 cursor-pointer"
          style={{ background: "#15361f", border: "1px solid #c9a24b" }}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#c9a24b" }} />
          <div className="flex-1 min-w-0">
            <div className="gm-eyebrow" style={{ color: "#9fc2a8" }}>Раунд идёт</div>
            <div className="text-sm font-bold text-white truncate">
              {activeRound.tournamentName}{activeRound.flightLabel ? ` · ${activeRound.flightLabel}` : ""}
            </div>
          </div>
          <span className="flex items-center gap-1.5 h-9 px-4 text-sm font-bold shrink-0" style={{ background: "#c9a24b", color: "#15361f" }}>
            Продолжить <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <NextTournamentHero />
          <LatestResultsCard />
        </div>

        <div className="space-y-4 min-w-0">
          {/* Statistics tile */}
          <Card
            onClick={() => navigate('/statistics')}
            className="p-5 shadow-none border border-border cursor-pointer hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 shrink-0" style={{ color: "#15361f" }} strokeWidth={1.8} />
              <div className="flex-1">
                <div className="font-display font-semibold text-lg">Статистика</div>
                <div className="text-sm text-muted-foreground">Рейтинг игроков и результаты турниров 2026</div>
              </div>
            </div>
          </Card>

          {/* Course map tile */}
          <Card
            onClick={() => navigate('/course')}
            className="p-5 shadow-none border border-border cursor-pointer hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0" style={{ color: "#15361f" }} strokeWidth={1.8} />
              <div className="flex-1">
                <div className="font-display font-semibold text-lg">Карта полей</div>
                <div className="text-sm text-muted-foreground">Схема поля и скоркарты Golf Club Minsk</div>
              </div>
            </div>
          </Card>

          {/* Upcoming tournaments */}
          {upcoming.length > 0 && (
            <div className="p-6 space-y-3.5" style={{ background: "#15361f" }}>
              <div className="gm-eyebrow" style={{ color: "#9fc2a8" }}>
                Ближайшие турниры
              </div>
              {upcoming.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tournament-info/${t.id}`)}
                  className="flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 text-center shrink-0">
                    <div className="font-display text-xl font-bold text-white leading-none tabular-nums">{t.date}</div>
                    <div className="text-[9px] font-bold mt-1" style={{ color: "#9fc2a8" }}>
                      {t.month.slice(0, 3).toUpperCase()}
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-snug" style={{ color: "#e7ede8" }}>
                    {t.name}
                  </div>
                </div>
              ))}
              <div className="h-px" style={{ background: "rgba(201,162,75,0.22)" }} />
              <button
                onClick={() => document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" })}
                className="text-[12.5px] font-bold"
                style={{ color: "#c9a24b" }}
              >
                Весь календарь →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin panel — app management, visible only to the whitelisted admin account */}
      {isAdmin && (
        <Card
          onClick={() => navigate('/admin')}
          className="p-5 shadow-none border border-border cursor-pointer hover:bg-accent/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 shrink-0 text-action" strokeWidth={1.8} />
            <div className="flex-1">
              <div className="font-display font-semibold text-lg">Админ-панель</div>
              <div className="text-sm text-muted-foreground">Результаты, участники, регистрации, QR для турниров</div>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar */}
      <div id="calendar" className="space-y-5 scroll-mt-20">
      {grouped.map(([month, items]) => (
        <Card key={month} className="overflow-hidden shadow-none border border-border">
          <div className="px-4 py-2.5 border-b border-border">
            <div className="gm-eyebrow" style={{ color: "#2c6b3d" }}>{month}</div>
          </div>
          <div className="divide-y divide-border">
            {items.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/tournament-info/${t.id}`)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
              >
                <div className="w-16 shrink-0">
                  <div className="font-display font-bold tabular-nums text-foreground text-lg leading-none">{t.date}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.day}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-snug">{t.name}</div>
                  {(getTournamentData(t.id) || tournamentsWithResults.has(t.id)) && (
                    <div className="flex items-center gap-1 mt-1" style={{ color: "#2c6b3d" }}>
                      <Image className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Результаты
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      </div>
    </div>
  );
};

export default TournamentsPage;
