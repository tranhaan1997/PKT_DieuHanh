import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { SsoService } from './sso.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from './jwt-refresh.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
}

// Trình duyệt bỏ qua cookie Secure trên http:// → COOKIE_SECURE=false khi chạy
// production qua HTTP trong LAN; không set thì Secure theo NODE_ENV như cũ.
function secureCookie(): boolean {
  const flag = process.env.COOKIE_SECURE;
  return flag ? flag === 'true' : process.env.NODE_ENV === 'production';
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private ssoService: SsoService,
  ) {}

  // ── Username / password ───────────────────────────────────────────

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.username, dto.password);
    res.cookie('dh_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: secureCookie(),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  async refresh(@CurrentUser() user: any) {
    return this.authService.refreshToken(user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return user;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('dh_refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out' };
  }

  // ── SSO OAuth 2.0 ─────────────────────────────────────────────────

  @Get('sso/login')
  ssoLogin(@Query('return_to') returnTo: string, @Res() res: Response) {
    // AMS chỉ cho đăng ký 1 Redirect URI mỗi client → khi có SSO_REDIRECT_URI thì
    // dùng nó (khớp với bước exchangeCode) và quay về đúng origin của nó, bỏ qua
    // return_to để không redirect token sang origin khác.
    const redirectUri = process.env.SSO_REDIRECT_URI;
    const fallback = process.env.FRONTEND_URL || 'http://localhost:5183';
    const origin = redirectUri
      ? new URL(redirectUri).origin
      : returnTo || fallback;
    const callbackUri = redirectUri || `${origin}/api/auth/sso/callback`;
    const loginUrl = this.ssoService.getLoginUrl(origin, callbackUri);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.redirect(loginUrl);
  }

  @Get('sso/callback')
  async ssoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5183';

    if (error) {
      return res.redirect(`${frontend}/login?error=sso_denied`);
    }
    if (!code || !state) {
      return res.redirect(`${frontend}/login?error=invalid_callback`);
    }

    const stateData = this.ssoService.validateAndConsumeState(state);
    if (!stateData) {
      return res.redirect(`${frontend}/login?error=invalid_state`);
    }

    const { returnTo } = stateData;

    try {
      const tokens = await this.ssoService.exchangeCode(code);
      const ssoUser = await this.ssoService.getUserInfo(tokens.accessToken);
      const user = await this.ssoService.syncUserFromSso(ssoUser);
      const accessToken = this.ssoService.issueJwt(user);

      // Set httpOnly refresh cookie — same mechanism as password login
      // so page-refresh works without depending on AMS refresh endpoint
      const refreshToken = this.authService.signRefreshToken(user);
      res.cookie('dh_refresh_token', refreshToken, {
        httpOnly: true,
        secure: secureCookie(),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
      });

      const fragment =
        `token=${encodeURIComponent(accessToken)}` +
        `&amsToken=${encodeURIComponent(tokens.accessToken)}`;

      return res.redirect(`${returnTo}/auth/callback#${fragment}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        message === 'no_email'
          ? 'no_email'
          : message === 'account_inactive'
            ? 'account_inactive'
            : /Token has expired/i.test(message)
              ? 'ams_token_expired'
              : 'sso_error';
      console.error('[SSO callback]', message);
      return res.redirect(`${returnTo}/login?error=${code}`);
    }
  }

  @Post('sso/refresh')
  async ssoRefresh(@Body('ssoRefreshToken') ssoRefreshToken: string) {
    if (!ssoRefreshToken) throw new UnauthorizedException();
    return this.ssoService.refreshSsoToken(ssoRefreshToken);
  }

  // ── SSO direct token exchange (DMS / iframe use-cases) ────────────

  @Post('sso-token')
  async ssoToken(@Body('token') amsToken: string) {
    if (!amsToken) throw new UnauthorizedException();
    return this.ssoService.exchangeAmsAccessToken(amsToken);
  }

  @Post('sso-exchange')
  async ssoExchange(@Body('accessToken') amsAccessToken: string) {
    if (!amsAccessToken) throw new UnauthorizedException();
    return this.ssoService.exchangeAmsAccessToken(amsAccessToken);
  }
}
