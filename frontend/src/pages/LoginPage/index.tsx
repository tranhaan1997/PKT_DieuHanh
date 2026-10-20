import { useEffect, useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import {
  CellTowerOutlined, AssignmentOutlined, BarChartOutlined, LockOutlined,
} from '@mui/icons-material';

const SSO_ERROR_LABELS: Record<string, string> = {
  sso_denied: 'Bạn đã từ chối đăng nhập SSO.',
  invalid_callback: 'Yêu cầu SSO không hợp lệ.',
  invalid_state: 'Phiên SSO đã hết hạn. Vui lòng thử lại.',
  no_email: 'Tài khoản AMS chưa có email. Liên hệ IT.',
  account_inactive: 'Tài khoản bị vô hiệu hóa. Liên hệ quản trị viên.',
  sso_error: 'Lỗi kết nối AMS. Vui lòng thử lại sau.',
  ams_token_expired: 'Phiên đăng nhập AMS đã cũ. Vui lòng đăng xuất khỏi AMS, đăng nhập lại rồi thử SSO lần nữa.',
};

const FEATURES = [
  { icon: <CellTowerOutlined sx={{ fontSize: 18 }} />, text: 'Quản lý trạm BTS / NodeB / eNodeB / gNodeB' },
  { icon: <AssignmentOutlined sx={{ fontSize: 18 }} />, text: 'Phiếu thi công — theo dõi tiến độ theo kỳ' },
  { icon: <BarChartOutlined sx={{ fontSize: 18 }} />, text: 'Dashboard & xuất báo cáo Excel tức thì' },
];

export default function LoginPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) {
      setError(SSO_ERROR_LABELS[code] || 'Đăng nhập SSO thất bại.');
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  const handleSsoLogin = () => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `/api/auth/sso/login?return_to=${returnTo}&t=${Date.now()}`;
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0B1628' }}>

      {/* ── Left panel ─────────────────────────────────────────── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        width: '48%', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden', p: 6,
        background: 'linear-gradient(145deg, #0B1628 0%, #112240 55%, #0D2D5E 100%)',
      }}>
        {/* decorative blobs */}
        <Box sx={{ position: 'absolute', top: '-80px', right: '-80px', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,108,223,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: '5%', left: '-60px', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,164,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* dot grid */}
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Logo */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(45,108,223,0.5)',
          }}>
            <CellTowerOutlined sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#F1F5FB', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.04em', lineHeight: 1 }}>
              Điều hành thi công
            </Typography>
            <Typography sx={{ color: '#4A7AB5', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', mt: 0.25 }}>
              ACT Telecom
            </Typography>
          </Box>
        </Box>

        {/* Hero text */}
        <Box sx={{ position: 'relative' }}>
          <Typography sx={{ color: '#E2EAF8', fontWeight: 800, fontSize: '2rem', lineHeight: 1.2, mb: 1.5, letterSpacing: '-0.02em' }}>
            Quản lý tiến độ<br />
            <Box component="span" sx={{ background: 'linear-gradient(90deg, #60A5FA, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              thi công viễn thông
            </Box>
          </Typography>
          <Typography sx={{ color: '#5A7FA8', fontSize: '0.875rem', lineHeight: 1.7, mb: 4 }}>
            Hệ thống điều hành & theo dõi tiến độ<br />triển khai trạm theo kỳ thực hiện
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {FEATURES.map((f) => (
              <Box key={f.text} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 2,
                backdropFilter: 'blur(4px)',
              }}>
                <Box sx={{ color: '#60A5FA', flexShrink: 0 }}>{f.icon}</Box>
                <Typography sx={{ color: '#8BAECF', fontSize: '0.8375rem' }}>{f.text}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ position: 'relative', color: '#2E4A6A', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
          © 2026 Điều hành thi công giải pháp — Confidential
        </Typography>
      </Box>

      {/* ── Right panel ────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        bgcolor: '#F4F7FC',
        p: { xs: 3, sm: 6 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>

          {/* mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CellTowerOutlined sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, color: '#0F1E3C', fontSize: '1rem', letterSpacing: '0.04em' }}>
              Điều hành thi công giải pháp
            </Typography>
          </Box>

          {/* Card */}
          <Box sx={{
            bgcolor: '#fff', borderRadius: 4, p: '44px 40px',
            boxShadow: '0 8px 40px rgba(11,22,40,0.10)',
            border: '1px solid #E4EAF4',
          }}>
            {/* icon */}
            <Box sx={{ textAlign: 'center', mb: 3.5 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
                background: 'linear-gradient(135deg, #EEF3FF 0%, #DBEAFE 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(45,108,223,0.15)',
              }}>
                <LockOutlined sx={{ fontSize: 30, color: '#2D6CDF' }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.375rem', color: '#0F1E3C', letterSpacing: '-0.02em', mb: 0.5 }}>
                Đăng nhập hệ thống
              </Typography>
              <Typography sx={{ fontSize: '0.825rem', color: '#8A9BB5' }}>
                Sử dụng tài khoản xác thực tập trung
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth variant="contained" size="large"
              onClick={handleSsoLogin}
              startIcon={<LockOutlined />}
              sx={{
                py: 1.625, fontWeight: 700, fontSize: '0.9375rem', borderRadius: 2.5,
                background: 'linear-gradient(135deg, #2D6CDF 0%, #1B4DA6 100%)',
                boxShadow: '0 6px 20px rgba(45,108,223,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #3B7AEF 0%, #2358BC 100%)',
                  boxShadow: '0 8px 24px rgba(45,108,223,0.45)',
                },
              }}
            >
              Đăng nhập bằng SSO
            </Button>
          </Box>

          <Typography sx={{ textAlign: 'center', mt: 3, fontSize: '0.75rem', color: '#8A9BB5' }}>
            Hệ thống dành riêng cho nhân viên nội bộ ACT Telecom
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
