import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogContent, IconButton, Slide,
} from '@mui/material';
import { Close, GetApp, IosShare, AddBoxOutlined, MoreVert } from '@mui/icons-material';
import { palette } from '../../theme/tokens';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    // Already installed or dismissed recently
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - +dismissed < 7 * 24 * 60 * 60 * 1000) return;

    if (isIOS()) {
      // Show iOS guide after 2s
      const t = setTimeout(() => setShowIOS(true), 2000);
      return () => clearTimeout(t);
    }

    if (isAndroid()) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowAndroid(true);
      };
      window.addEventListener('beforeinstallprompt', handler as EventListener);
      return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShowAndroid(false);
    setShowIOS(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroid(false);
    }
    setDeferredPrompt(null);
  };

  // ── Android banner ────────────────────────────────────────────────────────
  if (showAndroid) {
    return (
      <Slide direction="up" in={showAndroid}>
        <Box
          sx={{
            position: 'fixed', bottom: 96, left: 12, right: 12, zIndex: 1300,
            bgcolor: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(15,27,45,0.18)',
            p: 2,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2, flexShrink: 0,
              background: `linear-gradient(135deg, ${palette.brand.main}, ${palette.brand.dark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${palette.brand.main}40`,
            }}
          >
            <GetApp sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.3 }}>
              Cài đặt ứng dụng
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, lineHeight: 1.4 }}>
              Thêm vào màn hình chính để truy cập nhanh hơn
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={handleInstall}
            sx={{
              borderRadius: 2, px: 1.5, fontSize: '0.8rem', fontWeight: 700,
              background: `linear-gradient(135deg, ${palette.brand.main}, ${palette.brand.dark})`,
              boxShadow: 'none', flexShrink: 0,
            }}
          >
            Cài đặt
          </Button>
          <IconButton size="small" onClick={dismiss} sx={{ flexShrink: 0, p: 0.5 }}>
            <Close sx={{ fontSize: 18, color: palette.text.muted }} />
          </IconButton>
        </Box>
      </Slide>
    );
  }

  // ── iOS guide dialog ──────────────────────────────────────────────────────
  if (showIOS) {
    return (
      <Dialog
        open={showIOS}
        onClose={dismiss}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 3, mx: 2, overflow: 'visible' } } }}
      >
        <DialogContent sx={{ pt: 3, pb: 2.5, px: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                background: `linear-gradient(135deg, ${palette.brand.main}, ${palette.brand.dark})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GetApp sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: palette.text.primary }}>
                  Cài đặt ứng dụng
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: palette.text.muted }}>
                  Thêm vào màn hình chính
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={dismiss} sx={{ mt: -0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[
              {
                step: 1,
                icon: <IosShare sx={{ fontSize: 20, color: '#007AFF' }} />,
                text: 'Nhấn nút',
                bold: 'Chia sẻ',
                sub: 'ở thanh công cụ phía dưới Safari',
              },
              {
                step: 2,
                icon: <AddBoxOutlined sx={{ fontSize: 20, color: '#34C759' }} />,
                text: 'Chọn',
                bold: 'Thêm vào màn hình chính',
                sub: 'Cuộn xuống trong danh sách tùy chọn',
              },
              {
                step: 3,
                icon: <MoreVert sx={{ fontSize: 20, color: palette.brand.main }} />,
                text: 'Nhấn',
                bold: 'Thêm',
                sub: 'ở góc trên bên phải để xác nhận',
              },
            ].map(({ step, icon, text, bold, sub }) => (
              <Box key={step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  bgcolor: `${palette.brand.main}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mt: 0.1,
                }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.brand.main }}>
                    {step}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  {icon}
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', color: palette.text.primary }}>
                      {text} <strong>{bold}</strong>
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>
                      {sub}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          <Button
            fullWidth variant="outlined" size="small"
            onClick={dismiss}
            sx={{ mt: 2.5, borderRadius: 2, fontSize: '0.8rem', color: palette.text.muted, borderColor: palette.border }}
          >
            Để sau
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
