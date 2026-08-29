import { Box } from '@mui/material';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef, type ColGroupDef } from 'ag-grid-community';
import { agGridTheme } from '../../theme/agGridTheme';

/* Register AG Grid community modules once for the whole app. */
ModuleRegistry.registerModules([AllCommunityModule]);

const DEFAULT_COL_DEF: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  suppressHeaderMenuButton: false,
};

/* Auto-prepended row number column shared by every list grid in the app. */
const STT_COL: ColDef = {
  headerName: 'STT',
  colId: '__stt',
  valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
  width: 56,
  minWidth: 56,
  pinned: 'left',
  sortable: false,
  filter: false,
  resizable: false,
  suppressMovable: true,
  cellStyle: { color: '#94A3B8', fontWeight: 600, justifyContent: 'center' },
};

/**
 * The single grid used by every list page. Wraps AgGridReact with the
 * shared theme, sensible defaults and a uniform bordered surface so all
 * lists share one look and density.
 *
 * `fill` (default) makes the grid stretch to its flex parent; pass a
 * fixed `height` for grids inside dialogs / fixed regions.
 */
interface Props extends AgGridReactProps {
  height?: number | string;
  fill?: boolean;
  /** Opt out of the auto-prepended "STT" row-number column. */
  hideRowNumber?: boolean;
}

/* Vertically center every cell's content (plain text, numeric and custom
 * renderers alike) so rows don't look top-aligned. */
const CELL_ALIGN = {
  '& .ag-cell': { display: 'flex', alignItems: 'center', lineHeight: 'normal' },
  '& .ag-cell.ag-right-aligned-cell': { justifyContent: 'flex-end' },
  '& .ag-cell-wrapper': { width: '100%', height: '100%', alignItems: 'center' },
} as const;

export default function DataGrid({ height, fill = true, defaultColDef, hideRowNumber, columnDefs, ...rest }: Props) {
  const base = fill && !height ? { flex: 1, minHeight: 0, width: '100%' } : { height: height ?? 480, width: '100%' };
  const cols: (ColDef | ColGroupDef)[] | undefined =
    !hideRowNumber && columnDefs ? [STT_COL, ...(columnDefs as (ColDef | ColGroupDef)[])] : (columnDefs ?? undefined);
  return (
    <Box sx={{ ...base, ...CELL_ALIGN }}>
      <AgGridReact
        theme={agGridTheme}
        defaultColDef={{ ...DEFAULT_COL_DEF, ...defaultColDef }}
        columnDefs={cols}
        suppressCellFocus
        enableCellTextSelection
        animateRows={false}
        overlayNoRowsTemplate={'<span style="color:#8A99AD;font-size:13px">Không có dữ liệu</span>'}
        {...rest}
      />
    </Box>
  );
}
