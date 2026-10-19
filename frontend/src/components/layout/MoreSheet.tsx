import { Box, Drawer, Typography, ButtonBase } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { palette } from '../../theme/tokens';
import { moreGroupsFor, isPathActive } from './navConfig';

interface Props { open: boolean; onClose: () => void }

/** Bottom sheet "Thêm" — mọi trang không nằm trên bottom nav, lọc theo role. */
export default function MoreSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const groups = moreGroupsFor(user?.role);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            maxHeight: '80dvh',
            borderRadius: '20px 20px 0 0',
            px: 2,
            pt: 1,
            pb: 'max(16px, env(safe-area-inset-bottom))',
          },
        },
      }}
    >
      {/* Puller */}
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: palette.borderStrong, mx: 'auto', mb: 1 }} />

      {groups.map((group) => (
        <Box key={group.label} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: palette.text.muted, mb: 1, px: 0.5 }}>
            {group.label}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 1.5, columnGap: 1 }}>
            {group.items.map((item) => {
              const active = isPathActive(item.path, location.pathname, item.exact);
              return (
                <ButtonBase
                  key={item.path}
                  onClick={() => go(item.path)}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, py: 0.5, borderRadius: 2 }}
                >
                  <Box
                    sx={{
                      width: 46, height: 46, borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: active ? palette.brand.main : palette.brand.soft,
                      color: active ? '#fff' : palette.brand.main,
                      '& svg': { fontSize: 22 },
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.6875rem', lineHeight: 1.25, textAlign: 'center',
                      fontWeight: active ? 700 : 500,
                      color: active ? palette.brand.main : palette.text.secondary,
                    }}
                  >
                    {item.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      ))}
    </Drawer>
  );
}
