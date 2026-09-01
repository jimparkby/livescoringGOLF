import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Send } from "lucide-react";

type Status = "idle" | "waiting" | "expired" | "error";

export default function AuthPage() {
  const { signIn } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const startTelegramAuth = async () => {
    setStatus("waiting");
    try {
      const { code, deepLink } = await api.post<{ code: string; deepLink: string | null }>("/api/auth/telegram-code", {});
      if (!deepLink) {
        setStatus("error");
        return;
      }
      window.open(deepLink, "_blank");

      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get<{ jwt?: string; pending?: boolean }>(`/api/auth/telegram-code/${code}`);
          if (data.jwt) {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            await signIn(data.jwt);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("expired");
        }
      }, 2500);

      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus((s) => (s === "waiting" ? "expired" : s));
      }, 10 * 60_000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="font-black text-3xl tracking-wider text-foreground">GOLF CLUB MINSK</div>
        <div className="text-xs text-muted-foreground uppercase tracking-[0.25em] mt-1 mb-10">Live Scoring</div>

        <button
          onClick={startTelegramAuth}
          disabled={status === "waiting"}
          className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2.5 disabled:opacity-70 transition-colors"
          style={{ background: "#15361f" }}
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
          {status === "waiting" ? "Ждём подтверждения в Telegram…" : "Войти через Telegram"}
        </button>

        {status === "waiting" && (
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            Откроется Telegram — нажмите <b>Start</b> в чате с ботом, и вы автоматически вернётесь сюда авторизованным.
          </p>
        )}
        {status === "expired" && (
          <p className="text-xs mt-4 leading-relaxed" style={{ color: "#a5822f" }}>
            Ссылка для входа истекла. Нажмите кнопку ещё раз.
          </p>
        )}
        {status === "error" && (
          <p className="text-xs mt-4 leading-relaxed text-destructive">
            Бот сейчас недоступен. Попробуйте немного позже.
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed">
          Доступ только для членов Golf Club Minsk — бот проверит вас по списку клуба при первом входе.
        </p>
      </div>
    </div>
  );
}
