import { Box, Button, Card, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { ColDef } from 'ag-grid-community';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getStaffPerformance, exportStaffPerformance, type ReportFilter } from '../../api/reports';
import DataGrid from '../../components/ui/DataGrid';
import ChartTip from './ChartTip';
import { downloadBlob } from '../../utils/download';
import { status, palette } from '../../theme/tokens';

const columnDefs: ColDef[] = [
  { field: 'fullName', headerName: 'Nhân sự', flex: 1, minWidth: 160 },
  { field: 'woCount', headerName: 'Số phiếu đã cập nhật', width: 170 },
  { field: 'avgHoursToUpdate', headerName: 'TB giờ xử lý lần đầu', width: 170 },
];

function StaffChart({ title, data, color }: { title: string; data: any[]; color: string }) {
  return (
    <Card elevation={0} sx={{ p: 2, flex: 1, minWidth: 280 }}>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>{title}</Typography>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="fullName" type="category" width={120} tick={{ fontSize: 12 }} />
          <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} />
          <Bar dataKey="woCount" name="Số phiếu" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function StaffPerformanceTab({ filter }: { filter: ReportFilter }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-staff-performance', filter],
    queryFn: () => getStaffPerformance(filter),
  });

  const handleExport = async () => {
    const res = await exportStaffPerformance(filter);
    downloadBlob(res.data, 'hieu-suat-nhan-su.xlsx');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<Download />} onClick={handleExport}>Xuất Excel</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <StaffChart title="Điều hành (vật tư)" data={data?.office ?? []} color={status.info.solid} />
        <StaffChart title="Kỹ thuật (thi công)" data={data?.tech ?? []} color={status.success.solid} />
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>Điều hành</Typography>
        <DataGrid height={320} rowData={data?.office ?? []} columnDefs={columnDefs} loading={isLoading} pagination={false} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>Kỹ thuật</Typography>
        <DataGrid height={320} rowData={data?.tech ?? []} columnDefs={columnDefs} loading={isLoading} pagination={false} />
      </Box>
    </Box>
  );
}
