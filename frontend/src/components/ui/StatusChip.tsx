import { Box } from '@mui/material';
import { status as STATUS, radius } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';

/**
 * Unified status pill — the single visual language for SLA states, role
 * tags, active/disabled flags and period status. Replaces all ad-hoc
 * `<Chip color=...>` usage so one tone family governs the whole app.
 */
interface Props {
  label: string;
  tone: StatusKey;
  dot?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export default function StatusChip({ label, tone, dot = false, onClick, size = 'md' }: Props) {
  const c = STATUS[tone];
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 0.625 : 0,
        height: size === 'sm' ? 20 : 24,
        px: size === 'sm' ? 0.875 : 1.125,
        borderRadius: `${radius.chip}px`,
        bgcolor: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: size === 'sm' ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'filter 0.12s',
        '&:hover': onClick ? { filter: 'brightness(0.97)' } : undefined,
      }}
    >
      {dot && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.solid, flexShrink: 0 }} />}
      {label}
    </Box>
  );
}
