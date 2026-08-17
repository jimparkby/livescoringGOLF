import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Award, Image as ImageIcon, Trophy, Users, Brain, UserPlus, CheckCircle, Clock, CreditCard, X as XIcon, Flag, ExternalLink } from "lucide-react";
import { TOURNAMENTS, isTournamentUpcoming, tournamentStartDate } from "@/lib/tournaments";
import { getTournamentData } from "@/lib/tournament-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { TournamentLiveLeaderboard } from "@/components/TournamentLiveLeaderboard";

type Tab = "info" | "live" | "results" | "nominations" | "photos" | "flights" | "predictions";

type Prediction = {
  playerName: string;
  probability: number;
  confidence: "low" | "medium" | "high";
  analysis?: string;
  playerHcp?: number;
  stats?: {
    totalTournaments: number;
    wins: number;
    top3Finishes: number;
    avgPlace: number;
  };
};

type PredictionGroup = {
  groupName: string;
  predictions: Prediction[];
};

const TournamentInfoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [flightsPhotos, setFlightsPhotos] = useState<string[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [predictionGroups, setPredictionGroups] = useState<PredictionGroup[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictionsCalculating, setPredictionsCalculating] = useState(false);
  const [predictionsMessage, setPredictionsMessage] = useState<string | null>(null);
  const [apiResults, setApiResults] = useState<any>(null);
  const [loadingApiResults, setLoadingApiResults] = useState(false);
  const [myRegistration, setMyRegistration] = useState<any | null>(null);
  const [loadingRegistration, setLoadingRegistration] = useState(false);
  const [registering, setRegistering] = useState(false);

  const tournament = TOURNAMENTS.find((t) => t.id === id);
  const tournamentData = id ? getTournamentData(id) : null;

  // Load flights photos from API
  useEffect(() => {
    const loadFlightsPhotos = async () => {
      if (!id) return;

      setLoadingFlights(true);
      try {
        console.log('[TournamentInfo] Loading flights photos for tournament:', id);
        const response = await fetch(`/api/tournaments/${id}/flights-photos`);
        console.log('[TournamentInfo] Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[TournamentInfo] Flights photos data:', data);
          setFlightsPhotos(data.photos || []);

          // If no tournament data but we have flights photos, switch to flights tab
          if (!tournamentData && data.photos && data.photos.length > 0) {
            setActiveTab("flights");
          }
        } else {
          console.error('[TournamentInfo] Failed to load flights photos:', response.statusText);
        }
      } catch (error) {
        console.error("[TournamentInfo] Error loading flights photos:", error);
      } finally {
        setLoadingFlights(false);
      }
    };

    loadFlightsPhotos();
  }, [id, tournamentData]);

  // Load results from API
  useEffect(() => {
    const loadApiResults = async () => {
      if (!id) return;

      setLoadingApiResults(true);
      try {
        console.log('[TournamentInfo] Loading API results for tournament:', id);
        const response = await fetch(`/api/tournaments/${id}/results`);
        console.log('[TournamentInfo] API results response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[TournamentInfo] API results data:', data);
          if (data.hasResults) {
            setApiResults(data);
            // If no hardcoded data but we have API results, switch to results tab
            if (!tournamentData) {
              setActiveTab("results");
            }
          }
        } else {
          console.error('[TournamentInfo] Failed to load API results:', response.statusText);
        }
      } catch (error) {
        console.error("[TournamentInfo] Error loading API results:", error);
      } finally {
        setLoadingApiResults(false);
      }
    };

    loadApiResults();
  }, [id, tournamentData]);

  // Load AI predictions when flights photos exist
  useEffect(() => {
    const loadPredictions = async () => {
      if (!id || flightsPhotos.length === 0) return;

      setLoadingPredictions(true);
      setPredictionsMessage(null);
      try {
        console.log('[TournamentInfo] Loading predictions for tournament:', id);
        const response = await fetch(`/api/predictions/tournament/${id}`);
        console.log('[TournamentInfo] Predictions response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[TournamentInfo] Predictions data:', data);
          setPredictionGroups(data.groups || []);
          setPredictionsCalculating(data.calculating || false);
          setPredictionsMessage(data.message || null);
        } else {
          console.error('[TournamentInfo] Failed to load predictions:', response.statusText);
        }
      } catch (error) {
        console.error("[TournamentInfo] Error loading predictions:", error);
      } finally {
        setLoadingPredictions(false);
      }
    };

    // Only load predictions if we have flights photos
    if (flightsPhotos.length > 0) {
      loadPredictions();
    }
  }, [id, flightsPhotos.length]);

  // Function to manually refresh predictions
  const refreshPredictions = async () => {
    if (!id) return;

    setLoadingPredictions(true);
    setPredictionsMessage(null);
    try {
      const response = await fetch(`/api/predictions/tournament/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPredictionGroups(data.groups || []);
        setPredictionsCalculating(data.calculating || false);
        setPredictionsMessage(data.message || null);
      }
    } catch (error) {
      console.error("[TournamentInfo] Error refreshing predictions:", error);
    } finally {
      setLoadingPredictions(false);
    }
  };

  // Function to force recalculate predictions (deletes old data first)
  const recalculatePredictions = async () => {
    if (!id) return;

    setLoadingPredictions(true);
    setPredictionsMessage(null);
    setPredictionGroups([]);
    try {
      const response = await fetch(`/api/predictions/tournament/${id}?recalculate=true`);
      if (response.ok) {
        const data = await response.json();
        setPredictionGroups(data.groups || []);
        setPredictionsCalculating(data.calculating || false);
        setPredictionsMessage(data.message || null);
      }
    } catch (error) {
      console.error("[TournamentInfo] Error recalculating predictions:", error);
    } finally {
      setLoadingPredictions(false);
    }
  };

  // Load registration status
  useEffect(() => {
    const loadRegistration = async () => {
      if (!id) return;

      setLoadingRegistration(true);
      try {
        const registrations = await api.get<any[]>('/api/tournament-registrations/my');
        const myReg = registrations.find((r: any) => r.tournament_id === id);
        setMyRegistration(myReg || null);
      } catch (error) {
        console.error('[TournamentInfo] Error loading registration:', error);
      } finally {
        setLoadingRegistration(false);
      }
    };

    loadRegistration();
  }, [id]);

  // Register for tournament
  const handleRegister = async () => {
    if (!id) return;

    setRegistering(true);
    try {
      const result = await api.post('/api/tournament-registrations', { tournamentId: id });
      setMyRegistration(result);
    } catch (error: any) {
      console.error('[TournamentInfo] Error registering:', error);
    } finally {
      setRegistering(false);
    }
  };

  // Cancel registration
  const handleCancelRegistration = async () => {
    if (!myRegistration) return;

    try {
      await api.delete(`/api/tournament-registrations/${myRegistration.id}`);
      setMyRegistration(null);
    } catch (error: any) {
      console.error('[TournamentInfo] Error canceling registration:', error);
    }
  };

  // Check if registration is closed (1 day before tournament)
  const isRegistrationClosed = () => {
    if (!tournament) return true;
    const oneDayBefore = tournamentStartDate(tournament);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    return new Date() >= oneDayBefore;
  };

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🏌️</div>
          <div className="text-lg font-semibold text-foreground">Турнир не найден</div>
          <button
            onClick={() => navigate("/tournaments")}
            className="mt-4 text-sm text-action hover:underline"
          >
            Вернуться к списку турниров
          </button>
        </div>
      </div>
    );
  }

  const hasData = !!tournamentData;
  const hasApiResults = !!apiResults?.hasResults;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/tournaments")}
          className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">
            Tournament
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-0.5 leading-tight">{tournament.name}</h1>
        </div>
      </div>

      {/* Tabs */}
      {(hasData || hasApiResults || flightsPhotos.length > 0 || isTournamentUpcoming(tournament)) && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab("info")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
              activeTab === "info"
                ? "bg-action text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            О турнире
          </button>
          {isTournamentUpcoming(tournament) && (
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                activeTab === "live"
                  ? "bg-action text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Live
            </button>
          )}
          {(hasData || hasApiResults) && (
            <>
              <button
                onClick={() => setActiveTab("results")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                  activeTab === "results"
                    ? "bg-action text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Результаты
              </button>
              <button
                onClick={() => setActiveTab("nominations")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                  activeTab === "nominations"
                    ? "bg-action text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Номинации
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                  activeTab === "photos"
                    ? "bg-action text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Фотогалерея
              </button>
            </>
          )}
          {flightsPhotos.length > 0 && (
            <>
              <button
                onClick={() => setActiveTab("flights")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                  activeTab === "flights"
                    ? "bg-action text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Флайты
              </button>
              <button
                onClick={() => setActiveTab("predictions")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                  activeTab === "predictions"
                    ? "bg-action text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Наш прогноз
              </button>
            </>
          )}
        </div>
      )}

      {/* Info Tab */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-3">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {tournament.date} {tournament.month} · {tournament.day}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                      Место проведения
                    </div>
                    <div className="text-sm font-semibold text-foreground">Golf Club Minsk</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Registration Card */}
          <Card className="p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg mb-2">Регистрация</div>

                {loadingRegistration ? (
                  <div className="text-sm text-muted-foreground">Загрузка...</div>
                ) : isRegistrationClosed() ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Регистрация закрыта</span>
                  </div>
                ) : myRegistration ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-action" />
                      <span className="text-sm font-semibold text-action">Вы зарегистрированы</span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold",
                        myRegistration.status === 'pending_review' && "bg-yellow-500/20 text-yellow-700",
                        myRegistration.status === 'awaiting_payment' && "bg-orange-500/20 text-orange-700",
                        myRegistration.status === 'paid' && "bg-green-500/20 text-green-700"
                      )}>
                        {myRegistration.status === 'pending_review' && 'Заявка на рассмотрении'}
                        {myRegistration.status === 'awaiting_payment' && 'Ожидает оплаты'}
                        {myRegistration.status === 'paid' && 'Оплачено'}
                      </div>
                    </div>

                    {/* Payment Button (visual only, for awaiting_payment status) */}
                    {myRegistration.status === 'awaiting_payment' && (
                      <button
                        onClick={() => {}}
                        className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
                      >
                        <CreditCard className="h-4 w-4" />
                        Оплатить
                      </button>
                    )}

                    {/* Cancel Button */}
                    {myRegistration.status === 'pending_review' && (
                      <button
                        onClick={handleCancelRegistration}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      >
                        <XIcon className="h-3 w-3" />
                        Отменить регистрацию
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
                  >
                    <UserPlus className="h-4 w-4" strokeWidth={2.5} />
                    {registering ? 'Отправка...' : 'Записаться'}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Live Tab — flighted leaderboard, aggregated across every registered
          player's round tagged with this tournament */}
      {activeTab === "live" && (
        <div className="space-y-4">
          <Button
            onClick={() => navigate(`/tournament/${tournament.id}`)}
            className="w-full h-12 rounded-xl font-bold text-sm bg-action hover:bg-action/90 text-action-foreground"
          >
            <Flag className="h-4 w-4 mr-2" strokeWidth={2.5} /> Начать live-scoring
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/watch/${tournament.id}`, "_blank")}
            className="w-full h-12 rounded-xl font-bold text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" strokeWidth={2.5} /> Публичное табло (без входа)
          </Button>
          <TournamentLiveLeaderboard tournamentId={tournament.id} format={tournament.format} />
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (tournamentData || apiResults) && (
        <div className="space-y-4">
          {tournamentData ? (
            /* Hardcoded results from tournament-data.ts */
            tournamentData.groups.map((group, idx) => (
              <Card key={idx} className="overflow-hidden shadow-soft">
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <div className="font-bold text-sm text-foreground">{group.name}</div>
                  {group.format && (
                    <div className="text-xs text-muted-foreground mt-0.5">{group.format}</div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-12">
                          #
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Игрок
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">
                          Счет
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.results.slice(0, 10).map((result, ridx) => (
                        <tr key={ridx} className={cn(result.place <= 3 && "bg-action/5")}>
                          <td className="px-3 py-2.5 font-bold text-foreground">
                            {result.place <= 3 ? (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold",
                                  result.place === 1 && "bg-yellow-500 text-black",
                                  result.place === 2 && "bg-gray-400 text-white",
                                  result.place === 3 && "bg-orange-600 text-white"
                                )}
                              >
                                {result.place}
                              </span>
                            ) : (
                              result.place
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-foreground font-medium">{result.player}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                            {result.total || result.score || result.net || result.gross}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          ) : apiResults?.groups ? (
            /* API results from database */
            apiResults.groups.map((group: any, idx: number) => (
              <Card key={idx} className="overflow-hidden shadow-soft">
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <div className="font-bold text-sm text-foreground">{group.name}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-12">
                          #
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Игрок
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-20">
                          Счет
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.results.map((result: any, ridx: number) => (
                        <tr key={ridx} className={cn(result.place <= 3 && "bg-action/5")}>
                          <td className="px-3 py-2.5 font-bold text-foreground">
                            {result.place <= 3 ? (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold",
                                  result.place === 1 && "bg-yellow-500 text-black",
                                  result.place === 2 && "bg-gray-400 text-white",
                                  result.place === 3 && "bg-orange-600 text-white"
                                )}
                              >
                                {result.place}
                              </span>
                            ) : (
                              result.place
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-foreground font-medium">{result.player_name}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                            {result.score}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          ) : null}
        </div>
      )}

      {/* Nominations Tab */}
      {activeTab === "nominations" && tournamentData && (
        <Card className="overflow-hidden shadow-soft">
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
            <Award className="h-4 w-4 text-action" />
            <div className="font-bold text-sm text-foreground">Специальные номинации</div>
          </div>
          <div className="divide-y divide-border">
            {tournamentData.nominations.map((nom, idx) => (
              <div key={idx} className="px-4 py-3 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-action/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-action" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                    {nom.title}
                  </div>
                  <div className="text-sm font-bold text-foreground">{nom.winner}</div>
                  {nom.value && (
                    <div className="text-xs text-muted-foreground mt-0.5">{nom.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && tournamentData && (
        <Card className="overflow-hidden shadow-soft">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-action" />
              <div className="text-sm font-bold text-foreground">
                Фотогалерея ({tournamentData.photos.length})
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {tournamentData.photos.map((photo, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhoto(photo)}
                  className="aspect-[4/3] rounded-xl overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img
                    src={photo}
                    alt={`Фото ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Predictions Tab */}
      {activeTab === "predictions" && (
        <Card className="overflow-hidden shadow-soft">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-action" />
                  <div className="text-sm font-bold text-foreground">
                    Наш прогноз шансов на победу
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  На основе исторических данных и статистики
                </div>
              </div>
              {predictionGroups.length > 0 && !loadingPredictions && (
                <button
                  onClick={recalculatePredictions}
                  className="px-3 py-1.5 bg-action/10 text-action rounded-lg text-xs font-semibold hover:bg-action/20 transition-colors"
                >
                  Пересчитать
                </button>
              )}
            </div>
          </div>
          {loadingPredictions ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <div className="text-sm font-semibold text-foreground mb-1">
                Загружаю прогнозы...
              </div>
            </div>
          ) : predictionsCalculating || (predictionGroups.length === 0 && predictionsMessage) ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">⏳</div>
              <div className="text-sm font-semibold text-foreground mb-2">
                AI анализирует участников
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                {predictionsMessage || 'Анализ запущен. Это займет несколько минут.'}
              </div>
              <button
                onClick={refreshPredictions}
                className="px-4 py-2 bg-action text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Обновить
              </button>
            </div>
          ) : predictionGroups.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Недостаточно данных для прогноза
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {predictionGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
                    <div className="text-sm font-bold text-foreground">{group.groupName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Топ-3 претендентов
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {group.predictions.map((pred, index) => (
                        <div key={index} className="px-4 py-3 flex items-center gap-3 bg-card">
                          <div className="w-8 shrink-0 text-center">
                            {index === 0 && <span className="text-xl">🥇</span>}
                            {index === 1 && <span className="text-xl">🥈</span>}
                            {index === 2 && <span className="text-xl">🥉</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{pred.playerName}</div>
                            <div className="text-xs text-muted-foreground">
                              HCP: {pred.playerHcp ? Number(pred.playerHcp).toFixed(1) : 'н/д'}
                              {pred.stats && (
                                <> · {pred.stats.totalTournaments} турниров · {pred.stats.wins} побед</>
                              )}
                            </div>
                            {pred.analysis && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {pred.analysis}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Flights Tab */}
      {activeTab === "flights" && (
        <Card className="overflow-hidden shadow-soft">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-action" />
              <div className="text-sm font-bold text-foreground">
                Флайты ({flightsPhotos.length})
              </div>
            </div>
          </div>
          {loadingFlights ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Загрузка...
            </div>
          ) : flightsPhotos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Фото флайтов пока не загружены
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-1 gap-3">
                {flightsPhotos.map((fileId, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhoto(`/api/tournaments/telegram-photo/${fileId}`)}
                    className="rounded-xl overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={`/api/tournaments/telegram-photo/${fileId}`}
                      alt={`Флайт ${idx + 1}`}
                      className="w-full h-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* No Data Message */}
      {!hasData && flightsPhotos.length === 0 && (
        <Card className="p-6 text-center shadow-soft">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-sm font-semibold text-foreground mb-1">Турнир запланирован</div>
          <div className="text-xs text-muted-foreground">
            Результаты будут доступны после завершения турнира
          </div>
        </Card>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors z-10"
            >
              ✕
            </button>
            <img
              src={selectedPhoto}
              alt="Фото турнира"
              className="w-full h-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentInfoPage;
