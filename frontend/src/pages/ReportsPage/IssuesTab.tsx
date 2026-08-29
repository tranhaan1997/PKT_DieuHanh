import { Box, Button } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { ColDef } from 'ag-grid-community';
import { getIssues, exportIssues, type ReportFilter } from '../../api/reports';
import DataGrid from '../../components/ui/DataGrid';
import { downloadBlob } from '../../utils/download';

const columnDefs: ColDef[] = [
  { field: 'ticketNo', headerName: 'Ticket No', width: 140 },
  { field: 'siteName', headerName: 'Tên trạm', width: 180, rowGroup: false },
  { field: 'solutionName', headerName: 'Giải pháp', width: 160 },
  { field: 'periodName', headerName: 'Kỳ thực hiện', width: 140 },
  { field: 'issue', headerName: 'Vướng mắc', flex: 1, minWidth: 240 },
  { field: 'techUpdatedByName', headerName: 'Người cập nhật', width: 150 },
  {
    field: 'techUpdatedAt', headerName: 'Thời gian', width: 160,
    valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString('vi-VN') : ''),
  },
];

export default function IssuesTab({ filter }: { filter: ReportFilter }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['report-issues', filter],
    queryFn: () => getIssues(filter),
  });

  const handleExport = async () => {
    const res = await exportIssues(filter);
    downloadBlob(res.data, 'vuong-mac.xlsx');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<Download />} onClick={handleExport}>Xuất Excel</Button>
      </Box>
      <DataGrid height={560} rowData={data} columnDefs={columnDefs} loading={isLoading} pagination={false} />
    </Box>
  );
}
