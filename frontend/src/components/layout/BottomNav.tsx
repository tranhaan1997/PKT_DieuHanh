import React from 'react';
import { Box, Paper, Typography, ButtonBase } from '@mui/material';
import {
  Dashboard, CellTower, CalendarMonth, Assignment, TravelExplore,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { palette } from '../../theme/tokens';

interface NavItem { label: string; path: string; icon: React.ReactNode; focal?: boolean }

const ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/',           icon: <Dashboard sx={{ fontSize: 22 }} /> },
  { label: 'Phiếu TC', path: '/work-orders', icon: <Assignment sx={{ fontSize: 22 }} /> },
  { label: 'Tra cứu',  path: '/lookup',      icon: <TravelExplore sx={{ fontSize: 26 }} />, focal: true },
  { label: 'Kỳ TH',   path: '/periods',     icon: <CalendarMonth sx={{ fontSize: 22 }} /> },
  { label: 'Trạm',     path: '/sites',       icon: <CellTower sx={{ fontSize: 22 }} /> },
];

export const NAV_BOTTOM_OFFSET = 84; // px — used by pages for pb / FAB bottom

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  useAuth(); // kept for future role-based items

  const isActive = (item: NavItem) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);

  return (
    /* Outer wrapper: fixed, floating 12px above screen bottom */
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        px: 2,
        pb: 'max(12px, env(safe-area-inset-bottom))',
        /* Extra room at top so the FAB can poke above the island */
        pt: '28px',
        pointerEvents: 'none', // let taps fall through the transparent pt area
      }}
    >
      {/* Island */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '28px',
          overflow: 'visible',
          bgcolor: palette.card,
          border: `1px solid ${palette.border}`,
          boxShadow: '0 8px 32px rgba(15,27,45,0.13), 0 2px 8px rgba(45,108,223,0.07)',
          backdropFilter: 'blur(20px)',
          pointerEvents: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'stretch', height: 58, px: 0.5 }}>
          {ITEMS.map((item) => {
            const active = isActive(item);

            /* ── Focal tab (Tra cứu) ── */
            if (item.focal) {
              return (
                <ButtonBase
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pb: 1,
                    position: 'relative',
                    overflow: 'visible',
                    borderRadius: '28px',
                    '&:active': { opacity: 0.85 },
                  }}
                >
                  {/* FAB — sits 14px above the island top */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 'calc(100% - 30px)',
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: active
                        ? `linear-gradient(145deg, ${palette.brand.dark} 0%, ${palette.brand.main} 100%)`
                        : `linear-gradient(145deg, ${palette.brand.main} 0%, ${palette.accent.main} 100%)`,
                      boxShadow: active
                        ? `0 6px 24px ${palette.brand.main}65`
                        : `0 4px 16px ${palette.brand.main}45`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      transition: 'all 0.2s ease',
                      border: `3px solid ${palette.card}`,
                    }}
                  >
                    {item.icon}
                  </Box>

                  {/* Label */}
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: active ? 700 : 500,
                      lineHeight: 1,
                      color: active ? palette.brand.main : palette.text.muted,
                    }}
                  >
                    {item.label}
                  </Typography>
                </ButtonBase>
              );
            }

            /* ── Regular tab ── */
            return (
              <ButtonBase
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  color: active ? palette.brand.main : palette.text.muted,
                  transition: 'color 0.15s',
                  position: 'relative',
                  borderRadius: '28px',
                  '&:active': { bgcolor: `${palette.brand.main}08` },
                }}
              >
                {active && (
                  <Box sx={{
                    position: 'absolute', top: 7, width: 4, height: 4,
                    borderRadius: '50%', bgcolor: palette.brand.main,
                  }} />
                )}
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 38, height: 28, borderRadius: 2,
                    bgcolor: active ? `${palette.brand.main}12` : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: active ? 700 : 500, lineHeight: 1, color: 'inherit' }}>
                  {item.label}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
