import { useState } from 'react';
import {
  Box, Button, ButtonBase, MenuItem, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { RestartAlt } from '@mui/icons-material';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { CALCULATORS } from '../../calculators/definitions';
import { applyInputChange, compute, defaultValues } from '../../calculators/engine';
import type { CalcDefinition, InputValues } from '../../calculators/types';
import { palette, font, radius } from '../../theme/tokens';
import CalcForm from './CalcForm';
import type { LinkedValue } from './CalcForm';
import CalcResultPanel from './CalcResultPanel';
import MathText from './MathText';

/** Tính kết quả các bài toán nguồn cho những input có linkFrom (VD PAC ← Pac của bài Nhu cầu công suất tải) */
function resolveLinks(def: CalcDefinition, valuesByCode: Record<string, InputValues>): Record<string, LinkedValue> {
  const links: Record<string, LinkedValue> = {};
  for (const input of def.inputs) {
    if (input.kind !== 'number' || !input.linkFrom) continue;
    const { calc, key } = input.linkFrom;
    const src = CALCULATORS.find((c) => c.code === calc);
    if (!src) continue;
    const r = compute(src, valuesByCode[src.code] ?? defaultValues(src));
    links[input.key] = {
      value: r.scope[key],
      source: src.name,
      unit: r.steps.find((s) => s.key === key)?.unit,
    };
  }
  return links;
}

export default function CalculatorsPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const def = CALCULATORS.find((c) => c.code === code);
  const calcTitle = (c: CalcDefinition) => c.name;

  // Giữ giá trị đã nhập của từng bài toán khi chuyển qua lại
  const [valuesByCode, setValuesByCode] = useState<Record<string, InputValues>>({});
  const values = def ? valuesByCode[def.code] ?? defaultValues(def) : {};
  const result = def ? compute(def, values) : null;
  const links = def ? resolveLinks(def, valuesByCode) : {};

  if (!def) return <Navigate to={`/calculators/${CALCULATORS[0].code}`} replace />;

  const setValue = (key: string, value: InputValues[string]) =>
    setValuesByCode((prev) => ({ ...prev, [def.code]: applyInputChange(def, values, key, value) }));
  const reset = () =>
    setValuesByCode((prev) => ({ ...prev, [def.code]: defaultValues(def) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
      <PageHeader
        title="Tính toán kỹ thuật"
        subtitle="Định cỡ thành phần theo Guideline VTNet — khối lượng cần (N-need), chưa gồm dự phòng"
        actions={<Button variant="outlined" startIcon={<RestartAlt />} onClick={reset}>Nhập lại</Button>}
      />

      {/* Chọn bài toán: mobile dùng dropdown, màn hình rộng dùng thẻ */}
      {isMobile ? (
        <TextField
          select
          fullWidth
          size="small"
          label="Bài toán"
          value={def.code}
          onChange={(e) => navigate(`/calculators/${e.target.value}`)}
          slotProps={{ select: { renderValue: () => <MathText text={calcTitle(def)} /> } }}
        >
          {CALCULATORS.map((c) => (
            <MenuItem key={c.code} value={c.code} sx={{ display: 'block', whiteSpace: 'normal', py: 1 }}>
              <Typography sx={{ fontSize: font.body.size, fontWeight: 700 }}><MathText text={calcTitle(c)} /></Typography>
              {c.description && (
                <Typography sx={{ fontSize: font.caption.size, color: palette.text.muted }}><MathText text={c.description} /></Typography>
              )}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' }}>
          {CALCULATORS.map((c) => {
            const active = c.code === def.code;
            return (
              <ButtonBase
                key={c.code}
                onClick={() => navigate(`/calculators/${c.code}`)}
                sx={{
                  minWidth: 0, textAlign: 'left', display: 'block',
                  px: 1.75, py: 1, borderRadius: `${radius.control}px`,
                  border: `1px solid ${active ? palette.brand.main : palette.border}`,
                  bgcolor: active ? palette.brand.soft : palette.card,
                  '&:hover': { borderColor: palette.brand.light },
                }}
              >
                <Typography sx={{ fontSize: font.body.size, fontWeight: 700, color: active ? palette.brand.dark : palette.text.primary }}>
                  <MathText text={calcTitle(c)} />
                </Typography>
                {c.description && (
                  <Typography sx={{ fontSize: font.caption.size, color: palette.text.muted }}><MathText text={c.description} /></Typography>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid', gap: 1.5, alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
        }}
      >
        <CalcForm def={def} values={values} onChange={setValue} links={links} result={result} />
        {result && (
          <Box sx={{ position: { md: 'sticky' }, top: { md: 0 } }}>
            <CalcResultPanel def={def} result={result} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
