import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.active)
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc bị khóa');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mật khẩu không đúng');
    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    await this.touchLastLogin(user.id);
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      payload as object,
      {
        secret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
        expiresIn: '7d',
      } as any,
    );
    return { accessToken, refreshToken, user: this.sanitizeUser(user) };
  }

  signRefreshToken(user: {
    id: number;
    username: string;
    role: string;
  }): string {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, role: user.role },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
        expiresIn: '7d',
      } as any,
    );
  }

  async refreshToken(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new UnauthorizedException();
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: this.sanitizeUser(user) };
  }

  async touchLastLogin(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
