import { useState } from 'react';
import { Box, Tabs, Tab, FormControl, Select, MenuItem } from '@mui/material';
import PageHeader from '../../components/ui/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { getPeriods } from '../../api/periods';
import { getSolutions } from '../../api/solutions';
import SummaryTab from './SummaryTab';
import TrendTab from './TrendTab';
import StaffPerformanceTab from './StaffPerformanceTab';
import MaterialBottleneckTab from './MaterialBottleneckTab';
import IssuesTab from './IssuesTab';

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [periodId, setPeriodId] = useState('');
  const [solutionId, setSolutionId] = useState('');

  const { data: periods = [] } = useQuery({ queryKey: ['periods'], queryFn: () => getPeriods().then((r) => r.data) });
  const { data: solutions = [] } = useQuery({ queryKey: ['solutions'], queryFn: () => getSolutions().then((r) => r.data) });

  const filter = { periodId: periodId || undefined, solutionId: solutionId || undefined };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 2,
      '& .recharts-wrapper, & .recharts-surface, & .recharts-layer, & svg, & path, & rect, & *': { outline: 'none !important' },
      '& svg:focus, & svg *:focus, & svg *:focus-visible': { outline: 'none !important' },
    }}>
      <PageHeader title="Báo cáo" subtitle="Tổng hợp tiến độ theo giải pháp, xu hướng theo kỳ, hiệu suất nhân sự, tồn đọng vật tư và vướng mắc" />

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select displayEmpty value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <MenuItem value="">Tất cả kỳ thực hiện</MenuItem>
            {periods.map((p: any) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.periodName}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select displayEmpty value={solutionId} onChange={(e) => setSolutionId(e.target.value)}>
            <MenuItem value="">Tất cả giải pháp</MenuItem>
            {solutions.map((s: any) => (
              <MenuItem key={s.id} value={String(s.id)}>{s.solutionName}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label="Tổng hợp" />
        <Tab label="Xu hướng theo kỳ" />
        <Tab label="Hiệu suất nhân sự" />
        <Tab label="Tồn đọng vật tư" />
        <Tab label="Vướng mắc" />
      </Tabs>

      {tab === 0 && <SummaryTab filter={filter} />}
      {tab === 1 && <TrendTab filter={{ solutionId: filter.solutionId }} />}
      {tab === 2 && <StaffPerformanceTab filter={filter} />}
      {tab === 3 && <MaterialBottleneckTab filter={filter} />}
      {tab === 4 && <IssuesTab filter={filter} />}
    </Box>
  );
}
