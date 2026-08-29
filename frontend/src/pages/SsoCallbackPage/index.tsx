import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

const SSO_ERRORS: Record<string, string> = {
  sso_denied: 'Bạn đã từ chối đăng nhập trên trang AMS.',
  invalid_callback: 'Yêu cầu đăng nhập không hợp lệ.',
  invalid_state: 'Phiên đăng nhập đã hết hạn (> 5 phút). Vui lòng thử lại.',
  no_email: 'Tài khoản AMS chưa có email. Liên hệ IT để bổ sung.',
  account_inactive: 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.',
  sso_error: 'Lỗi kết nối AMS. Vui lòng thử lại sau.',
};

export default function SsoCallbackPage() {
  const navigate = useNavigate();
  const { loginWithSso } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check for error from backend redirect
    const searchParams = new URLSearchParams(window.location.search);
    const errorCode = searchParams.get('error');
    if (errorCode) {
      setErrorMsg(SSO_ERRORS[errorCode] || 'Đăng nhập SSO thất bại.');
      const t = setTimeout(() => navigate('/login'), 3500);
      return () => clearTimeout(t);
    }

    // Read tokens from URL fragment (#token=...&amsToken=...)
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const amsToken = params.get('amsToken') || '';

    if (!token) {
      navigate('/login');
      return;
    }

    // Remove fragment from URL so tokens don't stay in browser history
    window.history.replaceState(null, '', window.location.pathname);

    // Store AMS access token for admin sync feature
    if (amsToken) {
      localStorage.setItem('dh_ams_token', amsToken);
    }

    loginWithSso(token)
      .then(() => navigate('/'))
      .catch(() => navigate('/login'));
  }, []);

  if (errorMsg) {
    return (
      <Box
        sx={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', bgcolor: '#EBF0F9', gap: 2, p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 480 }}>{errorMsg}</Alert>
        <Typography variant="caption" color="text.secondary">
          Đang chuyển về trang đăng nhập…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', bgcolor: '#EBF0F9', gap: 2,
      }}
    >
      <CircularProgress size={32} />
      <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
        Đang xác thực tài khoản AMS…
      </Typography>
    </Box>
  );
}
