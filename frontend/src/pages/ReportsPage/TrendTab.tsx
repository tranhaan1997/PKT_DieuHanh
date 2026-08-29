import { Box, Button, Card, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { ColDef } from 'ag-grid-community';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getTrend, exportTrend, type TrendFilter } from '../../api/reports';
import DataGrid from '../../components/ui/DataGrid';
import ChartTip from './ChartTip';
import { downloadBlob } from '../../utils/download';
import { status, palette } from '../../theme/tokens';

const columnDefs: ColDef[] = [
  { field: 'periodName', headerName: 'Kỳ thực hiện', flex: 1, minWidth: 180 },
  { field: 'total', headerName: 'Tổng phiếu', width: 120 },
  { field: 'written', headerName: 'Viết phiếu', width: 120 },
  { field: 'installCompleted', headerName: 'Hoàn thành lắp đặt', width: 150 },
  { field: 'integrationCompleted', headerName: 'Hoàn thành tích hợp', width: 150 },
  { field: 'cancelled', headerName: 'Hủy', width: 100 },
];

export default function TrendTab({ filter }: { filter: TrendFilter }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['report-trend', filter],
    queryFn: () => getTrend(filter),
  });

  const handleExport = async () => {
    const res = await exportTrend(filter);
    downloadBlob(res.data, 'xu-huong-theo-ky.xlsx');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<Download />} onClick={handleExport}>Xuất Excel</Button>
      </Box>

      <Card elevation={0} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>Xu hướng tiến độ qua các kỳ</Typography>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" />
            <XAxis dataKey="periodName" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            <Line type="monotone" dataKey="total" name="Tổng phiếu" stroke={palette.text.muted} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="written" name="Viết phiếu" stroke={status.info.solid} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="installCompleted" name="Hoàn thành lắp đặt" stroke={status.success.solid} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="integrationCompleted" name="Hoàn thành tích hợp" stroke={status.purple.solid} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cancelled" name="Hủy" stroke={status.error.solid} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <DataGrid height={420} rowData={data} columnDefs={columnDefs} loading={isLoading} pagination={false} />
    </Box>
  );
}
