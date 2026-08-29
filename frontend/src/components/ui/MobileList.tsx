import React from 'react';
import { Box, Typography, IconButton, Skeleton, Card } from '@mui/material';
import { EditOutlined, DeleteOutlined, VisibilityOutlined } from '@mui/icons-material';
import { palette, shadow, radius } from '../../theme/tokens';
import StatusChip from './StatusChip';
import type { StatusKey } from '../../theme/tokens';

/* ─── Types ────────────────────────────────────────────────────────── */
export interface MobileCardChip { label: string; tone: StatusKey }

export interface MobileCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  chips?: MobileCardChip[];
  badge?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
}

/* ─── Single card ──────────────────────────────────────────────────── */
export function MobileCard({
  title, subtitle, meta, chips, badge, onEdit, onDelete, onView, onClick, children,
}: MobileCardProps) {
  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        border: `1px solid ${palette.border}`,
        borderRadius: `${radius.card}px`,
        boxShadow: shadow.xs,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        '&:active': onClick ? { boxShadow: shadow.sm, bgcolor: palette.cardAlt } : {},
      }}
    >
      <Box sx={{ p: 1.75 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.3 }}>
                {title}
              </Typography>
              {badge}
            </Box>
            {subtitle && (
              <Typography sx={{ fontSize: '0.8125rem', color: palette.text.secondary, mt: 0.25, lineHeight: 1.4 }}>
                {subtitle}
              </Typography>
            )}
            {meta && (
              <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, mt: 0.25 }}>
                {meta}
              </Typography>
            )}
          </Box>

          {/* Action buttons */}
          {(onEdit || onDelete || onView) && (
            <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
              {onView && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onView(); }}
                  sx={{ width: 34, height: 34, color: palette.brand.main, '&:active': { bgcolor: palette.brand.soft } }}>
                  <VisibilityOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {onEdit && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  sx={{ width: 34, height: 34, color: palette.text.secondary, '&:active': { bgcolor: palette.cardAlt } }}>
                  <EditOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {onDelete && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  sx={{ width: 34, height: 34, color: 'error.main', '&:active': { bgcolor: 'rgba(220,38,38,0.06)' } }}>
                  <DeleteOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>
          )}
        </Box>

        {/* Chips row */}
        {chips && chips.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
            {chips.map((c, i) => <StatusChip key={i} label={c.label} tone={c.tone} size="sm" />)}
          </Box>
        )}

        {/* Extra content */}
        {children && <Box sx={{ mt: 1.25 }}>{children}</Box>}
      </Box>
    </Card>
  );
}

/* ─── List container ───────────────────────────────────────────────── */
interface MobileListProps {
  children: React.ReactNode;
  loading?: boolean;
  empty?: string;
  count?: number;
}

export default function MobileList({ children, loading, empty = 'Không có dữ liệu', count }: MobileListProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} elevation={0} sx={{ border: `1px solid ${palette.border}`, borderRadius: `${radius.card}px`, p: 1.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" height={18} sx={{ mb: 0.5 }} />
                <Skeleton width="80%" height={14} />
              </Box>
              <Skeleton variant="rounded" width={70} height={24} sx={{ borderRadius: 6 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Skeleton variant="rounded" width={80} height={20} sx={{ borderRadius: 6 }} />
              <Skeleton variant="rounded" width={60} height={20} sx={{ borderRadius: 6 }} />
            </Box>
          </Card>
        ))}
      </Box>
    );
  }

  if (count === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ color: palette.text.muted, fontSize: '0.875rem' }}>{empty}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 1 }}>
      {children}
    </Box>
  );
}
