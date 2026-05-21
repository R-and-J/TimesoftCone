import type { CSSProperties, ReactNode, MouseEvent } from "react";
import type { Palette } from "@/lib/tokens";

type Props = {
  p: Palette;
  padding?: number | string;
  hover?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  children?: ReactNode;
};

export function Card({ p, padding = 24, hover, style, onClick, children }: Props) {
  const enter = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow =
      "0 1px 0 rgba(11,25,41,0.04), 0 14px 32px rgba(11,25,41,0.08)";
  };
  const leave = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow =
      "0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)";
  };
  return (
    <div
      onClick={onClick}
      onMouseEnter={hover ? enter : undefined}
      onMouseLeave={hover ? leave : undefined}
      style={{
        background: p.surface,
        borderRadius: 20,
        padding,
        boxShadow:
          "0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform .15s, box-shadow .15s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
