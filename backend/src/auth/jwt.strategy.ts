import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  login: string;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.get<string>('JWT_SECRET') || 'dev-secret',
    });
  }
  async validate(payload: JwtPayload) {
    // Reject tokens issued before the current security.jwtEpoch (used by
    // "force logout all"). Admins are exempt so they don't lock themselves out.
    if (payload.role !== 'ADMIN' && payload.iat) {
      try {
        const epochRow = await this.prisma.systemSetting.findUnique({ where: { key: 'security.jwtEpoch' } });
        const epoch = epochRow ? Math.floor(+epochRow.value / 1000) : 0;
        if (epoch && payload.iat < epoch) throw new UnauthorizedException('session expired');
      } catch (e) {
        // If the lookup fails (cold DB, etc.) don't block the user.
        if (e instanceof UnauthorizedException) throw e;
      }
    }
    return { id: payload.sub, role: payload.role, login: payload.login };
  }
}
