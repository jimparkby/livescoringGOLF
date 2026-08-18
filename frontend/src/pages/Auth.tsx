import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export default function AuthPage() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ jwt: string; error?: string }>("/api/auth/login", { email, password });
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

        <form onSubmit={submit} className="space-y-3">
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
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:border-action focus:outline-none text-sm"
          />

          {error && (
            <div className="text-sm text-red-500 leading-relaxed">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-sm bg-action hover:bg-action/90 text-action-foreground disabled:opacity-60 transition-colors"
          >
            {loading ? "..." : "Войти"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          Доступ только для членов Golf Club Minsk. Обратитесь к администратору клуба, если у вас
          ещё нет аккаунта.
        </p>
      </div>
    </div>
  );
}
