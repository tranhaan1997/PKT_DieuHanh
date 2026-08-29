import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.dh_refresh_token,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
      passReqToCallback: false,
    });
  }

  validate(payload: any) {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}
