import { useState } from "react";
import { X, Send } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Props = {
  registrationId: number;
  playerName: string;
  initialInvoiceNumber?: string | null;
  onClose: () => void;
  onSent: (invoiceNumber: string, deadlineLabel: string | null) => void;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const SendInvoiceModal = ({ registrationId, playerName, initialInvoiceNumber, onClose, onSent }: Props) => {
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber ?? "");
  const [deadlineDate, setDeadlineDate] = useState(todayISO());
  const [deadlineTime, setDeadlineTime] = useState("12:00");
  const [sending, setSending] = useState(false);

  const deadlineLabel = deadlineDate
    ? `${deadlineDate.slice(8, 10)}.${deadlineDate.slice(5, 7)} до ${deadlineTime}`
    : null;

  const send = async () => {
    if (!invoiceNumber.trim()) {
      toast.error("Укажите номер счёта");
      return;
    }
    setSending(true);
    try {
      await api.patch(`/api/tournament-registrations/${registrationId}/status`, {
        status: "awaiting_payment",
        invoiceNumber: invoiceNumber.trim(),
        deadlineLabel,
      });
      toast.success("Счёт отправлен");
      onSent(invoiceNumber.trim(), deadlineLabel);
    } catch {
      toast.error("Не удалось отправить счёт");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end animate-in fade-in duration-150">
      <button className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl animate-in slide-in-from-bottom duration-250"
        style={{ background: "#1a1a1a", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-1" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="flex items-center justify-between w-full px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-white font-bold">Счёт на оплату — {playerName}</div>
          <button onClick={onClose} className="h-9 w-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-white/50 text-xs">
            Игроку придёт сообщение от бота с реквизитами ЕРИП и этим номером счёта.
          </p>

          <label className="block">
            <div className="text-xs text-white/50 mb-1">Номер счёта</div>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Например, 7025"
              className="w-full h-11 rounded-xl px-3 text-sm outline-none text-white"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-xs text-white/50 mb-1">Оплатить до</div>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-sm outline-none text-white"
                style={{ background: "rgba(255,255,255,0.08)" }}
              />
            </label>
            <label className="block">
              <div className="text-xs text-white/50 mb-1">Время</div>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-sm outline-none text-white"
                style={{ background: "rgba(255,255,255,0.08)" }}
              />
            </label>
          </div>

          <button
            onClick={send}
            disabled={sending}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "#22c55e", color: "#000" }}
          >
            <Send className="h-4 w-4" strokeWidth={2.5} />
            {sending ? "Отправляю…" : "Отправить счёт"}
          </button>
        </div>
      </div>
    </div>
  );
};
