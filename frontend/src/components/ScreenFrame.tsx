import type { ReactNode } from "react";

type Props = { children: ReactNode };

// Full-bleed app frame. Each screen's outer div carries its own bg color;
// when the viewport is wider than 1440, the body's bg (set in globals.css to
// match the cobalt page bg) fills the sides seamlessly. No canvas / shadow /
// rounded — this is meant to feel like a real web app, not a Figma artboard.
export function ScreenFrame({ children }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}
