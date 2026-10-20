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
import { frontendUrl, secureCookie } from './app-url';

class LoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
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
  ssoLogin(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    try {
      return res.redirect(this.ssoService.getLoginUrl());
    } catch (err) {
      // Thiếu/sai biến SSO trên server → báo rõ ở trang login thay vì trả 500
      console.error('[SSO login]', err instanceof Error ? err.message : err);
      return res.redirect(`${frontendUrl()}/login?error=sso_not_configured`);
    }
  }

  @Get('sso/callback')
  async ssoCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontend = frontendUrl();

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
      // fetch() chỉ báo "fetch failed" — lý do thật (ENOTFOUND, ETIMEDOUT…) nằm ở cause
      const cause =
        err instanceof Error && err.cause
          ? ((err.cause as { code?: string }).code ?? String(err.cause))
          : '';
      const code =
        message === 'no_email'
          ? 'no_email'
          : message === 'account_inactive'
            ? 'account_inactive'
            : /Token has expired/i.test(message)
              ? 'ams_token_expired'
              : message === 'fetch failed'
                ? 'ams_unreachable'
                : 'sso_error';
      console.error('[SSO callback]', message, cause ? `(cause: ${cause})` : '');
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
