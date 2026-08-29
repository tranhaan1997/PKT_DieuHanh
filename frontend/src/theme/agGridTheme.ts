import { themeQuartz } from 'ag-grid-community';
import { palette, font, grid, radius } from './tokens';

/**
 * Shared AG Grid theme — the single grid look used by every list page.
 * All values derive from design tokens so the grid matches the rest of
 * the app (header tone, hover, border, density, font).
 */
export const agGridTheme = themeQuartz.withParams({
  fontFamily: font.family,
  fontSize: grid.fontSize,
  foregroundColor: palette.text.primary,
  headerBackgroundColor: palette.cardAlt,
  headerTextColor: palette.text.secondary,
  headerFontWeight: 700,
  headerFontSize: 12,
  oddRowBackgroundColor: palette.cardAlt,
  backgroundColor: palette.card,
  rowHoverColor: palette.brand.soft,
  selectedRowBackgroundColor: '#EBF3FF',
  borderColor: palette.border,
  cellHorizontalPaddingScale: 0.9,
  rowHeight: grid.rowHeight,
  headerHeight: grid.headerHeight,
  borderRadius: radius.grid,
  wrapperBorderRadius: radius.grid,
  wrapperBorder: true,
  columnBorder: false,
  accentColor: palette.brand.main,
});

export default agGridTheme;
