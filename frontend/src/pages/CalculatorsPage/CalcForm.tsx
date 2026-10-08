import {
  Box, Button, Card, IconButton, InputAdornment, MenuItem, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Add, DeleteOutlined, InputOutlined } from '@mui/icons-material';
import type {
  CalcDefinition, CalcInput, CalcResult, InputValues, NumberInput, SelectInput, TableInput, TableRow,
} from '../../calculators/types';
import { emptyRow, rowOverrides, visibleInputs } from '../../calculators/engine';
import { formatNumber } from '../../calculators/expression';
import { plainMath, symbolOf } from '../../calculators/symbols';
import MathText from './MathText';
import { palette, font } from '../../theme/tokens';

/** Giá trị lấy được từ bài toán khác cho input có linkFrom */
export interface LinkedValue { value: number; source: string; unit?: string }

interface Props {
  def: CalcDefinition;
  values: InputValues;
  onChange: (key: string, value: InputValues[string]) => void;
  links?: Record<string, LinkedValue>;
  /** Kết quả tính hiện tại — dùng cho gợi ý hintFrom */
  result?: CalcResult | null;
}

const sectionTitle = { fontSize: font.sectionTitle.size, fontWeight: 700, color: palette.text.primary };
const helpText = { fontSize: font.caption.size, color: palette.text.muted };

function unitAdornment(unit?: string) {
  return unit ? { input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } } : undefined;
}

function NumberField({ input, value, onChange, link, hint }: {
  input: NumberInput; value: unknown; onChange: (v: string) => void; link?: LinkedValue; hint?: string;
}) {
  const linkUsable = link && Number.isFinite(link.value) && link.value > 0;
  return (
    <Box sx={{ minWidth: 0 }}>
      <TextField
        label={<MathText text={input.label} />}
        size="small"
        fullWidth
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        helperText={input.help && <MathText text={input.help} />}
        slotProps={{
          ...unitAdornment(input.unit),
          // Nhãn luôn nằm trên ô: nhãn dài không bị đơn vị (kW, V…) đè khi ô trống
          inputLabel: { shrink: true },
          htmlInput: { inputMode: 'decimal', 'aria-label': plainMath(input.label) },
        }}
      />
      {hint && (
        <Typography sx={{ mt: 0.5, px: 0.75, fontSize: font.caption.size, fontWeight: 600, color: palette.brand.dark }}>
          <MathText text={hint} />
        </Typography>
      )}
      {link && (
        <Button
          size="small"
          startIcon={<InputOutlined sx={{ fontSize: 16 }} />}
          disabled={!linkUsable}
          onClick={() => onChange(String(Number(link.value.toFixed(6))))}
          sx={{ mt: 0.25, px: 0.75, minHeight: 0, fontSize: font.caption.size }}
        >
          {linkUsable
            ? `Lấy từ ${link.source}: ${formatNumber(link.value, 3)} ${link.unit ?? ''}`
            : `Chưa có kết quả ở ${link.source}`}
        </Button>
      )}
    </Box>
  );
}

function SelectField({ def, input, value, onChange }: {
  def: CalcDefinition; input: SelectInput; value: unknown; onChange: (v: string) => void;
}) {
  const selected = input.options.find((o) => o.value === value);
  const varsText = selected?.vars
    ? Object.entries(selected.vars).map(([k, v]) => `${symbolOf(def, k)} = ${v}`).join(', ')
    : undefined;
  const helper = [varsText, input.help].filter(Boolean).join(' · ');
  return (
    <TextField
      select
      label={<MathText text={input.label} />}
      size="small"
      fullWidth
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      helperText={helper ? <MathText text={helper} /> : undefined}
      slotProps={{ select: { 'aria-label': plainMath(input.label) } }}
    >
      {input.options.map((o) => <MenuItem key={o.value} value={o.value}><MathText text={o.label} /></MenuItem>)}
    </TextField>
  );
}

function TableField({ input, rows, onChange, rowDefaults }: {
  input: TableInput; rows: TableRow[]; onChange: (rows: TableRow[]) => void; rowDefaults?: TableRow;
}) {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const otherCount = input.columns.filter((c) => c.type !== 'text').length;
  const desktopCols = `${input.columns.map((c) => `${c.flex ?? 1}fr`).join(' ')} 36px`;

  const setCell = (idx: number, key: string, value: string) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={sectionTitle}><MathText text={input.label} /></Typography>
        <Typography sx={helpText}>{rows.length} dòng</Typography>
      </Box>
      {input.help && <Typography sx={helpText}><MathText text={input.help} /></Typography>}

      {/* Header (desktop) */}
      <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: desktopCols, gap: 1, px: 0.5 }}>
        {input.columns.map((c) => (
          <Typography key={c.key} sx={{ fontSize: font.caption.size, fontWeight: 600, color: palette.text.secondary }}>
            <MathText text={c.label} />{c.unit ? ` (${c.unit})` : ''}
          </Typography>
        ))}
      </Box>

      {rows.map((row, idx) => (
        <Box
          key={idx}
          sx={{
            display: 'grid',
            gap: 1,
            alignItems: 'center',
            gridTemplateColumns: { xs: `repeat(${otherCount}, 1fr) 36px`, sm: desktopCols },
            p: { xs: 1, sm: 0 },
            border: { xs: `1px solid ${palette.border}`, sm: 'none' },
            borderRadius: { xs: 2, sm: 0 },
            bgcolor: { xs: palette.cardAlt, sm: 'transparent' },
          }}
        >
          {input.columns.map((c) => {
            const isText = c.type === 'text';
            const label = isMobile ? <MathText text={`${c.label}${c.unit ? ` (${c.unit})` : ''}`} /> : undefined;
            const ariaLabel = `${plainMath(c.label)} dòng ${idx + 1}`;
            return (
              <Box
                key={c.key}
                sx={{
                  minWidth: 0,
                  // Mobile: cột text ở hàng 1 (cạnh nút xóa), các cột số ở hàng 2
                  gridRow: { xs: isText ? '1' : '2', sm: 'auto' },
                  gridColumn: { xs: isText ? `1 / span ${otherCount}` : 'auto', sm: 'auto' },
                }}
              >
                {c.type === 'select' ? (
                  <TextField
                    select size="small" fullWidth
                    label={label}
                    slotProps={{ htmlInput: { 'aria-label': ariaLabel } }}
                    value={row[c.key] ?? ''}
                    onChange={(e) => setCell(idx, c.key, e.target.value)}
                  >
                    {c.options?.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                ) : (
                  <TextField
                    size="small" fullWidth
                    label={isText ? undefined : label}
                    placeholder={isText ? plainMath(c.label) : undefined}
                    value={row[c.key] ?? ''}
                    onChange={(e) => setCell(idx, c.key, e.target.value)}
                    slotProps={{ htmlInput: { 'aria-label': ariaLabel, inputMode: isText ? undefined : 'decimal' } }}
                  />
                )}
              </Box>
            );
          })}
          <Box sx={{ gridRow: { xs: '1', sm: 'auto' }, gridColumn: { xs: `${otherCount + 1}`, sm: 'auto' } }}>
            <Tooltip title="Xóa dòng">
              <IconButton size="small" onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
                <DeleteOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ))}

      <Box>
        <Button size="small" startIcon={<Add />} onClick={() => onChange([...rows, emptyRow(input, rowDefaults)])}>
          Thêm dòng
        </Button>
      </Box>
    </Box>
  );
}

export default function CalcForm({ def, values, onChange, links = {}, result }: Props) {
  const inputs = visibleInputs(def, values);
  // Gom các input liên tiếp cùng group thành 1 nhóm có tiêu đề
  const groups: { name?: string; inputs: CalcInput[] }[] = [];
  for (const input of inputs) {
    const last = groups[groups.length - 1];
    if (last && last.name === input.group) last.inputs.push(input);
    else groups.push({ name: input.group, inputs: [input] });
  }

  const hintFor = (input: NumberInput) => {
    if (!input.hintFrom || !result) return undefined;
    const v = result.scope[input.hintFrom.key];
    if (!Number.isFinite(v)) return undefined;
    const step = result.steps.find((s) => s.key === input.hintFrom!.key);
    return `${input.hintFrom.label} = ${formatNumber(v, step?.decimals ?? 2)} ${step?.unit ?? ''}`;
  };

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {groups.map((g, gi) => {
        const simple = g.inputs.filter((i) => i.kind !== 'table');
        const tables = g.inputs.filter((i): i is TableInput => i.kind === 'table');
        return (
          <Box key={gi} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {g.name && (
              <Typography sx={{ ...sectionTitle, pb: 0.75, borderBottom: `1px solid ${palette.divider}` }}><MathText text={g.name} /></Typography>
            )}
            {simple.length > 0 && (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
                {simple.map((input) =>
                  input.kind === 'number' ? (
                    <NumberField
                      key={input.key} input={input} value={values[input.key]}
                      link={links[input.key]} hint={hintFor(input)}
                      onChange={(v) => onChange(input.key, v)}
                    />
                  ) : input.kind === 'select' ? (
                    <SelectField key={input.key} def={def} input={input} value={values[input.key]} onChange={(v) => onChange(input.key, v)} />
                  ) : null,
                )}
              </Box>
            )}
            {tables.map((t) => (
              <TableField
                key={t.key}
                input={t}
                rows={(values[t.key] as TableRow[]) ?? []}
                rowDefaults={rowOverrides(def, values, t.key)}
                onChange={(rows) => onChange(t.key, rows)}
              />
            ))}
          </Box>
        );
      })}
    </Card>
  );
}
