import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Avatar, Tooltip, Menu, MenuItem, Divider,
  useMediaQuery, useTheme,
} from '@mui/material';
import BottomNav, { NAV_BOTTOM_OFFSET } from './BottomNav';
import MobileTopBar from './MobileTopBar';
import NotificationBell from './NotificationBell';
import { TopBarProvider } from './TopBarContext';
import { NAV_GROUPS, TECH_NAV_GROUPS, allNav, visibleGroups } from './navConfig';
import type { NavItem as NavItemDef } from './navConfig';
import {
  ChevronLeft, ChevronRight, LogoutOutlined,
  SettingsInputAntennaOutlined, PeopleOutlined, KeyboardArrowDown, MenuBookOutlined,
  HistoryOutlined, ManageHistoryOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { palette, status } from '../../theme/tokens';
import { getBackendVersion, frontendVersion } from '../../api/version';

const DRAWER_WIDTH = 248;
const MINI_WIDTH = 62;
const SB = palette.sidebar;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  SUPERVISOR: 'Điều hành',
  TECHNICIAN: 'Kỹ thuật thi công',
  VIEWER: 'Người xem',
};

const ROLE_DOT: Record<string, string> = {
  ADMIN: status.error.solid,
  SUPERVISOR: status.warning.solid,
  TECHNICIAN: status.success.solid,
  VIEWER: status.info.solid,
};

function avatarBg(name: string) {
  const p = [palette.brand.main, palette.accent.main, status.purple.solid, status.warning.solid, status.error.solid, status.info.solid];
  return p[(name?.charCodeAt(0) || 0) % p.length];
}

/* ─── Sidebar nav item ──────────────────────────────────────────── */
function NavItem({ item, collapsed, active }: { item: NavItemDef; collapsed: boolean; active: boolean }) {
  const navigate = useNavigate();

  const btn = (
    <ListItemButton
      selected={active}
      onClick={() => navigate(item.path)}
      disableRipple
      sx={{
        px: collapsed ? 0 : 1.75,
        py: 0.9,
        borderRadius: 0,
        position: 'relative',
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: 42,
        color: active ? palette.brand.main : SB.textDim,
        background: active ? SB.activeBg : 'transparent',
        borderLeft: `3px solid ${active ? SB.activeBar : 'transparent'}`,
        transition: 'all 0.15s ease',
        '&:hover': {
          background: active ? SB.activeBg : 'rgba(45,108,223,0.06)',
          color: active ? palette.brand.main : palette.brand.dark,
        },
        '&.Mui-selected': { background: SB.activeBg },
        '&.Mui-selected:hover': { background: SB.activeBg },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 36,
          color: 'inherit',
          '& svg': { fontSize: 20 },
          ...(collapsed && { justifyContent: 'center', display: 'flex' }),
        }}
      >
        {item.icon}
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={item.label}
          slotProps={{ primary: { sx: { fontSize: '0.8375rem', fontWeight: active ? 600 : 500, letterSpacing: '0.01em', whiteSpace: 'nowrap' } } }}
        />
      )}
    </ListItemButton>
  );

  return collapsed ? <Tooltip title={item.label} placement="right" arrow>{btn}</Tooltip> : btn;
}

/* ─── Main layout ───────────────────────────────────────────────── */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { data: backendVersion } = useQuery({
    queryKey: ['backend-version'],
    queryFn: getBackendVersion,
    staleTime: 5 * 60_000,
  });

  const activeGroups = visibleGroups(user?.role === 'TECHNICIAN' ? TECH_NAV_GROUPS : NAV_GROUPS, user?.role);

  const isActive = (item: typeof allNav[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const currentPage = allNav.find(isActive);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const w = collapsed ? MINI_WIDTH : DRAWER_WIDTH;

  if (isMobile) {
    return (
      <TopBarProvider>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', bgcolor: 'background.default' }}>
          <MobileTopBar />
          <Box component="main" sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', p: 1.5, pb: `${NAV_BOTTOM_OFFSET}px` }}>
            <Outlet />
          </Box>
          <BottomNav />
        </Box>
      </TopBarProvider>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Box
        sx={{
          width: w, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: `linear-gradient(180deg, ${SB.bgTop} 0%, ${SB.bgBottom} 100%)`,
          transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
          overflow: 'hidden',
          position: 'fixed', top: 0, left: 0, bottom: 0,
          zIndex: 1200,
          boxShadow: '2px 0 12px rgba(45,108,223,0.10), 1px 0 0 #D8E4F8',
        }}
      >

        {/* Brand */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.25,
            px: collapsed ? 0 : 2, height: 60, overflow: 'hidden',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: `1px solid ${SB.line}`, flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 36, height: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${palette.brand.main} 0%, ${palette.brand.dark} 100%)`,
              borderRadius: 2, boxShadow: '0 2px 8px rgba(45,108,223,0.3)',
            }}
          >
            <SettingsInputAntennaOutlined sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          {!collapsed && (
            <Box>
              <Typography sx={{ color: palette.text.primary, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.04em', lineHeight: 1.1, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                Điều hành
              </Typography>
              <Typography sx={{ color: SB.textMute, fontSize: '0.65rem', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Thi công giải pháp
              </Typography>
            </Box>
          )}
        </Box>

        {/* Nav groups */}
        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: SB.line2, borderRadius: 4 },
        }}>
          <List dense disablePadding>
            {activeGroups.map((group) => {
              const visibleItems = group.items;
              return (
                <Box key={group.label} sx={{ mb: 0.5 }}>
                  {!collapsed && (
                    <Typography sx={{ px: 2.25, py: 0.75, pb: 0.5, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: SB.textMute, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {group.label}
                    </Typography>
                  )}
                  {visibleItems.map((item) => (
                    <NavItem key={item.path} item={item} collapsed={collapsed} active={isActive(item)} />
                  ))}
                  {!collapsed && <Box sx={{ height: 8 }} />}
                </Box>
              );
            })}
          </List>
        </Box>

        {/* Bottom: version + collapse toggle */}
        <Box sx={{ borderTop: `1px solid ${SB.line}`, flexShrink: 0 }}>
          {!collapsed && (
            <Tooltip title={`Backend: ${backendVersion?.version ?? '…'} (${backendVersion?.buildSha ?? '…'})`} placement="right" arrow>
              <Typography sx={{ px: 2.25, pt: 1, fontSize: '0.625rem', color: SB.textMute, whiteSpace: 'nowrap', cursor: 'default' }}>
                v{frontendVersion.version} · {frontendVersion.buildSha}
              </Typography>
            </Tooltip>
          )}
          {/* Collapse toggle */}
          <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', borderTop: `1px solid ${SB.line}` }}>
            <Tooltip title={collapsed ? 'Mở rộng' : 'Thu gọn'} placement="right" arrow>
              <IconButton size="small" onClick={() => setCollapsed(!collapsed)} sx={{ width: 27, height: 27, color: SB.textDim, bgcolor: 'rgba(45,108,223,0.06)', border: `1px solid ${SB.line}`, borderRadius: 1.25, '&:hover': { color: palette.brand.main, bgcolor: SB.line } }}>
                {collapsed ? <ChevronRight sx={{ fontSize: 16 }} /> : <ChevronLeft sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── Main area ───────────────────────────────────────────── */}
      <Box component="main" sx={{ flex: 1, ml: `${w}px`, transition: 'margin-left 0.22s cubic-bezier(.4,0,.2,1)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <Box
          sx={{
            height: 54, px: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            bgcolor: palette.card,
            borderBottom: `1px solid ${palette.border}`,
            position: 'sticky', top: 0, zIndex: 100,
            boxShadow: '0 1px 4px rgba(15,27,45,0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsInputAntennaOutlined sx={{ fontSize: 15, color: palette.brand.main }} />
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, fontWeight: 500 }}>Điều hành </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.faint }}>/</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.primary, fontWeight: 600 }}>
              {currentPage?.label || 'Dashboard'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, fontWeight: 500, letterSpacing: '0.02em' }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Typography>
            <Box sx={{ width: '1px', height: 20, bgcolor: palette.border }} />

            <NotificationBell />

            {/* User chip */}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.25, py: 0.625,
                borderRadius: 2.5,
                border: `1px solid ${palette.border}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: palette.cardAlt, borderColor: palette.borderStrong },
              }}
            >
              <Avatar sx={{ width: 30, height: 30, bgcolor: avatarBg(user?.fullName || ''), fontSize: '0.75rem', fontWeight: 700 }}>
                {user?.fullName?.charAt(0)}
              </Avatar>
              <Box sx={{ lineHeight: 1 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: palette.text.primary, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                  {user?.fullName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: ROLE_DOT[user?.role || ''] || palette.brand.light, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.68rem', color: palette.text.muted, whiteSpace: 'nowrap' }}>
                    {ROLE_LABEL[user?.role || ''] || user?.role}
                  </Typography>
                </Box>
              </Box>
              <KeyboardArrowDown sx={{ fontSize: 16, color: palette.text.muted, ml: 0.25 }} />
            </Box>

            {/* Dropdown menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{
                paper: {
                  elevation: 4,
                  sx: { mt: 0.75, minWidth: 220, borderRadius: 2.5, border: `1px solid ${palette.border}`, boxShadow: '0 8px 24px rgba(15,27,45,0.12)' },
                },
              }}
            >
              {/* Profile header in menu */}
              <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ width: 40, height: 40, bgcolor: avatarBg(user?.fullName || ''), fontSize: '0.9rem', fontWeight: 700 }}>
                  {user?.fullName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.25 }}>
                    {user?.fullName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ROLE_DOT[user?.role || ''] || palette.brand.light }} />
                    <Typography sx={{ fontSize: '0.72rem', color: palette.text.muted }}>
                      {ROLE_LABEL[user?.role || ''] || user?.role}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Divider />
              <MenuItem
                onClick={() => { setAnchorEl(null); navigate('/activity-history'); }}
                sx={{ gap: 1.25, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' }, mx: 0.5, mt: 0.5, borderRadius: 1.5 }}
              >
                <ManageHistoryOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Lịch sử thao tác</Typography>
              </MenuItem>
              {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
                <MenuItem
                  onClick={() => { setAnchorEl(null); navigate('/guide'); }}
                  sx={{ gap: 1.25, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' }, mx: 0.5, mt: 0.5, borderRadius: 1.5 }}
                >
                  <MenuBookOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Hướng dẫn sử dụng</Typography>
                </MenuItem>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
                <MenuItem
                  onClick={() => { setAnchorEl(null); navigate('/sync-history'); }}
                  sx={{ gap: 1.25, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' }, mx: 0.5, borderRadius: 1.5 }}
                >
                  <HistoryOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Lịch sử đồng bộ tự động</Typography>
                </MenuItem>
              )}
              {user?.role === 'ADMIN' && (
                <MenuItem
                  onClick={() => { setAnchorEl(null); navigate('/users'); }}
                  sx={{ gap: 1.25, '&:hover': { bgcolor: 'rgba(45,108,223,0.06)' }, mx: 0.5, borderRadius: 1.5 }}
                >
                  <PeopleOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Quản lý người dùng</Typography>
                </MenuItem>
              )}
              <MenuItem
                onClick={() => { setAnchorEl(null); handleLogout(); }}
                sx={{ gap: 1.25, color: status.error.solid, '&:hover': { bgcolor: 'rgba(220,38,38,0.06)' }, mx: 0.5, my: 0.5, borderRadius: 1.5 }}
              >
                <LogoutOutlined sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Đăng xuất</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Page content */}
        <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 }, minHeight: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
