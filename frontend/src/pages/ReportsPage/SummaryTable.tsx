import { Box, Typography } from '@mui/material';
import type { ColDef } from 'ag-grid-community';
import DataGrid from '../../components/ui/DataGrid';
import type { SummaryRow } from '../../api/reports';
import { palette } from '../../theme/tokens';

const NUM_COL: Partial<ColDef> = { width: 130, cellStyle: { justifyContent: 'flex-end' } };

const COLUMN_DEFS: ColDef[] = [
  { field: 'solutionName', headerName: 'Giải pháp', flex: 1, minWidth: 180, pinned: 'left' },
  { field: 'total', headerName: 'Tổng phiếu', ...NUM_COL },
  { field: 'written', headerName: 'Viết phiếu', ...NUM_COL },
  { field: 'actReceived', headerName: 'ACT nhận VT', ...NUM_COL },
  { field: 'ttkvReceived', headerName: 'TTKV nhận VT', ...NUM_COL },
  { field: 'siteReceived', headerName: 'VT lên trạm', ...NUM_COL },
  { field: 'installInProgress', headerName: 'Đang lắp đặt', ...NUM_COL },
  { field: 'installCompleted', headerName: 'Hoàn thành lắp đặt', ...NUM_COL },
  { field: 'integrationCompleted', headerName: 'Hoàn thành tích hợp', ...NUM_COL },
  { field: 'cancelled', headerName: 'Hủy', ...NUM_COL },
];

const SUM_KEYS = [
  'total', 'written', 'actReceived', 'ttkvReceived', 'siteReceived',
  'installInProgress', 'installCompleted', 'integrationCompleted', 'cancelled',
] as const;

function buildTotalRow(rows: SummaryRow[]) {
  const total: any = { solutionId: -1, solutionName: 'Tổng cộng' };
  for (const key of SUM_KEYS) total[key] = rows.reduce((sum, r) => sum + r[key], 0);
  return total;
}

export default function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  const pinnedBottomRowData = rows.length ? [buildTotalRow(rows)] : undefined;
  const height = Math.max(140, (rows.length + 1) * 42 + 60);

  return (
    <Box>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: palette.text.primary, mb: 1 }}>
        {title}
      </Typography>
      <DataGrid
        height={height}
        rowData={rows}
        columnDefs={COLUMN_DEFS}
        pinnedBottomRowData={pinnedBottomRowData}
        pagination={false}
      />
    </Box>
  );
}
