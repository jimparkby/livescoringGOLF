import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  roundId: string;
  onClose: () => void;
};

export const ShareRoundModal = ({ roundId, onClose }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .post<{ shareCode: string }>(`/api/rounds/${roundId}/share`, {})
      .then(({ shareCode }) => setUrl(`${window.location.origin}/live/${shareCode}`))
      .catch(() => toast.error("Не удалось создать ссылку"))
      .finally(() => setLoading(false));
  }, [roundId]);

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full animate-in slide-in-from-bottom duration-250 flex flex-col items-center bg-card border-t rounded-t-3xl"
        style={{ borderColor: "#c9a24b", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1 bg-border" />
        <div className="flex items-center justify-between w-full px-5 py-3 border-b border-border">
          <div className="font-display font-semibold text-foreground">QR для участников</div>
          <button onClick={onClose} className="h-9 w-9 rounded-full grid place-items-center border border-border">
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col items-center gap-4 w-full">
          <p className="text-muted-foreground text-xs text-center max-w-xs">
            Отсканировавший может вводить счёт за любого игрока раунда — без входа в аккаунт.
          </p>
          {loading ? (
            <div className="h-6 w-6 rounded-full border-2 border-action border-t-transparent animate-spin" />
          ) : url ? (
            <>
              <div className="p-4 bg-white border border-border rounded-2xl">
                <QRCodeSVG value={url} size={200} />
              </div>
              <button
                onClick={copyLink}
                className="w-full max-w-xs h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-action text-action-foreground"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Скопировано" : "Скопировать ссылку"}
              </button>
              <div className="text-muted-foreground text-[11px] break-all text-center max-w-xs">{url}</div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Ошибка загрузки</div>
          )}
        </div>
      </div>
    </div>
  );
};
