// Tiny toast — top-right, auto-dismiss after 4s. No dependency. Matches
// the README spec ("토스트 위치: 우상단, 4초 자동 닫힘").

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { PALETTES } from "./tokens";

type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; kind: ToastKind; message: string };

type Ctx = {
  push: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const p = PALETTES.cobalt;
  const colors: Record<ToastKind, { bg: string; fg: string }> = {
    success: { bg: p.success, fg: "#fff" },
    error: { bg: p.danger, fg: "#fff" },
    info: { bg: p.ink, fg: "#fff" },
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              background: colors[t.kind].bg,
              color: colors[t.kind].fg,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              maxWidth: 360,
              letterSpacing: "-0.01em",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
