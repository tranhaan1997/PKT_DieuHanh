/**
 * Design tokens — single source of truth for the whole frontend.
 *
 * Used by the MUI theme (`theme/index.ts`), the AG Grid theme
 * (`theme/agGridTheme.ts`) and every shared UI component. Pages MUST
 * reference these tokens instead of hardcoding hex values or font sizes.
 */

/* ─── Palette ─────────────────────────────────────────────────────── */
export const palette = {
  brand:  { main: '#2D6CDF', dark: '#1B4DA6', light: '#5B8FF0', soft: '#E8F0FE' },
  accent: { main: '#0EA5A4', dark: '#0A7E7D', light: '#2BC4C2' },

  /* sidebar / light-blue surfaces */
  sidebar: {
    bgTop:    '#F5F8FF',
    bgBottom: '#EEF3FB',
    line:     '#D8E4F8',
    line2:    '#C8D8F2',
    textDim:  '#5A7299',
    textMute: '#8AA0C0',
    textBright: '#1A2E4A',
    activeBg: 'rgba(45,108,223,0.12)',
    activeBar:'#2D6CDF',
  },

  /* light surfaces */
  bg:      '#F4F6FB',
  card:    '#FFFFFF',
  cardAlt: '#F8FAFD',
  border:  '#E3E8F0',
  borderStrong: '#D2DAE6',
  divider: '#EAEEF5',

  text: {
    primary:   '#0F1B2D',
    secondary: '#5A6B82',
    muted:     '#8A99AD',
    faint:     '#AEB9CA',
  },
} as const;

/* ─── Status family ───────────────────────────────────────────────────
 * ONE source for SLA states, role chips, active/disabled chips and
 * grid cell highlights. Each tone has solid / fg(text) / bg(soft) / border.
 */
export interface StatusTone { solid: string; fg: string; bg: string; border: string }

export const status = {
  success: { solid: '#16A34A', fg: '#15803D', bg: '#E8F6EE', border: '#BBE6CA' },
  info:    { solid: '#2563EB', fg: '#1D4ED8', bg: '#E8F0FE', border: '#C2D6F7' },
  warning: { solid: '#D97706', fg: '#B45309', bg: '#FEF3E2', border: '#F5D9A8' },
  error:   { solid: '#DC2626', fg: '#B91C1C', bg: '#FDECEC', border: '#F4C2C2' },
  neutral: { solid: '#64748B', fg: '#475569', bg: '#EEF1F6', border: '#D8DFE9' },
  purple:  { solid: '#7C3AED', fg: '#6D28D9', bg: '#F1ECFD', border: '#DDD0F7' },
} as const;

export type StatusKey = keyof typeof status;

/* SLA label → status tone (used by WorkOrders row/cell/legend) */
export const SLA_STATUS: Record<string, StatusKey> = {
  'Hoàn thành':  'success',
  'Đúng hạn':    'info',
  'Sắp quá hạn': 'warning',
  'Quá hạn':     'error',
};

/* ─── Typography scale ────────────────────────────────────────────── */
export const font = {
  family: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  pageTitle:    { size: '1.375rem',  weight: 700, lh: 1.2 },
  pageSubtitle: { size: '0.8125rem', weight: 400, lh: 1.45 },
  sectionTitle: { size: '0.9375rem', weight: 700, lh: 1.3 },
  body:         { size: '0.875rem',  weight: 400, lh: 1.55 },
  table:        { size: '0.8125rem', weight: 400, lh: 1.4 },
  caption:      { size: '0.75rem',   weight: 400, lh: 1.4 },
  overline:     { size: '0.6875rem', weight: 700, lh: 1.3, ls: '0.07em' },
} as const;

/* ─── Radii ───────────────────────────────────────────────────────── */
export const radius = {
  card: 14,
  control: 9,
  chip: 6,
  grid: 12,
} as const;

/* ─── Shadows (soft, layered, low-opacity) ────────────────────────── */
export const shadow = {
  xs: '0 1px 2px rgba(15,27,45,0.05)',
  sm: '0 2px 6px rgba(15,27,45,0.06), 0 1px 2px rgba(15,27,45,0.04)',
  md: '0 6px 18px rgba(15,27,45,0.08), 0 2px 6px rgba(15,27,45,0.05)',
  lg: '0 14px 36px rgba(15,27,45,0.12), 0 4px 12px rgba(15,27,45,0.07)',
  xl: '0 24px 60px rgba(15,27,45,0.16)',
} as const;

/* ─── Grid density ────────────────────────────────────────────────── */
export const grid = {
  rowHeight: 40,
  headerHeight: 44,
  fontSize: 13,
} as const;

export const tokens = { palette, status, SLA_STATUS, font, radius, shadow, grid };
export default tokens;
