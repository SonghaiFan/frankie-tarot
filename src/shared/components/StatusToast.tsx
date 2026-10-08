import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CheckCircle2 } from "lucide-react";

interface StatusToastProps {
  open: boolean;
  variant: "warning" | "success";
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  placement?: "top" | "bottom";
}

export default function StatusToast({ open, variant, title, message, action, placement = "top" }: StatusToastProps) {
  const Icon = variant === "warning" ? CircleAlert : CheckCircle2;
  const toast = (
    <AnimatePresence>
      {open && (
        <motion.div
          key={`${variant}-${title}`}
          role={variant === "warning" ? "alert" : "status"}
          aria-live={variant === "warning" ? "assertive" : "polite"}
          aria-atomic="true"
          initial={{ opacity: 0, y: placement === "top" ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: placement === "top" ? -8 : 8 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-x-4 z-[260] mx-auto flex w-auto max-w-md items-start gap-3 border border-white/20 bg-[#080812]/90 px-4 py-3 text-left text-neutral-200 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:inset-x-0 ${placement === "top" ? "top-[calc(var(--safe-top)+1rem)]" : "bottom-[calc(var(--safe-bottom)+1rem)]"}`}
        >
          <Icon aria-hidden="true" size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-white/70" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-sm tracking-wide text-white/90">{title}</p>
            {message && <p className="mt-1 break-words font-sans text-xs leading-relaxed text-neutral-400">{message}</p>}
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="shrink-0 border border-white/15 px-3 py-1.5 font-sans text-[10px] tracking-[0.14em] text-white/70 transition-colors hover:border-white/45 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              {action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document === "undefined" ? null : createPortal(toast, document.body);
}
