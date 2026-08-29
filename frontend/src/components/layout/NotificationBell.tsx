import { useState } from 'react';
import {
  Box, Typography, IconButton, Badge, Menu, Button, Chip,
  List, ListItem, ListItemText, Divider,
} from '@mui/material';
import {
  NotificationsOutlined, InventoryOutlined, CheckCircleOutlined,
  IntegrationInstructionsOutlined, AssignmentTurnedInOutlined, DoneAll,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { palette, status } from '../../theme/tokens';
import { getNotifications, markNotifRead, markAllNotifsRead } from '../../api/notifications';
import type { AppNotification } from '../../api/notifications';

const NOTIF_ICON: Record<string, React.ReactNode> = {
  MATERIAL_UPDATED:       <InventoryOutlined sx={{ fontSize: 18, color: '#D97706' }} />,
  CONSTRUCTION_COMPLETED: <CheckCircleOutlined sx={{ fontSize: 18, color: '#16A34A' }} />,
  INTEGRATION_COMPLETED:  <IntegrationInstructionsOutlined sx={{ fontSize: 18, color: palette.brand.main }} />,
  TICKET_READY:           <AssignmentTurnedInOutlined sx={{ fontSize: 18, color: '#7C3AED' }} />,
};

const NOTIF_ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'];

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const canReceiveNotifs = NOTIF_ROLES.includes(user?.role ?? '');

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then((r) => r.data),
    enabled: canReceiveNotifs,
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => markNotifRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotifsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (!canReceiveNotifs) return null;

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.75 }}>
        <Badge
          badgeContent={notifData?.unreadCount || 0}
          max={99}
          sx={{ '& .MuiBadge-badge': { bgcolor: status.error.solid, color: '#fff', fontSize: '0.6rem', minWidth: 16, height: 16 } }}
        >
          <NotificationsOutlined sx={{ fontSize: 21, color: notifData?.unreadCount ? status.error.solid : palette.text.muted }} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: { mt: 0.75, width: 380, maxHeight: 480, borderRadius: 2.5, border: `1px solid ${palette.border}`, boxShadow: '0 8px 24px rgba(15,27,45,0.12)' },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
          <NotificationsOutlined sx={{ color: palette.brand.main, fontSize: 19 }} />
          <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem' }}>Thông báo</Typography>
          {(notifData?.unreadCount ?? 0) > 0 && (
            <Button
              size="small"
              startIcon={<DoneAll sx={{ fontSize: 15 }} />}
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              sx={{ fontSize: '0.72rem', textTransform: 'none', color: palette.brand.main }}
            >
              Đọc tất cả
            </Button>
          )}
        </Box>
        <Divider />

        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {!notifData?.items.length && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1 }}>
              <NotificationsOutlined sx={{ fontSize: 40, color: '#CBD5E1' }} />
              <Typography sx={{ color: '#94A3B8', fontSize: '0.825rem' }}>Không có thông báo</Typography>
            </Box>
          )}
          <List disablePadding>
            {notifData?.items.map((n: AppNotification) => (
              <ListItem
                key={n.id}
                onClick={() => { if (!n.read) readMutation.mutate(n.id); }}
                sx={{
                  px: 2, py: 1.1, gap: 1.25, alignItems: 'flex-start',
                  bgcolor: n.read ? 'transparent' : `${palette.brand.main}08`,
                  borderBottom: '1px solid', borderColor: 'divider',
                  cursor: n.read ? 'default' : 'pointer',
                  '&:hover': { bgcolor: n.read ? 'rgba(0,0,0,0.02)' : `${palette.brand.main}12` },
                }}
              >
                <Box sx={{ mt: 0.2, flexShrink: 0 }}>{NOTIF_ICON[n.type]}</Box>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: n.read ? 400 : 700, color: palette.text.primary, flex: 1, lineHeight: 1.35 }}>
                        {n.message}
                      </Typography>
                      {!n.read && (
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: palette.brand.main, mt: 0.5, flexShrink: 0 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                        {new Date(n.createdAt).toLocaleString('vi-VN')}
                      </Typography>
                      {n.workOrder?.period && (
                        <Chip label={n.workOrder.period.periodName} size="small"
                          sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${palette.brand.main}12`, color: palette.brand.main }} />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Menu>
    </>
  );
}
