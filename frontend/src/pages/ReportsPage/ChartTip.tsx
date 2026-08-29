import { Box, Typography } from '@mui/material';
import { palette, shadow } from '../../theme/tokens';

/** Tooltip chung cho mọi biểu đồ trong trang Báo cáo — luôn hiện dòng Tổng. */
export default function ChartTip({ active, payload, label }: any) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.625, pt: 0.625, borderTop: `1px solid ${palette.divider}` }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: palette.text.secondary }}>Tổng</Typography>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: palette.text.primary }}>{total}</Typography>
      </Box>
    </Box>
  );
}
