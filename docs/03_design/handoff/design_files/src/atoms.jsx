// Shared UI atoms — buttons, cards, pills, icons. All read from `p` (palette).
// Pass palette as prop; never hardcode colors.

const Card = ({ p, padding = 24, children, style, onClick, hover }) => (
  <div
    onClick={onClick}
    style={{
      background: p.surface,
      borderRadius: 20,
      padding,
      boxShadow: '0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform .15s, box-shadow .15s',
      ...style,
    }}
    onMouseEnter={hover ? (e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 1px 0 rgba(11,25,41,0.04), 0 14px 32px rgba(11,25,41,0.08)';
    } : undefined}
    onMouseLeave={hover ? (e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)';
    } : undefined}
  >
    {children}
  </div>
);

const Btn = ({ p, variant = 'primary', size = 'md', children, onClick, disabled, style, full }) => {
  const sizes = {
    sm: { h: 36, px: 14, fs: 14, br: 10 },
    md: { h: 44, px: 18, fs: 15, br: 12 },
    lg: { h: 56, px: 24, fs: 17, br: 14 },
    xl: { h: 64, px: 32, fs: 18, br: 16 },
  }[size];
  const variants = {
    primary: { bg: p.accent, fg: '#fff', border: 'transparent' },
    dark: { bg: p.ink, fg: '#fff', border: 'transparent' },
    soft: { bg: p.accentSoft, fg: p.accent, border: 'transparent' },
    ghost: { bg: 'transparent', fg: p.inkSoft, border: p.line },
    danger: { bg: p.danger, fg: '#fff', border: 'transparent' },
  }[variant];
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        fontSize: sizes.fs,
        fontWeight: 600,
        borderRadius: sizes.br,
        background: variants.bg,
        color: variants.fg,
        border: `1px solid ${variants.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        width: full ? '100%' : undefined,
        letterSpacing: '-0.01em',
        transition: 'filter .12s, transform .08s',
        ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.985)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
};

const Pill = ({ p, tone = 'neutral', children, size = 'md', style }) => {
  const tones = {
    neutral: { bg: '#F3F5F8', fg: p.inkSoft },
    accent: { bg: p.accentSoft, fg: p.accent },
    success: { bg: '#E6F6F0', fg: p.success },
    warn: { bg: '#FFF4E0', fg: p.warn },
    danger: { bg: '#FDECEE', fg: p.danger },
    live: { bg: p.danger, fg: '#fff' },
    dark: { bg: p.ink, fg: '#fff' },
  }[tone];
  const sz = size === 'sm' ? { fs: 11, px: 8, h: 20 } : { fs: 12, px: 10, h: 24 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: tones.bg, color: tones.fg,
      fontSize: sz.fs, fontWeight: 600, height: sz.h, padding: `0 ${sz.px}px`,
      borderRadius: 999, letterSpacing: '-0.01em',
      ...style,
    }}>
      {children}
    </span>
  );
};

// Simple SVG icons used across the app
const Icon = {
  arrow: (sz = 16) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chev: (sz = 16, dir = 'right') => {
    const r = { up: 270, down: 90, left: 180, right: 0 }[dir];
    return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${r}deg)` }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  },
  bell: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM9 18a3 3 0 006 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  search: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  user: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  cal: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  spark: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  trophy: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M7 4h10v6a5 5 0 01-10 0V4zM3 6h4M17 6h4M9 15v3h6v-3M7 21h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  hammer: (sz = 20) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M14 4l6 6-3 3-6-6 3-3zM11 7L4 14l3 3 7-7M9 17l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  coin: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v10M9 10c0-1.5 1.5-2 3-2s3 .5 3 2-1.5 2-3 2-3 .5-3 2 1.5 2 3 2 3-.5 3-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  shield: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ledger: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  bolt: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  gift: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><rect x="3" y="9" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 14h18M12 9v12M8 9c-2 0-3-1-3-2.5S6 4 7.5 4 12 9 12 9 14 4 16.5 4 19 5 19 6.5 18 9 16 9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  clock: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  check: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus: (sz = 18) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  sort: (sz = 16) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  filter: (sz = 16) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
};

// Avatar bubble
const Avatar = ({ p, name, size = 36, bg }) => {
  const initial = (name || '?')[0];
  // Deterministic-ish color from name
  const palette = [p.accent, p.success, p.warn, '#8B5CF6', '#EC4899', '#0EA5E9'];
  const color = bg || palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      fontWeight: 700, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: '-0.01em',
      flex: '0 0 auto',
    }}>{initial}</div>
  );
};

// Section header inside an artboard
const SectionH = ({ p, eyebrow, title, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
    <div>
      {eyebrow && <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, marginBottom: 4 }}>{eyebrow}</div>}
      <div style={{ fontSize: 20, fontWeight: 700, color: p.ink, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

// Top navigation bar used in inner-app screens
const TopNav = ({ p, active = 'dashboard', user = '김기철', role = '사원' }) => {
  const items = [
    { id: 'dashboard', label: '홈' },
    { id: 'auction', label: '경매장' },
    { id: 'activity', label: '내 활동' },
    { id: 'dividend', label: '연말 배당' },
    { id: 'admin', label: '관리' },
  ];
  return (
    <div style={{
      height: 60, background: p.surface, borderBottom: `1px solid ${p.line}`,
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 32,
    }}>
      <Brand p={p} compact />
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {items.map((it) => (
          <div key={it.id} style={{
            padding: '0 14px', height: 36, display: 'flex', alignItems: 'center',
            borderRadius: 10, fontSize: 14, fontWeight: 600,
            color: active === it.id ? p.ink : p.inkMuted,
            background: active === it.id ? p.bg : 'transparent',
            cursor: 'pointer',
          }}>{it.label}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: p.inkSoft }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {Icon.search()}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          {Icon.bell()}
          <div style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, background: p.danger, borderRadius: '50%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 4px 4px', borderRadius: 22, background: p.bg }}>
          <Avatar p={p} name={user} size={32} />
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: p.ink, lineHeight: 1.1 }}>{user}</div>
            <div style={{ color: p.inkMuted, fontSize: 11 }}>{role}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Brand mark: simple wordmark "타임소프트콘" with a geometric cone/timer glyph
const Brand = ({ p, compact = false, color }) => {
  const c = color || p.ink;
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BrandGlyph color={p.accent} size={26} />
        <div style={{ fontWeight: 800, fontSize: 16, color: c, letterSpacing: '-0.025em' }}>타임소프트콘</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <BrandGlyph color={p.accent} size={40} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 22, color: c, letterSpacing: '-0.03em', lineHeight: 1 }}>타임소프트콘</div>
        <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4, letterSpacing: 0.4 }}>TIMESOFT·CONE</div>
      </div>
    </div>
  );
};

// Cone-as-hourglass mark — original geometric SVG
const BrandGlyph = ({ color = '#1B64DA', size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill={color}/>
    <path d="M12 10h16l-7 9 7 11H12l7-11-7-9z" fill="#fff" />
    <circle cx="20" cy="20" r="2" fill={color} />
  </svg>
);

// Striped image placeholder
const ImgPlaceholder = ({ p, label, h = 120, w }) => (
  <div style={{
    width: w || '100%', height: h, borderRadius: 12,
    background: `repeating-linear-gradient(135deg, ${p.bgDeep} 0 8px, ${p.bg} 8px 16px)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT.mono, fontSize: 11, color: p.inkMuted, fontWeight: 500,
    letterSpacing: 0.2,
  }}>{label}</div>
);

// Donut chart for stake visualization
const Donut = ({ size = 200, thickness = 32, segments, ringBg = '#eef0f3' }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringBg} strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = c * seg.value;
        const el = (
          <circle key={i}
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            strokeLinecap={seg.cap || 'butt'}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

// Sparkline (mini area chart)
const Spark = ({ data, w = 200, h = 50, color = '#1B64DA', fill }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y];
  });
  const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
  const dFill = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {fill && <path d={dFill} fill={fill} opacity={0.4}/>}
      <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

Object.assign(window, {
  Card, Btn, Pill, Icon, Avatar, SectionH, TopNav, Brand, BrandGlyph, ImgPlaceholder, Donut, Spark,
});
