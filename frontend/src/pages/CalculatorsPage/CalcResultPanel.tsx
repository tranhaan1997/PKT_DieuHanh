import { Alert, Box, Card, Divider, Typography } from '@mui/material';
import type { CalcDefinition, CalcResult } from '../../calculators/types';
import { formatNumber } from '../../calculators/expression';
import { palette, status, font, radius } from '../../theme/tokens';

interface Props {
  def: CalcDefinition;
  result: CalcResult;
}

const sectionTitle = { fontSize: font.sectionTitle.size, fontWeight: 700, color: palette.text.primary };
const mono = { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace', fontSize: '0.78rem' };

export default function CalcResultPanel({ def, result }: Props) {
  const primary = result.steps.filter((s) => s.primary);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Kết quả chính */}
      <Card sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={sectionTitle}>Kết quả</Typography>
          <Box
            sx={{
              fontSize: font.caption.size, fontWeight: 600, px: 1, py: 0.25, borderRadius: `${radius.chip}px`,
              color: status.warning.fg, bgcolor: status.warning.bg, border: `1px solid ${status.warning.border}`,
            }}
          >
            N-need · chưa gồm dự phòng
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {primary.map((s) => (
            <Box
              key={s.key}
              sx={{
                p: 1.5, borderRadius: `${radius.control}px`,
                bgcolor: s.error ? status.error.bg : palette.brand.soft,
                border: `1px solid ${s.error ? status.error.border : palette.sidebar.line}`,
              }}
            >
              <Typography sx={{ fontSize: font.caption.size, color: palette.text.secondary, fontWeight: 600 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, fontWeight: 700, color: palette.brand.dark, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(s.value, s.decimals)}
                <Box component="span" sx={{ fontSize: '0.9rem', fontWeight: 600, ml: 0.75, color: palette.text.secondary }}>{s.unit}</Box>
              </Typography>
              {s.pending && (
                <Typography sx={{ fontSize: font.caption.size, color: palette.text.muted }}>{s.pending}</Typography>
              )}
            </Box>
          ))}
        </Box>
        {result.warnings.length > 0 && (
          <Alert severity="warning" sx={{ py: 0 }}>
            {result.warnings.map((w) => <div key={w}>{w}</div>)}
          </Alert>
        )}
        {result.errors.length > 0 && (
          <Alert severity="error" sx={{ py: 0 }}>
            {result.errors.map((e) => <div key={e}>{e}</div>)}
          </Alert>
        )}
      </Card>

      {/* Các bước tính */}
      <Card sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={sectionTitle}>Các bước tính</Typography>
        {result.steps.map((s, i) => (
          <Box key={s.key}>
            {i > 0 && <Divider sx={{ mb: 1 }} />}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: font.body.size, fontWeight: 600, color: palette.text.primary }}>
                {s.label} <Box component="span" sx={{ color: palette.text.muted, fontWeight: 400 }}>({s.key})</Box>
              </Typography>
              <Typography sx={{ fontSize: font.body.size, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(s.value, s.decimals)} {s.unit}
              </Typography>
            </Box>
            <Typography sx={{ ...mono, color: palette.text.secondary }}>= {s.expr}</Typography>
            {s.terms && s.terms.length > 0 && (
              <Box sx={{ pl: 1.5, my: 0.25, borderLeft: `2px solid ${palette.divider}` }}>
                {s.terms.map((t, ti) => (
                  <Typography key={ti} sx={{ ...mono, color: palette.text.muted, wordBreak: 'break-word' }}>
                    {t.label}: {t.substituted} = <b>{formatNumber(t.value, 4)}</b>
                  </Typography>
                ))}
              </Box>
            )}
            {s.error ? (
              <Typography sx={{ ...mono, color: status.error.fg }}>{s.error}</Typography>
            ) : s.pending ? (
              <Typography sx={{ fontSize: font.caption.size, color: palette.text.muted, fontStyle: 'italic' }}>{s.pending}</Typography>
            ) : (
              <Typography sx={{ ...mono, color: palette.text.muted, wordBreak: 'break-word' }}>= {s.substituted}</Typography>
            )}
          </Box>
        ))}
      </Card>

      {/* Công thức gốc theo Guideline */}
      {(def.reference?.length || def.notes?.length || def.params?.length) && (
        <Card sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 0.75, bgcolor: palette.cardAlt }}>
          <Typography sx={sectionTitle}>
            Công thức theo Guideline{def.section ? ` (mục ${def.section})` : ''}
          </Typography>
          {def.reference?.map((r) => (
            <Typography key={r} sx={{ ...mono, fontSize: '0.85rem', fontWeight: 600, color: palette.text.primary }}>{r}</Typography>
          ))}
          {def.notes?.map((n) => (
            <Typography key={n} sx={{ fontSize: font.caption.size, color: palette.text.secondary }}>• {n}</Typography>
          ))}
          {def.params?.map((p) => (
            <Typography key={p.key} sx={{ fontSize: font.caption.size, color: palette.text.secondary }}>
              • {p.label}: <b>{p.key} = {p.value}</b>{p.unit ? ` ${p.unit}` : ''}
            </Typography>
          ))}
          <Typography sx={{ fontSize: font.caption.size, color: palette.text.faint, mt: 0.5 }}>Phiên bản công thức: {def.version}</Typography>
        </Card>
      )}
    </Box>
  );
}
