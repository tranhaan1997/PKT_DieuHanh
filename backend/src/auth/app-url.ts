// FRONTEND_URL (URL trình duyệt dùng để mở app) quyết định chế độ chạy:
//   local  → http://localhost:5183     (backend/.env, npm run start:dev)
//   public → https://pkt.vienthongact.vn (docker-compose.yml trên server)
// SSO_REDIRECT_URI và cờ Secure của cookie suy ra từ đó khi không set riêng.

export function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5183').replace(
    /\/+$/,
    '',
  );
}

// Phải khớp từng ký tự với Redirect URI đăng ký cho SSO_CLIENT_ID trên AMS.
export function ssoRedirectUri(): string {
  return (
    process.env.SSO_REDIRECT_URI || `${frontendUrl()}/api/auth/sso/callback`
  );
}

// Trình duyệt bỏ qua cookie Secure trên http:// → chỉ bật Secure khi app chạy
// https. COOKIE_SECURE=true|false để ép giá trị.
export function secureCookie(): boolean {
  const flag = process.env.COOKIE_SECURE;
  return flag ? flag === 'true' : frontendUrl().startsWith('https://');
}
