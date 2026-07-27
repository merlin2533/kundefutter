"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { Toast } from "./Toast";
import { log } from "@/lib/logger";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
}

const ToastContext = createContext<{
  showToast: (message: string, type: "success" | "error") => void;
}>({ showToast: () => {} });

export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    showToast: ctx.showToast,
    success: (message: string) => ctx.showToast(message, "success"),
    error: (message: string) => ctx.showToast(message, "error"),
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    if (type === "error") {
      // Bewusst log.warn und NICHT captureMessage: der Toast-Text ist ein
      // generischer String ohne Stacktrace ("Fehler beim Speichern"), der in
      // GlitchTip alle Aufrufstellen zu einem einzigen Issue kollabieren ließe.
      // Das aussagekräftige Issue kommt vom captureException der jeweiligen
      // Aufrufstelle bzw. der Nachweis aus lib/fetch-reporter.ts (mit Pfad +
      // Status) — der Toast landet hier nur im Log-Strom, ohne Doppelmeldung.
      log.warn(`Fehler-Toast: ${message}`, {
        quelle: "toast",
        pfad: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
