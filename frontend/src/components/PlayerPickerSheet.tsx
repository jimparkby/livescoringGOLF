import { useState, useEffect } from "react";
import { Avatar } from "@/components/PlayerAvatar";
import { type Player } from "@/store/golfStore";
import { api } from "@/lib/api";
import { X, Search } from "lucide-react";

type UserResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  hcp: number | null;
  photo_url: string | null;
};

const mkName = (u: UserResult) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Player";
const mkInitials = (name: string) =>
  name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export const PlayerPickerSheet = ({
  players,
  onAdd,
  onClose,
}: {
  players: Player[];
  onAdd: (p: Player) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserResult[]>("/api/users/all")
      .then(setAllUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allUsers.filter((u) => {
        const n = mkName(u).toLowerCase();
        const un = (u.username ?? "").toLowerCase();
        return n.includes(q) || un.includes(q);
      })
    : allUsers;

  const alreadyAdded = (id: string) => !!players.find((p) => p.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full animate-in slide-in-from-bottom duration-250 flex flex-col bg-card border-t rounded-t-3xl"
        style={{ borderColor: "#c9a24b", maxHeight: "85vh", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-4 bg-border" />
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="font-display font-semibold text-lg text-foreground">Добавить игрока</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full grid place-items-center border border-border">
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Имя или @username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-sm outline-none bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-3 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {q ? "Никого не найдено" : "Нет других игроков"}
            </div>
          ) : (
            filtered.map((u) => {
              const n = mkName(u);
              const added = alreadyAdded(u.id);
              return (
                <button
                  key={u.id}
                  disabled={added}
                  onClick={() =>
                    onAdd({
                      id: u.id,
                      name: n,
                      initials: mkInitials(n),
                      hcp: u.hcp ?? 0,
                      photoUrl: u.photo_url ?? undefined,
                    })
                  }
                  className="w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-40 hover:bg-muted/50"
                >
                  {u.photo_url ? (
                    <img src={u.photo_url} alt={n} className="h-12 w-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <Avatar name={n} tone="muted" />
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold truncate text-foreground">{n}</div>
                    <div className="text-xs truncate text-muted-foreground">
                      {u.username ? `@${u.username}` : `HCP ${u.hcp ?? "—"}`}
                    </div>
                  </div>
                  {added ? (
                    <div className="text-xs font-semibold shrink-0 text-muted-foreground">Добавлен</div>
                  ) : (
                    <div className="text-sm font-semibold shrink-0 text-action">+ Add</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
