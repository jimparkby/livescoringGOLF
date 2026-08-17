import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DemoPage from "./pages/Demo";
import LiveScoringPage from "./pages/LiveScoring";
import PublicLeaderboardPage from "./pages/PublicLeaderboard";
import AuthPage from "./pages/Auth";
import PlayPage from "./pages/Play";
import TournamentsPage from "./pages/Tournaments";
import TournamentInfoPage from "./pages/TournamentInfo";
import TournamentPlayPage from "./pages/TournamentPlay";
import CreateTournamentPage from "./pages/CreateTournament";
import StatsPage from "./pages/Stats";
import StatisticsPage from "./pages/Statistics";
import ProfilePage from "./pages/Profile";
import LeaderboardPage from "./pages/Leaderboard";
import CoursePage from "./pages/Course";
import AdminPage from "./pages/Admin";
import BookingPage from "./pages/Booking";
import TournamentRegistrationsPage from "./pages/TournamentRegistrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { userId, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="text-center text-primary-foreground">
          <div className="text-5xl mb-3">⛳</div>
          <div className="text-sm opacity-70 tracking-widest uppercase">Loading…</div>
        </div>
      </div>
    );
  }

  if (!userId) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TournamentsPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournament-info/:id" element={<TournamentInfoPage />} />
        <Route path="/tournament/:id" element={<TournamentPlayPage />} />
        <Route path="/create-tournament" element={<CreateTournamentPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/course" element={<CoursePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/tournament-registrations/:id" element={<TournamentRegistrationsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/live/:code" element={<LiveScoringPage />} />
            <Route path="/watch/:id" element={<PublicLeaderboardPage />} />
            <Route
              path="/*"
              element={
                <AuthProvider>
                  <AppRoutes />
                </AuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
