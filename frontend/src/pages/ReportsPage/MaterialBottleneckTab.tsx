import { Box, Button, Card, Typography, Alert } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { ColDef } from 'ag-grid-community';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getMaterialBottleneck, exportMaterialBottleneck, type ReportFilter } from '../../api/reports';
import DataGrid from '../../components/ui/DataGrid';
import ChartTip from './ChartTip';
import { downloadBlob } from '../../utils/download';
import { status, palette } from '../../theme/tokens';

const columnDefs: ColDef[] = [
  { field: 'ticketNo', headerName: 'Ticket No', width: 140 },
  { field: 'siteCode', headerName: 'Mã trạm', width: 110 },
  { field: 'siteName', headerName: 'Tên trạm', flex: 1, minWidth: 160 },
  { field: 'stage', headerName: 'Đang nghẽn ở', width: 140 },
  { field: 'daysStuck', headerName: 'Số ngày nghẽn', width: 130, sort: 'desc' },
];

export default function MaterialBottleneckTab({ filter }: { filter: ReportFilter }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-material-bottleneck', filter],
    queryFn: () => getMaterialBottleneck(filter),
  });

  const handleExport = async () => {
    const res = await exportMaterialBottleneck(filter);
    downloadBlob(res.data, 'ton-dong-vat-tu.xlsx');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<Download />} onClick={handleExport}>Xuất Excel</Button>
      </Box>

      <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
        Số ngày trung bình mỗi giai đoạn chỉ tính được cho phiếu có đủ mốc thời gian (phát sinh từ bản cập nhật mới) — dữ liệu cũ chưa có mốc thời gian từng giai đoạn sẽ không được tính vào trung bình.
      </Alert>

      <Card elevation={0} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>Số phiếu đang nghẽn theo giai đoạn</Typography>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.stuckByStage ?? []} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} />
            <Bar dataKey="count" name="Số phiếu đang nghẽn" fill={status.warning.solid} radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <DataGrid height={420} rowData={data?.stuckItems ?? []} columnDefs={columnDefs} loading={isLoading} pagination={false} />
    </Box>
  );
}
