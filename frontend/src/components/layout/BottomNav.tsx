import { useEffect, useState } from 'react';
import { Box, Paper, Typography, ButtonBase } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { palette } from '../../theme/tokens';
import { mobileTabsFor, isPathActive, MORE_PATH } from './navConfig';
import type { MobileTab } from './navConfig';
import MoreSheet from './MoreSheet';

export const NAV_BOTTOM_OFFSET = 84; // px — used by pages for pb / FAB bottom
export const NAV_FAB_BOTTOM = NAV_BOTTOM_OFFSET + 12; // px — `bottom` of page FABs so they clear the island

/** True while the on-screen keyboard is up (visual viewport shrinks well below the layout viewport). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setOpen(window.innerHeight - vv.height * vv.scale > 150);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return open;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  const tabs = mobileTabsFor(user?.role);
  const routeTabs = tabs.filter((t) => t.path !== MORE_PATH);
  const onRouteTab = routeTabs.some((t) => isPathActive(t.path, location.pathname));

  // "Thêm" lights up while its sheet is open, or when the current page lives inside it
  const isActive = (item: MobileTab) =>
    item.path === MORE_PATH ? moreOpen || !onRouteTab : !moreOpen && isPathActive(item.path, location.pathname);

  const handleTap = (item: MobileTab) => {
    if (item.path === MORE_PATH) { setMoreOpen(true); return; }
    if (isPathActive(item.path, location.pathname)) {
      // re-tap active tab → back to top
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(item.path);
  };

  return (
    <>
    {/* Outer wrapper: fixed, floating 12px above screen bottom */}
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
        transform: keyboardOpen ? 'translateY(120%)' : 'none',
        transition: 'transform 0.2s ease',
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
          pointerEvents: keyboardOpen ? 'none' : 'auto',
        }}
      >
        <Box component="nav" sx={{ display: 'flex', alignItems: 'stretch', height: 58, px: 0.5 }}>
          {tabs.map((item) => {
            const active = isActive(item);

            /* ── Focal tab (Tra cứu) ── */
            if (item.focal) {
              return (
                <ButtonBase
                  key={item.path}
                  onClick={() => handleTap(item)}
                  aria-current={active ? 'page' : undefined}
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
                onClick={() => handleTap(item)}
                aria-current={active && item.path !== MORE_PATH ? 'page' : undefined}
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
    <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
