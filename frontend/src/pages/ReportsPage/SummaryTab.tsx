import { Box, Button, Card, Typography, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSummaryReport, exportSummaryReport, type ReportFilter } from '../../api/reports';
import { downloadBlob } from '../../utils/download';
import { status, palette } from '../../theme/tokens';
import ChartTip from './ChartTip';
import SummaryTable from './SummaryTable';

export default function SummaryTab({ filter }: { filter: ReportFilter }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-summary', filter],
    queryFn: () => getSummaryReport(filter),
  });

  const handleExport = async () => {
    const res = await exportSummaryReport(filter);
    downloadBlob(res.data, 'bao-cao-tong-hop.xlsx');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<Download />} onClick={handleExport}>Xuất Excel</Button>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!isLoading && data && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card elevation={0} sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>Tổng quan tiến độ theo giải pháp — toàn công ty</Typography>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.company} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="solutionName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                <Bar dataKey="written" name="Viết phiếu" fill={status.info.solid} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="installCompleted" name="Hoàn thành lắp đặt" fill={status.success.solid} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="integrationCompleted" name="Hoàn thành tích hợp" fill={status.purple.solid} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <SummaryTable title="Báo cáo chung — Toàn công ty" rows={data.company} />
          {data.byTtkv.map((t) => (
            <SummaryTable key={t.ttkvCode} title={`Trung tâm: ${t.ttkvName}`} rows={t.rows} />
          ))}
        </Box>
      )}
    </Box>
  );
}
