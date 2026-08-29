import { useState, useEffect } from 'react';
import {
  Box, Typography, Avatar, Menu, MenuItem, Divider, IconButton,
  Drawer, Badge, List, ListItem, ListItemText, Button, Chip,
  Dialog, DialogContent,
} from '@mui/material';
import {
  LogoutOutlined, SettingsInputAntennaOutlined, PeopleOutlined, ListAltOutlined, MenuBookOutlined,
  NotificationsOutlined, InventoryOutlined, CheckCircleOutlined, IntegrationInstructionsOutlined,
  Close, DoneAll, AssignmentTurnedInOutlined, GetApp, IosShare, AddBoxOutlined, ArrowBackIosNewOutlined,
  AssessmentOutlined, HistoryOutlined, ManageHistoryOutlined,
} from '@mui/icons-material';
import { useTopBar } from './TopBarContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { palette, status } from '../../theme/tokens';
import { getNotifications, markNotifRead, markAllNotifsRead } from '../../api/notifications';
import type { AppNotification } from '../../api/notifications';
import { frontendVersion } from '../../api/version';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/sites': 'Danh mục trạm',
  '/solutions': 'Giải pháp',
  '/periods': 'Kỳ thực hiện',
  '/work-orders': 'Phiếu thi công',
  '/lookup': 'Tra cứu',
  '/users': 'Người dùng',
  '/manager-orders': 'Phiếu vật tư',
  '/reports': 'Báo cáo',
  '/guide': 'Hướng dẫn sử dụng',
  '/sync-history': 'Lịch sử đồng bộ tự động',
  '/activity-history': 'Lịch sử thao tác',
};

const ROLE_DOT: Record<string, string> = {
  ADMIN: status.error.solid,
  SUPERVISOR: status.warning.solid,
  TECHNICIAN: status.success.solid,
  VIEWER: status.info.solid,
};

const NOTIF_ICON: Record<string, React.ReactNode> = {
  MATERIAL_UPDATED: <InventoryOutlined sx={{ fontSize: 18, color: '#D97706' }} />,
  CONSTRUCTION_COMPLETED: <CheckCircleOutlined sx={{ fontSize: 18, color: '#16A34A' }} />,
  INTEGRATION_COMPLETED: <IntegrationInstructionsOutlined sx={{ fontSize: 18, color: palette.brand.main }} />,
  TICKET_READY: <AssignmentTurnedInOutlined sx={{ fontSize: 18, color: '#7C3AED' }} />,
};

const NOTIF_ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'];

function avatarBg(name: string) {
  const p = [palette.brand.main, palette.accent.main, status.purple.solid, status.warning.solid];
  return p[(name?.charCodeAt(0) || 0) % p.length];
}

function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export default function MobileTopBar() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const showInstallItem = !isStandalone() && (!!deferredPrompt || isIOS());

  const handleInstall = async () => {
    setAnchorEl(null);
    if (isIOS()) { setIosGuideOpen(true); return; }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { state: topBarState } = useTopBar();

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

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] ?? 'ACT Điều hành';

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <Box
        sx={{
          height: 56,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: palette.card,
          borderBottom: `1px solid ${palette.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 4px rgba(15,27,45,0.06)',
          pt: 'env(safe-area-inset-top)',
        }}
      >
        {/* Brand + title (or back button) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {topBarState.onBack ? (
            <IconButton
              size="small"
              onClick={topBarState.onBack}
              sx={{ p: 0.75, ml: -0.5, color: palette.brand.main }}
            >
              <ArrowBackIosNewOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          ) : (
            <Box
              sx={{
                width: 32, height: 32, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${palette.brand.main} 0%, ${palette.brand.dark} 100%)`,
                borderRadius: 1.5,
                boxShadow: '0 2px 6px rgba(45,108,223,0.3)',
              }}
            >
              <SettingsInputAntennaOutlined sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
          )}
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: palette.text.primary }}>
            {topBarState.backLabel ?? title}
          </Typography>
        </Box>

        {/* Right: page action + bell + avatar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {topBarState.action}
          {canReceiveNotifs && (
            <IconButton size="small" onClick={() => setNotifOpen(true)} sx={{ p: 0.75 }}>
              <Badge
                badgeContent={notifData?.unreadCount || 0}
                max={99}
                sx={{ '& .MuiBadge-badge': { bgcolor: status.error.solid, color: '#fff', fontSize: '0.6rem', minWidth: 16, height: 16 } }}
              >
                <NotificationsOutlined sx={{ fontSize: 22, color: notifData?.unreadCount ? status.error.solid : palette.text.muted }} />
              </Badge>
            </IconButton>
          )}
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: avatarBg(user?.fullName || ''), fontSize: '0.8rem', fontWeight: 700 }}>
              {user?.fullName?.charAt(0)}
            </Avatar>
          </IconButton>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              elevation: 4,
              sx: { mt: 0.75, minWidth: 200, borderRadius: 2.5, border: `1px solid ${palette.border}` },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: avatarBg(user?.fullName || ''), fontSize: '0.85rem', fontWeight: 700 }}>
              {user?.fullName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.25 }}>
                {user?.fullName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: ROLE_DOT[user?.role || ''] || palette.brand.main }} />
                <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>{user?.role}</Typography>
              </Box>
            </Box>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => { setAnchorEl(null); navigate('/activity-history'); }}
            sx={{ gap: 1.25, mx: 0.5, mt: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
          >
            <ManageHistoryOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Lịch sử thao tác</Typography>
          </MenuItem>
          {['ADMIN', 'SUPERVISOR'].includes(user?.role ?? '') && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/guide'); }}
              sx={{ gap: 1.25, mx: 0.5, mt: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <MenuBookOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Hướng dẫn sử dụng</Typography>
            </MenuItem>
          )}
          {['ADMIN', 'SUPERVISOR'].includes(user?.role ?? '') && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/sync-history'); }}
              sx={{ gap: 1.25, mx: 0.5, mt: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <HistoryOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Lịch sử đồng bộ tự động</Typography>
            </MenuItem>
          )}
          {['ADMIN', 'SUPERVISOR'].includes(user?.role ?? '') && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/manager-orders'); }}
              sx={{ gap: 1.25, mx: 0.5, mt: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <ListAltOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Phiếu vật tư</Typography>
            </MenuItem>
          )}
          {['ADMIN', 'SUPERVISOR', 'VIEWER'].includes(user?.role ?? '') && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/reports'); }}
              sx={{ gap: 1.25, mx: 0.5, mt: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <AssessmentOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Báo cáo</Typography>
            </MenuItem>
          )}
          {user?.role === 'ADMIN' && (
            <MenuItem
              onClick={() => { setAnchorEl(null); navigate('/users'); }}
              sx={{ gap: 1.25, mx: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <PeopleOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Quản lý người dùng</Typography>
            </MenuItem>
          )}
          {showInstallItem && (
            <MenuItem
              onClick={handleInstall}
              sx={{ gap: 1.25, mx: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' } }}
            >
              <GetApp sx={{ fontSize: 18, color: palette.brand.main }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: palette.brand.main }}>Cài đặt ứng dụng</Typography>
            </MenuItem>
          )}
          <MenuItem
            onClick={handleLogout}
            sx={{ gap: 1.25, color: status.error.solid, mx: 0.5, my: 0.5, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(220,38,38,0.06)' } }}
          >
            <LogoutOutlined sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Đăng xuất</Typography>
          </MenuItem>
          <Divider />
          <Typography sx={{ fontSize: '0.65rem', color: palette.text.muted, textAlign: 'center', py: 0.75 }}>
            v{frontendVersion.version} · {frontendVersion.buildSha}
          </Typography>
        </Menu>

        {/* iOS install guide dialog */}
        <Dialog open={iosGuideOpen} onClose={() => setIosGuideOpen(false)} fullWidth maxWidth="xs"
          slotProps={{ paper: { sx: { borderRadius: 3, mx: 2 } } }}>
          <DialogContent sx={{ pt: 3, pb: 2.5, px: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Thêm vào màn hình chính</Typography>
              <IconButton size="small" onClick={() => setIosGuideOpen(false)}><Close fontSize="small" /></IconButton>
            </Box>
            {[
              { step: 1, icon: <IosShare sx={{ fontSize: 20, color: '#007AFF' }} />, text: 'Nhấn nút ', bold: 'Chia sẻ', sub: 'ở thanh công cụ phía dưới Safari' },
              { step: 2, icon: <AddBoxOutlined sx={{ fontSize: 20, color: '#34C759' }} />, text: 'Chọn ', bold: 'Thêm vào màn hình chính', sub: 'Cuộn xuống trong danh sách tùy chọn' },
              { step: 3, icon: <GetApp sx={{ fontSize: 20, color: palette.brand.main }} />, text: 'Nhấn ', bold: 'Thêm', sub: 'ở góc trên bên phải để xác nhận' },
            ].map(({ step, icon, text, bold, sub }) => (
              <Box key={step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.5 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, bgcolor: `${palette.brand.main}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: palette.brand.main }}>{step}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {icon}
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem' }}>{text}<strong>{bold}</strong></Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>{sub}</Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </DialogContent>
        </Dialog>
      </Box>

      {/* Notifications Drawer */}
      <Drawer
        anchor="bottom"
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        slotProps={{ paper: { sx: { height: '85dvh', borderRadius: '16px 16px 0 0' } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <NotificationsOutlined sx={{ color: palette.brand.main }} />
            <Typography sx={{ flex: 1, fontWeight: 700 }}>Thông báo</Typography>
            {(notifData?.unreadCount ?? 0) > 0 && (
              <Button
                size="small"
                startIcon={<DoneAll sx={{ fontSize: 16 }} />}
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending}
                sx={{ fontSize: '0.75rem', textTransform: 'none', color: palette.brand.main }}
              >
                Đọc tất cả
              </Button>
            )}
            <IconButton size="small" onClick={() => setNotifOpen(false)}><Close fontSize="small" /></IconButton>
          </Box>

          {/* List */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!notifData?.items.length && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 6, gap: 1 }}>
                <NotificationsOutlined sx={{ fontSize: 48, color: '#CBD5E1' }} />
                <Typography sx={{ color: '#94A3B8', fontSize: '0.875rem' }}>Không có thông báo</Typography>
              </Box>
            )}
            <List disablePadding>
              {notifData?.items.map((n: AppNotification) => (
                <ListItem
                  key={n.id}
                  onClick={() => { if (!n.read) readMutation.mutate(n.id); }}
                  sx={{
                    px: 2, py: 1.25, gap: 1.5, alignItems: 'flex-start',
                    bgcolor: n.read ? 'transparent' : `${palette.brand.main}08`,
                    borderBottom: '1px solid', borderColor: 'divider',
                    cursor: n.read ? 'default' : 'pointer',
                    '&:hover': { bgcolor: n.read ? 'rgba(0,0,0,0.02)' : `${palette.brand.main}12` },
                  }}
                >
                  <Box sx={{ mt: 0.25, flexShrink: 0 }}>{NOTIF_ICON[n.type]}</Box>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.825rem', fontWeight: n.read ? 400 : 700, color: palette.text.primary, flex: 1 }}>
                          {n.message}
                        </Typography>
                        {!n.read && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: palette.brand.main, mt: 0.5, flexShrink: 0 }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94A3B8' }}>
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
        </Box>
      </Drawer>
    </>
  );
}
