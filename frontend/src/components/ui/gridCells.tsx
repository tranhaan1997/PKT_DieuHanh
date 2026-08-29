import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { EditOutlined, DeleteOutlined, VisibilityOutlined } from '@mui/icons-material';
import type { ICellRendererParams } from 'ag-grid-community';
import StatusChip from './StatusChip';
import type { StatusKey } from '../../theme/tokens';
import { palette } from '../../theme/tokens';

/* ─── Status cell ─────────────────────────────────────────────────────
 * Pass `toneMap` + `labelMap` (keyed by raw value) via colDef.cellRendererParams.
 */
interface StatusParams extends ICellRendererParams {
  toneMap: Record<string, StatusKey>;
  labelMap?: Record<string, string>;
  fallbackTone?: StatusKey;
}
export function StatusCellRenderer(p: StatusParams) {
  const raw = String(p.value ?? '');
  const tone = p.toneMap[raw] ?? p.fallbackTone ?? 'neutral';
  const label = p.labelMap?.[raw] ?? raw;
  if (!label) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <StatusChip label={label} tone={tone} size="sm" />
    </Box>
  );
}

/* ─── Two-line cell (primary + muted secondary) ─────────────────────── */
interface TwoLineParams extends ICellRendererParams {
  getPrimary: (row: any) => string;
  getSecondary: (row: any) => string;
}
export function TwoLineCellRenderer(p: TwoLineParams) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', lineHeight: 1.25 }}>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
        {p.getPrimary(p.data)}
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', color: palette.text.muted, lineHeight: 1.3 }}>
        {p.getSecondary(p.data)}
      </Typography>
    </Box>
  );
}

/* ─── Chip-list cell (e.g. period supervisors) ──────────────────────── */
interface ChipListParams extends ICellRendererParams {
  getLabels: (row: any) => string[];
  tone?: StatusKey;
}
export function ChipListCellRenderer(p: ChipListParams) {
  const labels = p.getLabels(p.data) || [];
  if (!labels.length) return <Box sx={{ color: palette.text.faint }}>—</Box>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', height: '100%', py: 0.5 }}>
      {labels.map((l, i) => (
        <StatusChip key={`${l}-${i}`} label={l} tone={p.tone ?? 'info'} size="sm" />
      ))}
    </Box>
  );
}

/* ─── Actions cell (edit / delete / view) ───────────────────────────── */
interface ActionsParams extends ICellRendererParams {
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
}
export function ActionsCellRenderer(p: ActionsParams) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, height: '100%' }}>
      {p.onView && (
        <Tooltip title="Chi tiết" arrow>
          <IconButton size="small" onClick={() => p.onView!(p.data)} sx={{ color: palette.text.muted, '&:hover': { color: palette.brand.main } }}>
            <VisibilityOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
      {p.onEdit && (
        <Tooltip title="Sửa" arrow>
          <IconButton size="small" onClick={() => p.onEdit!(p.data)} sx={{ color: palette.text.muted, '&:hover': { color: palette.brand.main } }}>
            <EditOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
      {p.onDelete && (
        <Tooltip title="Xóa" arrow>
          <IconButton size="small" onClick={() => p.onDelete!(p.data)} sx={{ color: palette.text.muted, '&:hover': { color: '#DC2626' } }}>
            <DeleteOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
