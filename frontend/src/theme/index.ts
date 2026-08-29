import { createTheme } from '@mui/material/styles';
import { palette, status, font, radius, shadow } from './tokens';
import DraggablePaper from '../components/ui/DraggablePaper';

/**
 * MUI theme built entirely from design tokens (`theme/tokens.ts`).
 * Component overrides cover Button / Card / Chip / Input / Dialog /
 * Tooltip / Alert / Tabs. The data grid is handled separately by AG Grid
 * (`theme/agGridTheme.ts`), so there is intentionally no MuiDataGrid override.
 */
export const theme = createTheme({
  palette: {
    primary:   { main: palette.brand.main, light: palette.brand.light, dark: palette.brand.dark, contrastText: '#fff' },
    secondary: { main: palette.accent.main, light: palette.accent.light, dark: palette.accent.dark, contrastText: '#fff' },
    success:   { main: status.success.solid, light: status.success.bg, dark: status.success.fg, contrastText: '#fff' },
    warning:   { main: status.warning.solid, light: status.warning.bg, dark: status.warning.fg, contrastText: '#fff' },
    error:     { main: status.error.solid,   light: status.error.bg,   dark: status.error.fg,   contrastText: '#fff' },
    info:      { main: status.info.solid,    light: status.info.bg,    dark: status.info.fg,    contrastText: '#fff' },
    background:{ default: palette.bg, paper: palette.card },
    text:      { primary: palette.text.primary, secondary: palette.text.secondary },
    divider:   palette.divider,
  },
  typography: {
    fontFamily: font.family,
    h4:        { fontWeight: 700, letterSpacing: '-0.02em', color: palette.text.primary },
    h5:        { fontSize: font.pageTitle.size, fontWeight: font.pageTitle.weight, letterSpacing: '-0.015em', lineHeight: font.pageTitle.lh, color: palette.text.primary },
    h6:        { fontSize: font.sectionTitle.size, fontWeight: 700, color: palette.text.primary },
    subtitle1: { fontWeight: 600, color: palette.text.primary },
    subtitle2: { fontWeight: 600, color: palette.text.secondary, fontSize: '0.8125rem' },
    body1:     { fontSize: font.body.size, color: palette.text.primary, lineHeight: font.body.lh },
    body2:     { fontSize: font.pageSubtitle.size, color: palette.text.secondary, lineHeight: font.pageSubtitle.lh },
    caption:   { fontSize: font.caption.size, color: palette.text.muted },
  },
  shape: { borderRadius: radius.control },
  shadows: [
    'none',
    shadow.xs, shadow.sm, shadow.sm, shadow.md, shadow.md, shadow.md,
    shadow.lg, shadow.lg, shadow.lg, shadow.lg, shadow.xl, shadow.xl,
    shadow.xl, shadow.xl, shadow.xl, shadow.xl, shadow.xl, shadow.xl,
    shadow.xl, shadow.xl, shadow.xl, shadow.xl, shadow.xl, shadow.xl,
  ] as any,
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${palette.border}`,
          borderRadius: radius.card,
          background: palette.card,
          boxShadow: shadow.sm,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radius.control,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          letterSpacing: '0.01em',
          padding: '7px 16px',
        },
        sizeLarge: { padding: '10px 22px', fontSize: '0.9375rem' },
        sizeSmall: { padding: '5px 12px', fontSize: '0.78rem' },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            background: `linear-gradient(180deg, ${palette.brand.light} 0%, ${palette.brand.main} 100%)`,
            boxShadow: '0 1px 2px rgba(27,77,166,0.25)',
            '&:hover': { background: `linear-gradient(180deg, ${palette.brand.main} 0%, ${palette.brand.dark} 100%)` },
          },
        },
        {
          props: { variant: 'outlined', color: 'primary' },
          style: {
            borderColor: palette.borderStrong,
            color: palette.brand.main,
            '&:hover': { borderColor: palette.brand.main, background: palette.brand.soft },
          },
        },
        {
          props: { variant: 'text' },
          style: { color: palette.text.secondary, '&:hover': { background: palette.cardAlt } },
        },
      ],
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.chip, fontWeight: 600, fontSize: '0.75rem', height: 24 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.control,
          background: palette.card,
          fontSize: '0.875rem',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.brand.light },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.brand.main, borderWidth: 1.5 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.875rem', color: palette.text.secondary } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: palette.divider } },
    },
    MuiDialog: {
      defaultProps: { slots: { paper: DraggablePaper } },
      styleOverrides: { paper: { borderRadius: 16, boxShadow: shadow.xl } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(2px)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: '1.0625rem',
          color: palette.text.primary,
          padding: '20px 24px 12px',
          borderBottom: `1px solid ${palette.divider}`,
          cursor: 'move',
        },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '20px 24px' } } },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px', borderTop: `1px solid ${palette.divider}`, gap: 8 } },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40 },
        indicator: { height: 2.5, borderRadius: 2, background: palette.brand.main },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8375rem',
          minHeight: 40,
          color: palette.text.secondary,
          '&.Mui-selected': { color: palette.brand.main },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { background: palette.text.primary, fontSize: '0.78rem', borderRadius: 7, padding: '6px 10px' },
        arrow: { color: palette.text.primary },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 10, fontSize: '0.875rem' } },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { height: 60 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { minWidth: 48, padding: '6px 0' },
        label: { fontSize: '0.65rem', marginTop: 2 },
      },
    },
    /* Mobile: make all interactive elements min 44px tall for touch */
    MuiMenuItem: {
      styleOverrides: { root: { minHeight: 44 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { minHeight: 44 } },
    },
    MuiSelect: {
      styleOverrides: { select: { minHeight: '1.5em' } },
    },
  },
});

export default theme;
