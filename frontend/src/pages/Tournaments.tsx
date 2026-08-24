import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOURNAMENTS } from "@/lib/tournaments";
import { getTournamentData } from "@/lib/tournament-data";
import { Card } from "@/components/ui/card";
import { Plus, Image, Trophy, QrCode, MapPin } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NextTournamentHero } from "@/components/NextTournamentHero";
import { LatestResultsCard } from "@/components/LatestResultsCard";

const TournamentsPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [tournamentsWithResults, setTournamentsWithResults] = useState<Set<string>>(new Set());

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

  const grouped = useMemo(() => {
    const map = new Map<string, typeof TOURNAMENTS>();
    TOURNAMENTS.forEach((t) => {
      const arr = map.get(t.month) ?? [];
      arr.push(t);
      map.set(t.month, arr);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">Calendar</div>
          <h1 className="text-3xl font-bold mt-1">Tournaments 2026</h1>
          <p className="text-sm text-muted-foreground mt-1">Golf Club Minsk · {TOURNAMENTS.length} events</p>
        </div>
        <button
          onClick={() => navigate("/create-tournament")}
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl font-bold text-sm mt-1 shrink-0"
          style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Создать
        </button>
      </div>

      <NextTournamentHero />
      <LatestResultsCard />

      {/* Statistics Button */}
      <Card
        onClick={() => navigate('/statistics')}
        className="p-5 shadow-soft cursor-pointer hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-action/20 grid place-items-center shrink-0">
            <Trophy className="h-6 w-6 text-action" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">Статистика</div>
            <div className="text-sm text-muted-foreground">Рейтинг игроков и результаты турниров 2026</div>
          </div>
          <div className="text-action text-2xl">›</div>
        </div>
      </Card>

      {/* Course map */}
      <Card
        onClick={() => navigate('/course')}
        className="p-5 shadow-soft cursor-pointer hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-action/20 grid place-items-center shrink-0">
            <MapPin className="h-6 w-6 text-action" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">Карта полей</div>
            <div className="text-sm text-muted-foreground">Схема поля и скоркарты Golf Club Minsk</div>
          </div>
          <div className="text-action text-2xl">›</div>
        </div>
      </Card>

      {/* Admin panel — app management, visible only to the whitelisted admin account */}
      {isAdmin && (
        <Card
          onClick={() => navigate('/admin')}
          className="p-5 shadow-soft cursor-pointer hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-action/20 grid place-items-center shrink-0">
              <QrCode className="h-6 w-6 text-action" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">Админ-панель</div>
              <div className="text-sm text-muted-foreground">Результаты, участники, регистрации, QR для турниров</div>
            </div>
            <div className="text-action text-2xl">›</div>
          </div>
        </Card>
      )}

      {/* Calendar */}
      {grouped.map(([month, items]) => (
        <Card key={month} className="overflow-hidden shadow-soft">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-action">{month}</div>
          </div>
          <div className="divide-y divide-border">
            {items.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/tournament-info/${t.id}`)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
              >
                <div className="w-16 shrink-0">
                  <div className="font-bold tabular-nums text-foreground text-lg leading-none">{t.date}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.day}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-snug">{t.name}</div>
                  {(getTournamentData(t.id) || tournamentsWithResults.has(t.id)) && (
                    <div className="flex items-center gap-1 mt-1">
                      <Image className="h-3 w-3 text-action" />
                      <span className="text-[10px] text-action font-semibold uppercase tracking-wider">
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
  );
};

export default TournamentsPage;
