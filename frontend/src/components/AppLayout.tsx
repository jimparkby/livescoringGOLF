import { NavLink, Outlet } from "react-router-dom";
import { Trophy, CircleUserRound, LineChart, Flag, MapPin, LogOut, UserRound, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGolf } from "@/store/golfStore";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const navLinks = [
  { to: "/", label: "Tournaments", icon: Trophy, end: true },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/course", label: "Course", icon: MapPin },
  { to: "/play", label: "Play", icon: Flag },
  { to: "/stats", label: "Handicap", icon: LineChart },
];

const AppLayout = () => {
  const { userId, signOut } = useAuth();
  const { profile } = useGolf();
  const { isAdmin } = useIsAdmin();

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Player";
  const initials = (profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30" style={{ background: "#000000" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <NavLink to="/" className="font-black tracking-wider text-sm sm:text-base shrink-0 text-white">
            GOLF CLUB MINSK
          </NavLink>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto overflow-y-hidden">
            {navLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-1.5 h-9 px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive ? "text-white" : "text-white/55 hover:text-white/85",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                    {label}
                    {isActive && <span className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-white" />}
                  </>
                )}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive ? "text-white" : "text-white/55 hover:text-white/85",
                  )
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          {userId ? (
            <>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 h-9 pl-1 pr-3 rounded-full shrink-0 transition-colors",
                    isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-white/15 grid place-items-center text-[11px] font-bold">
                    {initials || <CircleUserRound className="h-4 w-4" />}
                  </span>
                )}
                <span className="text-sm font-semibold hidden sm:inline">{name}</span>
              </NavLink>

              <button
                onClick={signOut}
                title="Выйти"
                className="h-9 w-9 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </>
          ) : (
            <NavLink
              to="/profile"
              className="group flex items-center gap-2 h-9 pl-1.5 pr-4 rounded-full text-sm font-semibold bg-white text-black hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
            >
              <span className="h-6 w-6 rounded-full bg-black/10 grid place-items-center group-hover:bg-black/15 transition-colors">
                <UserRound className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              Войти
            </NavLink>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
