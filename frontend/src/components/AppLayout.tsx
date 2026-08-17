import { NavLink, Outlet } from "react-router-dom";
import { Trophy, CircleUserRound, LineChart, Flag, MapPin, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGolf } from "@/store/golfStore";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const navLinks = [
  { to: "/", label: "Tournaments", icon: Trophy, end: true },
  { to: "/course", label: "Course", icon: MapPin },
  { to: "/play", label: "Play", icon: Flag },
  { to: "/stats", label: "Stats", icon: LineChart },
];

const AppLayout = () => {
  const { signOut } = useAuth();
  const { profile } = useGolf();
  const { isAdmin } = useIsAdmin();

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Player";
  const initials = (profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <NavLink to="/" className="font-black tracking-wider text-sm sm:text-base shrink-0">
            GOLF CLUB MINSK
          </NavLink>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            {navLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive ? "bg-action/15 text-action" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive ? "bg-action/15 text-action" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 h-9 pl-1 pr-3 rounded-full shrink-0 transition-colors",
                isActive ? "bg-action/15 text-action" : "hover:bg-muted",
              )
            }
          >
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={name} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="h-7 w-7 rounded-full bg-muted-foreground/20 grid place-items-center text-[11px] font-bold">
                {initials || <CircleUserRound className="h-4 w-4" />}
              </span>
            )}
            <span className="text-sm font-semibold hidden sm:inline">{name}</span>
          </NavLink>

          <button
            onClick={signOut}
            title="Выйти"
            className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
