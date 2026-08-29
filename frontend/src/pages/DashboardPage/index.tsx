import { useState } from 'react';
import { Box, Card, Typography, Skeleton, useMediaQuery, useTheme, FormControl, Select, MenuItem, Divider } from '@mui/material';
import { AssignmentOutlined, CheckCircleOutlined, ScheduleOutlined } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  Legend, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  getDashboardSummary, getDashboardBySolution, getDashboardByTtkv,
  getDashboardMaterialProgress, getDashboardMaterialProgressByTtkv,
} from '../../api/dashboard';
import { getPeriods } from '../../api/periods';
import { palette, status, shadow } from '../../theme/tokens';

const BAR_COLORS = { completed: status.success.solid, inProgress: status.info.solid, notStarted: palette.borderStrong };
const SOLUTION_COLORS = [
  status.info.solid, status.success.solid, status.warning.solid, status.error.solid,
  status.purple.solid, palette.accent.main, palette.brand.dark, palette.borderStrong,
];
const MATERIAL_STAGE_COLORS = [status.info.solid, status.warning.solid, status.purple.solid, status.success.solid];

/* ─── Chart tooltip ───────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0);
  return (
    <Box sx={{ bgcolor: palette.card, border: `1px solid ${palette.borderStrong}`, borderRadius: 2, p: '10px 14px', boxShadow: shadow.lg, minWidth: 140 }}>
      {label && (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: palette.text.secondary, mb: 0.75 }}>
          {label}
        </Typography>
      )}
      {payload.map((e: any) => (
        <Box key={e.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.375 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: 2, bgcolor: e.fill ?? e.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.8125rem', color: palette.text.secondary }}>
            {e.name}:&nbsp;<strong style={{ color: palette.text.primary }}>{e.value}</strong>
          </Typography>
        </Box>
      ))}
      {payload.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.625, pt: 0.625, borderTop: `1px solid ${palette.divider}` }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: palette.text.secondary }}>Tổng</Typography>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: palette.text.primary }}>{total}</Typography>
        </Box>
      )}
    </Box>
  );
};

/* ─── Tooltip cho biểu đồ TTKV theo giải pháp (giá trị là tổng số phiếu) ──── */
const TtkvChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0);
  return (
    <Box sx={{ bgcolor: palette.card, border: `1px solid ${palette.borderStrong}`, borderRadius: 2, p: '10px 14px', boxShadow: shadow.lg, minWidth: 180 }}>
      {label && (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: palette.text.secondary, mb: 0.75 }}>
          {label}
        </Typography>
      )}
      {payload.map((e: any) => {
        const d = e.payload?.detail?.[e.dataKey];
        return (
          <Box key={e.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.375 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 2, bgcolor: e.fill ?? e.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8125rem', color: palette.text.secondary }}>
              {e.name}:&nbsp;
              <strong style={{ color: palette.text.primary }}>{e.value} phiếu</strong>
              {d && <span style={{ color: palette.text.muted }}> (hoàn thành {d.completed})</span>}
            </Typography>
          </Box>
        );
      })}
      {payload.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.625, pt: 0.625, borderTop: `1px solid ${palette.divider}` }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: palette.text.secondary }}>Tổng</Typography>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: palette.text.primary }}>{total} phiếu</Typography>
        </Box>
      )}
    </Box>
  );
};

/* ─── Tooltip cho biểu đồ tiến độ vật tư (giá trị là %, hiện thêm done/total) ──── */
const MaterialChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: palette.card, border: `1px solid ${palette.borderStrong}`, borderRadius: 2, p: '10px 14px', boxShadow: shadow.lg, minWidth: 180 }}>
      {label && (
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: palette.text.secondary, mb: 0.75 }}>
          {label}
        </Typography>
      )}
      {payload.map((e: any) => {
        const d = e.payload?.detail?.[e.dataKey];
        return (
          <Box key={e.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 0.375 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 2, bgcolor: e.fill ?? e.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8125rem', color: palette.text.secondary }}>
              {e.name}:&nbsp;
              <strong style={{ color: palette.text.primary }}>
                {d ? `${d.done}/${d.total} (${e.value}%)` : `${e.value}%`}
              </strong>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/* ─── Tick trục X cắt ngắn tên dài kèm "..." ───────────────────────── */
function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
function TruncatedTick({ x, y, payload, angle, textAnchor, maxChars = 14 }: any) {
  return (
    <text x={x} y={y} dy={10} fontSize={12} fontWeight={500} fill={palette.text.secondary}
      textAnchor={textAnchor ?? 'middle'} transform={angle ? `rotate(${angle}, ${x}, ${y})` : undefined}>
      <title>{payload.value}</title>
      {truncate(payload.value, maxChars)}
    </text>
  );
}

/* ─── KPI card đơn giản ─────────────────────────────────────────────── */
function KpiCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: { solid: string; fg: string; bg: string } }) {
  return (
    <Card elevation={0} sx={{ flex: 1, minWidth: 0, borderLeft: `4px solid ${tone.solid}` }}>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: palette.text.muted, whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, fontWeight: 800, color: palette.text.primary, lineHeight: 1.2 }}>
            {value.toLocaleString('vi-VN')}
          </Typography>
        </Box>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone.solid, flexShrink: 0 }}>
          {icon}
        </Box>
      </Box>
    </Card>
  );
}

/* ─── Card pie nhỏ theo TTKV (Tổng / Hoàn thành / Chưa hoàn thành) ──── */
function TtkvPieCard({ ttkvName, total, completed, materialSecured }: { ttkvName: string; total: number; completed: number; materialSecured: number }) {
  const notCompleted = total - completed;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const data = [
    { name: 'Hoàn thành', value: completed },
    { name: 'Chưa hoàn thành', value: notCompleted },
  ].filter((d) => d.value > 0);
  const COLORS: Record<string, string> = { 'Hoàn thành': status.success.solid, 'Chưa hoàn thành': palette.borderStrong };

  return (
    <Card elevation={0} sx={{ minWidth: 0 }}>
      <Box sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={30} paddingAngle={2} strokeWidth={0}>
                {data.map((d) => <Cell key={d.name} fill={COLORS[d.name]} />)}
              </Pie>
              <RTooltip content={<TtkvPieTip />} />
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: palette.text.primary }}>{pct}%</Typography>
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: palette.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ttkvName}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.25 }}>Tổng: <strong style={{ color: palette.text.secondary }}>{total}</strong></Typography>
          <Typography sx={{ fontSize: '0.7rem', color: status.success.solid }}>Hoàn thành: <strong>{completed}</strong></Typography>
          <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>Chưa HT: <strong style={{ color: palette.text.secondary }}>{notCompleted}</strong></Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ px: 1.75, py: 1 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Tồn chưa thi công
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: status.info.solid, mt: 0.25 }}>
          Đã đảm bảo VT: <strong>{materialSecured}</strong><span style={{ color: palette.text.muted }}>/{notCompleted}</span>
        </Typography>
      </Box>
    </Card>
  );
}

const TtkvPieTip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <Box sx={{ bgcolor: palette.card, border: `1px solid ${palette.borderStrong}`, borderRadius: 2, p: '8px 12px', boxShadow: shadow.lg }}>
      <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary }}>
        {p.name}: <strong style={{ color: palette.text.primary }}>{p.value}</strong>
      </Typography>
    </Box>
  );
};

/* ─── Card header ─────────────────────────────────────────────────── */
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: { xs: 1.75, sm: 2.25 }, pb: 1.25, borderBottom: `1px solid ${palette.divider}` }}>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: palette.text.primary }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, mt: 0.25 }}>{sub}</Typography>}
    </Box>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [periodId, setPeriodId] = useState('');

  const { data: periods = [] } = useQuery({ queryKey: ['periods'], queryFn: () => getPeriods().then((r) => r.data) });
  const pid = periodId ? Number(periodId) : undefined;

  const { data: s } = useQuery({ queryKey: ['dashboard-summary', pid],     queryFn: () => getDashboardSummary(pid).then((r)   => r.data) });
  const { data: bySolution, isLoading: lso } = useQuery({ queryKey: ['dashboard-by-solution', pid], queryFn: () => getDashboardBySolution(pid).then((r) => r.data) });
  const { data: byTtkv, isLoading: ltk } = useQuery({ queryKey: ['dashboard-by-ttkv', pid], queryFn: () => getDashboardByTtkv(pid).then((r) => r.data) });
  const { data: materialProgress, isLoading: lmp } = useQuery({ queryKey: ['dashboard-material-progress', pid], queryFn: () => getDashboardMaterialProgress(pid).then((r) => r.data) });
  const { data: materialByTtkv, isLoading: lmt } = useQuery({ queryKey: ['dashboard-material-by-ttkv', pid], queryFn: () => getDashboardMaterialProgressByTtkv(pid).then((r) => r.data) });

  const completeRate = s?.total ? Math.round((s.completed / s.total) * 100) : 0;

  const materialByTtkvData = (materialByTtkv ?? []).map((row: any) => {
    const flat: Record<string, any> = { ttkvName: row.ttkvName, detail: {} };
    row.stages.forEach((st: any, i: number) => {
      const key = `stage_${i}`;
      flat[key] = st.percentage;
      flat.detail[key] = { done: st.done, total: st.total };
    });
    return flat;
  });

  const ttkvChartData = (byTtkv?.rows ?? []).map((row: any) => {
    const flat: Record<string, any> = { ttkvName: row.ttkvName, detail: {} };
    for (const sol of byTtkv?.solutions ?? []) {
      const key = `sol_${sol.solutionId}`;
      const entry = row.bySolution[sol.solutionId];
      if (!entry) continue; // Giải pháp không có dữ liệu trong TTKV này — bỏ qua, không hiển thị thanh
      flat[key] = entry.total;
      flat.detail[key] = { completed: entry.completed, total: entry.total };
    }
    return flat;
  });

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2.5 },
      '& .recharts-wrapper, & .recharts-surface, & .recharts-layer, & svg, & path, & rect, & *': { outline: 'none !important' },
      '& svg:focus, & svg *:focus, & svg *:focus-visible': { outline: 'none !important' },
    }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontSize: { xs: '1.125rem', sm: '1.375rem' } }}>Dashboard</Typography>
          <Typography variant="body2" sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
            Tổng quan tiến độ thi công {periodId ? '' : '— tất cả kỳ thực hiện'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {periods.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select displayEmpty value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <MenuItem value="">Tất cả kỳ thực hiện</MenuItem>
                {periods.map((p: any) => (
                  <MenuItem key={p.id} value={String(p.id)}>{p.periodName}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        {s && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.5, sm: 2.25 }, py: { xs: 0.75, sm: 1 }, bgcolor: status.success.bg, border: `1px solid ${status.success.border}`, borderRadius: 2.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: status.success.solid }} />
            <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, fontWeight: 700, color: status.success.fg }}>
              {completeRate}% hoàn thành
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: status.success.solid, display: { xs: 'none', sm: 'block' } }}>
              ({s.completed}/{s.total})
            </Typography>
          </Box>
        )}
        </Box>
      </Box>

      {/* KPI tổng quan */}
      {s && (
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap' }}>
          <KpiCard title="Tổng số WO" value={s.total} icon={<AssignmentOutlined />} tone={{ solid: status.info.solid, fg: status.info.fg, bg: status.info.bg }} />
          <KpiCard title="Đã hoàn thành" value={s.completed} icon={<CheckCircleOutlined />} tone={{ solid: status.success.solid, fg: status.success.fg, bg: status.success.bg }} />
          <KpiCard title="Chưa hoàn thành" value={s.total - s.completed} icon={<ScheduleOutlined />} tone={{ solid: status.warning.solid, fg: status.warning.fg, bg: status.warning.bg }} />
        </Box>
      )}

      {/* KPI theo từng TTKV */}
      {!!byTtkv?.rows?.length && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }, gap: { xs: 1, sm: 1.5 } }}>
          {byTtkv.rows.map((row: any) => (
            <TtkvPieCard key={row.ttkvCode} ttkvName={row.ttkvName} total={row.total} completed={row.completed} materialSecured={row.materialSecured} />
          ))}
        </Box>
      )}

      {/* Tiến độ vật tư + Tiến độ vật tư theo TTKV — cùng 1 hàng */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1.5, sm: 2.5 }, alignItems: 'stretch' }}>
        <Card elevation={0} sx={{ flex: { md: 2 }, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Tiến độ vật tư" sub={!isMobile ? 'Tỷ lệ hoàn thành mỗi giai đoạn vật tư' : undefined} />
          <Box sx={{ px: { xs: 0.5, sm: 2 }, py: 2, overflowX: 'auto' }}>
            {lmp ? (
              <Skeleton variant="rounded" width="100%" height={220} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={materialProgress ?? []} margin={{ top: 4, right: 12, bottom: 8, left: 0 }} barCategoryGap="30%" style={{ outline: 'none' }}>
                  <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: isMobile ? 10 : 12, fill: palette.text.secondary, fontWeight: 500 }} axisLine={{ stroke: palette.borderStrong }} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: palette.text.muted }} axisLine={false} tickLine={false} width={36} />
                  <RTooltip
                    formatter={(_v: any, _n: any, item: any) => [`${item.payload.done}/${item.payload.total} (${item.payload.percentage}%)`, 'Đã hoàn thành']}
                    cursor={{ fill: 'rgba(45,108,223,0.05)' }}
                  />
                  <Bar dataKey="percentage" name="Tỷ lệ hoàn thành" fill={status.success.solid} radius={[4,4,0,0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Card>

        <Card elevation={0} sx={{ flex: { md: 3 }, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Tiến độ vật tư theo TTKV" sub={!isMobile ? 'Tỷ lệ hoàn thành mỗi giai đoạn, tách riêng cho mỗi TTKV' : undefined} />
          <Box sx={{ px: { xs: 0.5, sm: 2 }, py: 2, overflowX: 'auto' }}>
            {lmt ? (
              <Skeleton variant="rounded" width="100%" height={220} />
            ) : (
              <ResponsiveContainer width="100%" height={220} minWidth={(materialByTtkvData?.length ?? 0) * (isMobile ? 70 : 90)}>
                <BarChart data={materialByTtkvData} margin={{ top: 4, right: 12, bottom: isMobile ? 30 : 8, left: 0 }} barCategoryGap="25%" barGap={2} style={{ outline: 'none' }}>
                  <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ttkvName"
                    tick={{ fontSize: isMobile ? 10 : 12, fill: palette.text.secondary, fontWeight: 500 }}
                    axisLine={{ stroke: palette.borderStrong }} tickLine={false}
                    angle={isMobile ? -30 : 0} textAnchor={isMobile ? 'end' : 'middle'} interval={0}
                  />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: palette.text.muted }} axisLine={false} tickLine={false} width={36} />
                  <RTooltip content={<MaterialChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} wrapperStyle={{ zIndex: 100 }} />
                  <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8, color: palette.text.secondary }} iconType="square" iconSize={9} />
                  {['Viết phiếu', 'ACT nhận VT', 'TTKV nhận VT', 'VT lên trạm'].map((label, i) => (
                    <Bar key={label} dataKey={`stage_${i}`} name={label}
                      fill={MATERIAL_STAGE_COLORS[i % MATERIAL_STAGE_COLORS.length]} radius={[4,4,0,0]} maxBarSize={isMobile ? 14 : 18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Card>
      </Box>

      {/* Solution horizontal bar */}
      <Card elevation={0}>
        <SectionHeader title="Tiến độ theo giải pháp" sub={!isMobile ? 'Số WO hoàn thành / đang làm / chưa bắt đầu theo từng giải pháp' : undefined} />
        <Box sx={{ px: { xs: 0.5, sm: 2 }, py: 2, overflowX: 'auto' }}>
          {lso ? (
            <Skeleton variant="rounded" width="100%" height={280} />
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 260 : 300} minWidth={(bySolution?.length ?? 0) * (isMobile ? 70 : 90)}>
              <BarChart data={bySolution ?? []} margin={{ top: 4, right: 12, bottom: 8, left: 0 }} barCategoryGap="25%" barGap={2} style={{ outline: 'none' }}>
                <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="solutionName"
                  tick={<TruncatedTick maxChars={isMobile ? 10 : 14} />}
                  axisLine={{ stroke: palette.borderStrong }} tickLine={false}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: palette.text.muted }} axisLine={false} tickLine={false} width={36} />
                <RTooltip content={<ChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} wrapperStyle={{ zIndex: 100 }} />
                <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8, color: palette.text.secondary }} iconType="square" iconSize={9} />
                <Bar dataKey="completed"  name="Hoàn thành" fill={BAR_COLORS.completed}  radius={[4,4,0,0]} maxBarSize={isMobile ? 16 : 22} />
                <Bar dataKey="inProgress" name="Đang TH"    fill={BAR_COLORS.inProgress} radius={[4,4,0,0]} maxBarSize={isMobile ? 16 : 22} />
                <Bar dataKey="notStarted" name="Chưa TH"    fill={BAR_COLORS.notStarted} radius={[4,4,0,0]} maxBarSize={isMobile ? 16 : 22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Card>

      {/* TTKV vertical bar — nhóm theo giải pháp */}
      <Card elevation={0}>
        <SectionHeader title="Tiến độ theo TTKV" sub={!isMobile ? 'Tổng số phiếu theo từng giải pháp, tách riêng cho mỗi TTKV' : undefined} />
        <Box sx={{ px: { xs: 0.5, sm: 2 }, py: 2, overflowX: 'auto' }}>
          {ltk ? (
            <Skeleton variant="rounded" width="100%" height={280} />
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 260 : 320} minWidth={(ttkvChartData?.length ?? 0) * (isMobile ? 70 : 90)}>
              <BarChart data={ttkvChartData} margin={{ top: 4, right: 12, bottom: isMobile ? 20 : 8, left: 0 }} barCategoryGap="25%" barGap={2} style={{ outline: 'none' }}>
                <CartesianGrid stroke={palette.divider} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ttkvName"
                  tick={{ fontSize: isMobile ? 10 : 12, fill: palette.text.secondary, fontWeight: 500 }}
                  axisLine={{ stroke: palette.borderStrong }} tickLine={false}
                  angle={isMobile ? -30 : 0} textAnchor={isMobile ? 'end' : 'middle'} interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: palette.text.muted }} axisLine={false} tickLine={false} width={36} />
                <RTooltip content={<TtkvChartTip />} cursor={{ fill: 'rgba(45,108,223,0.05)' }} wrapperStyle={{ zIndex: 100 }} />
                <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8, color: palette.text.secondary }} iconType="square" iconSize={9} />
                {(byTtkv?.solutions ?? []).map((sol: any, i: number) => (
                  <Bar key={sol.solutionId} dataKey={`sol_${sol.solutionId}`} name={sol.solutionName}
                    fill={SOLUTION_COLORS[i % SOLUTION_COLORS.length]} radius={[4,4,0,0]} maxBarSize={isMobile ? 14 : 18} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Card>

    </Box>
  );
}
