// Inline SVG icons — kept faithful to the original design (matches stroke/weight).
// Could be migrated to lucide-react later via the mapping in handoff component_inventory.md.
import type { CSSProperties } from "react";

type IconProps = { size?: number; style?: CSSProperties };

const wrap = (sz: number, children: React.ReactNode, style?: CSSProperties) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" style={style}>
    {children}
  </svg>
);

export const Icon = {
  arrow: ({ size = 16 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  chev: ({ size = 16, dir = "right" }: IconProps & { dir?: "up" | "down" | "left" | "right" } = {}) => {
    const r = { up: 270, down: 90, left: 180, right: 0 }[dir];
    return wrap(
      size,
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
      { transform: `rotate(${r}deg)` },
    );
  },
  bell: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M6 8a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM9 18a3 3 0 006 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  search: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>,
    ),
  user: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>,
    ),
  cal: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>,
    ),
  spark: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
    ),
  trophy: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M7 4h10v6a5 5 0 01-10 0V4zM3 6h4M17 6h4M9 15v3h6v-3M7 21h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  hammer: ({ size = 20 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M14 4l6 6-3 3-6-6 3-3zM11 7L4 14l3 3 7-7M9 17l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  coin: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v10M9 10c0-1.5 1.5-2 3-2s3 .5 3 2-1.5 2-3 2-3 .5-3 2 1.5 2 3 2 3-.5 3-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>,
    ),
  shield: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  ledger: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>,
    ),
  bolt: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    ),
  gift: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <rect x="3" y="9" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 14h18M12 9v12M8 9c-2 0-3-1-3-2.5S6 4 7.5 4 12 9 12 9 14 4 16.5 4 19 5 19 6.5 18 9 16 9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </>,
    ),
  clock: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>,
    ),
  check: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  x: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    ),
  plus: ({ size = 18 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    ),
  sort: ({ size = 16 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    ),
  filter: ({ size = 16 }: IconProps = {}) =>
    wrap(
      size,
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    ),
};
