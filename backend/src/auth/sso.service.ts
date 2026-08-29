import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

interface SsoTokenResponse {
  access_token?: string;
  AccessToken?: string;
  refresh_token?: string;
  RefreshToken?: string;
}

interface SsoUserInfo {
  sub?: string;
  UserId?: string;
  email?: string;
  Email?: string;
  name?: string; // standard OIDC full name claim
  FullName?: string;
  fullName?: string;
  Name?: string;
  username?: string;
  UserName?: string;
  roles?: string[];
  Roles?: string[];
  position?: string;
  Position?: string;
  department?: string;
  Department?: string;
  departmentGroup?: string;
  DepartmentGroup?: string;
  // Tên trường thực tế xác nhận từ raw payload AMS /Api/Sso/UserInfo (xem log
  // SsoService khi department rỗng) — không phải claim OIDC chuẩn.
  departmentId?: string;
  departmentName?: string;
  departmentFullName?: string;
  // Fallback dự phòng, phòng trường hợp AMS đổi sang style HRM khác (ams-sync.service.ts)
  OPER_NAME?: string;
  FULLDEPTNAME?: string;
  DEPT_NAME?: string;
  DEPT_GROUP?: string;
  POS_NAME?: string;
  MOBILE?: string;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private stateMap = new Map<string, { returnTo: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    setInterval(() => this.cleanExpiredStates(), 10 * 60 * 1000);
  }

  getLoginUrl(returnTo: string, callbackUri?: string): string {
    const authorizeUrl = process.env.SSO_AUTHORIZE_URL;
    if (!authorizeUrl) throw new Error('SSO_AUTHORIZE_URL is not configured');

    const state = crypto.randomBytes(32).toString('hex');
    this.stateMap.set(state, {
      returnTo,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const redirectUri = callbackUri || process.env.SSO_REDIRECT_URI || '';

    const params = new URLSearchParams({
      client_id: process.env.SSO_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
    });

    return `${authorizeUrl}?${params.toString()}`;
  }

  validateAndConsumeState(state: string): { returnTo: string } | null {
    const entry = this.stateMap.get(state);
    if (!entry || Date.now() > entry.expiresAt) return null;
    this.stateMap.delete(state);
    return { returnTo: entry.returnTo };
  }

  async exchangeCode(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const resp = await fetch(process.env.SSO_TOKEN_URL || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SSO_CLIENT_ID || '',
        client_secret: process.env.SSO_CLIENT_SECRET || '',
        code,
        redirect_uri: process.env.SSO_REDIRECT_URI || '',
      }).toString(),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`AMS token exchange failed: ${resp.status} ${body}`);
    }

    const data = (await resp.json()) as SsoTokenResponse;
    return {
      accessToken: data.access_token || data.AccessToken || '',
      refreshToken: data.refresh_token || data.RefreshToken || '',
    };
  }

  async getUserInfo(bearerToken: string): Promise<SsoUserInfo> {
    const resp = await fetch(process.env.SSO_USERINFO_URL || '', {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!resp.ok) throw new Error(`AMS UserInfo failed: ${resp.status}`);
    return resp.json() as Promise<SsoUserInfo>;
  }

  async refreshSsoToken(ssoRefreshToken: string) {
    const resp = await fetch(process.env.SSO_REFRESH_URL || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ RefreshToken: ssoRefreshToken }),
    });

    if (!resp.ok) throw new UnauthorizedException('SSO refresh thất bại');

    const data = (await resp.json()) as SsoTokenResponse;
    const newAmsToken = data.access_token || data.AccessToken || '';
    const newRefreshToken =
      data.refresh_token || data.RefreshToken || ssoRefreshToken;

    const ssoUser = await this.getUserInfo(newAmsToken);
    const user = await this.syncUserFromSso(ssoUser);

    return {
      accessToken: this.issueJwt(user),
      ssoRefreshToken: newRefreshToken,
    };
  }

  async exchangeAmsAccessToken(amsToken: string) {
    const ssoUser = await this.getUserInfo(amsToken);
    const user = await this.syncUserFromSso(ssoUser);
    return {
      token: this.issueJwt(user),
      user: this.sanitize(user),
    };
  }

  async syncUserFromSso(ssoUser: SsoUserInfo) {
    const ssoId = ssoUser.sub || ssoUser.UserId || null;
    const email = (ssoUser.email || ssoUser.Email || '').toLowerCase() || null;
    const fullName =
      ssoUser.FullName ||
      ssoUser.fullName ||
      ssoUser.Name ||
      ssoUser.name ||
      ssoUser.OPER_NAME ||
      'SSO User';
    const roles = ssoUser.roles || ssoUser.Roles || [];
    const role = this.mapRole(roles);
    const department =
      ssoUser.departmentFullName ||
      ssoUser.departmentName ||
      ssoUser.department ||
      ssoUser.Department ||
      ssoUser.FULLDEPTNAME ||
      ssoUser.DEPT_NAME ||
      null;
    const departmentGroup =
      ssoUser.departmentGroup ||
      ssoUser.DepartmentGroup ||
      ssoUser.DEPT_GROUP ||
      null;
    const position =
      (ssoUser as any).position ||
      (ssoUser as any).Position ||
      ssoUser.POS_NAME ||
      null;
    const phone =
      (ssoUser as any).phone ||
      (ssoUser as any).Mobile ||
      ssoUser.MOBILE ||
      null;

    // Tạm log để xác định AMS thực tế trả về tên trường nào — nếu department
    // vẫn rỗng sau khi đã thử mọi tên trường đã biết, in toàn bộ payload thô
    // ra log để soi tên trường thật, tránh đoán mò.
    if (!department) {
      this.logger.warn(
        `Không đọc được department từ SSO userinfo. Raw payload: ${JSON.stringify(ssoUser)}`,
      );
    }

    let user = ssoId
      ? await this.prisma.user.findFirst({ where: { ssoId } })
      : null;

    if (!user && email) {
      user = await this.prisma.user.findFirst({ where: { email } });
    }

    if (!user) {
      if (!email) throw new Error('no_email');

      const baseUsername =
        ssoUser.username ||
        ssoUser.UserName ||
        email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');

      user = await this.prisma.user.create({
        data: {
          username: await this.uniqueUsername(baseUsername),
          fullName,
          email,
          role,
          ssoId,
          department,
          departmentGroup,
          phone,
          position,
          passwordHash: await bcrypt.hash(
            crypto.randomBytes(32).toString('hex'),
            10,
          ),
          active: true,
        },
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (ssoId && !user.ssoId) updates.ssoId = ssoId;
      if (fullName !== user.fullName) updates.fullName = fullName;
      if (role !== user.role) updates.role = role;
      if (department && department !== user.department)
        updates.department = department;
      if (departmentGroup && departmentGroup !== (user as any).departmentGroup)
        updates.departmentGroup = departmentGroup;
      if (position && position !== (user as any).position)
        updates.position = position;
      if (phone && phone !== (user as any).phone) updates.phone = phone;
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    if (!user.active) throw new Error('account_inactive');
    return user;
  }

  async syncAllUsersFromAms(): Promise<{
    total: number;
    created: number;
    updated: number;
  }> {
    // Get a service token via client_credentials
    const tokenResp = await fetch(process.env.SSO_TOKEN_URL || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SSO_CLIENT_ID || '',
        client_secret: process.env.SSO_CLIENT_SECRET || '',
      }).toString(),
    });

    if (!tokenResp.ok) {
      const body = await tokenResp.text().catch(() => '');
      throw new Error(
        `AMS client_credentials failed: ${tokenResp.status} ${body}`,
      );
    }

    const tokenData = (await tokenResp.json()) as SsoTokenResponse;
    const serviceToken = tokenData.access_token || tokenData.AccessToken || '';

    const usersResp = await fetch(process.env.SSO_USERS_URL || '', {
      headers: { Authorization: `Bearer ${serviceToken}` },
    });

    if (!usersResp.ok) {
      throw new Error(`AMS users list failed: ${usersResp.status}`);
    }

    const body = await usersResp.json();
    // Handle both array and { data: [...] } / { users: [...] } shapes
    const list: SsoUserInfo[] = Array.isArray(body)
      ? body
      : (body.data ?? body.users ?? body.items ?? []);

    let created = 0;
    let updated = 0;

    for (const raw of list) {
      const ssoId = raw.sub || raw.UserId || null;
      const email = (raw.email || raw.Email || '').toLowerCase() || null;
      if (!ssoId && !email) continue;

      const existing = ssoId
        ? await this.prisma.user.findFirst({ where: { ssoId } })
        : email
          ? await this.prisma.user.findFirst({ where: { email } })
          : null;

      if (existing) {
        updated++;
      } else {
        created++;
      }
      await this.syncUserFromSso(raw);
    }

    return { total: list.length, created, updated };
  }

  issueJwt(user: { id: number; username: string; role: UserRole }) {
    this.prisma.user
      .update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch(() => {
        /* fire-and-forget */
      });
    return this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }

  sanitize(user: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ssoId, ...rest } = user;
    return rest;
  }

  private mapRole(roles: string[]): UserRole {
    const joined = roles.join(' ').toUpperCase();
    if (joined.includes('ADMIN')) return UserRole.ADMIN;
    if (joined.includes('SUPERVISOR')) return UserRole.SUPERVISOR;
    if (joined.includes('MANAGER')) return UserRole.SUPERVISOR;
    if (joined.includes('MODULE_VIEWER')) return UserRole.VIEWER;
    return UserRole.TECHNICIAN; // DH_MODULE_USER và fallback
  }

  private async uniqueUsername(base: string): Promise<string> {
    let username = base;
    let counter = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${base}${counter++}`;
    }
    return username;
  }

  private cleanExpiredStates() {
    const now = Date.now();
    for (const [key, val] of this.stateMap) {
      if (now > val.expiresAt) this.stateMap.delete(key);
    }
  }
}
