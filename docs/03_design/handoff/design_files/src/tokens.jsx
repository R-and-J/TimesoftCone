// Design tokens — color palettes, type scale, helpers.
// All palettes keep #e3f0ff + white as the base; only accents vary.

const PALETTES = {
  cobalt: {
    name: 'Cobalt · 토스블루',
    bg: '#e3f0ff',
    bgDeep: '#cfe2ff',
    surface: '#ffffff',
    ink: '#0B1929',
    inkSoft: '#3b4a5e',
    inkMuted: '#8392a7',
    line: '#dde6f3',
    accent: '#1B64DA',
    accentDeep: '#0E4BB0',
    accentSoft: '#eef4ff',
    success: '#16A07A',
    warn: '#E08B19',
    danger: '#DC3F4A',
  },
  indigo: {
    name: 'Indigo · 임프레션',
    bg: '#e3f0ff',
    bgDeep: '#d8ddff',
    surface: '#ffffff',
    ink: '#0E1240',
    inkSoft: '#3F4474',
    inkMuted: '#8A8FB5',
    line: '#dde0f3',
    accent: '#4F46E5',
    accentDeep: '#3730BA',
    accentSoft: '#eef0ff',
    success: '#16A07A',
    warn: '#E08B19',
    danger: '#DC3F4A',
  },
  navy: {
    name: 'Navy · 진중함',
    bg: '#e3f0ff',
    bgDeep: '#cbd9ec',
    surface: '#ffffff',
    ink: '#06122a',
    inkSoft: '#2c3e5e',
    inkMuted: '#7986a0',
    line: '#dae3f0',
    accent: '#0B2A4A',
    accentDeep: '#041530',
    accentSoft: '#eaeff7',
    success: '#16A07A',
    warn: '#E08B19',
    danger: '#DC3F4A',
  },
  sky: {
    name: 'Sky · 밝게',
    bg: '#e3f0ff',
    bgDeep: '#cfe9ff',
    surface: '#ffffff',
    ink: '#0a2236',
    inkSoft: '#314a64',
    inkMuted: '#7c95ad',
    line: '#dbe7f2',
    accent: '#0EA5E9',
    accentDeep: '#0676AD',
    accentSoft: '#e7f5fd',
    success: '#16A07A',
    warn: '#E08B19',
    danger: '#DC3F4A',
  },
};

const FONT = {
  sans: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Format helpers
const fmt = {
  point: (n) => n.toLocaleString('ko-KR'),
  pointP: (n) => `${n.toLocaleString('ko-KR')} P`,
  date: (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  },
  time: (iso) => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
  },
};

window.PALETTES = PALETTES;
window.FONT = FONT;
window.RADIUS = RADIUS;
window.fmt = fmt;
