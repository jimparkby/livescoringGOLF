import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

type Mode = "login" | "register";

export default function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, firstName, lastName };
      const data = await api.post<{ jwt: string; error?: string }>(path, body);
      await signIn(data.jwt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-black text-3xl tracking-wider text-foreground">GOLF CLUB MINSK</div>
          <div className="text-xs text-muted-foreground uppercase tracking-[0.25em] mt-1">Live Scoring</div>
        </div>

        <div className="flex rounded-xl bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "login" ? "bg-action text-action-foreground" : "text-muted-foreground"}`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "register" ? "bg-action text-action-foreground" : "text-muted-foreground"}`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Имя"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:border-action focus:outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Фамилия"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:border-action focus:outline-none text-sm"
              />
            </div>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:border-action focus:outline-none text-sm"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:border-action focus:outline-none text-sm"
          />

          {mode === "register" && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Регистрация доступна только членам Golf Club Minsk — имя и фамилия сверяются со
              списком клуба.
            </p>
          )}

          {error && (
            <div className="text-sm text-red-400 leading-relaxed">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-sm bg-action hover:bg-action/90 text-action-foreground disabled:opacity-60 transition-colors"
          >
            {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
