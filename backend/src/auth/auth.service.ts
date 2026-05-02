import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(login: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user || user.archived) throw new UnauthorizedException('Неверный логин или пароль');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');
    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      login: user.login,
    });
    // Track last successful login for the admin dashboard's activity insights.
    this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    return {
      token,
      user: this.sanitize(user),
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) throw new BadRequestException('Старый пароль неверен');
    if (newPassword.length < 6) throw new BadRequestException('Пароль слишком короткий');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash, mustChangePassword: false },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: { include: { tree: true } },
        teacherSubscription: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  async completeProfile(userId: string, data: any) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName ?? undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        telegram: data.telegram ?? undefined,
        whatsapp: data.whatsapp ?? undefined,
        instagram: data.instagram ?? undefined,
        website: data.website ?? undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        gender: data.gender ?? undefined,
        city: data.city ?? undefined,
        activity: data.activity ?? undefined,
        category: data.category ?? undefined,
        goal: data.goal ?? undefined,
        bio: data.bio ?? undefined,
        profileCompleted: true,
      },
    });
    return this.sanitize(user);
  }

  /** Updates only profile-editable fields (no role/login/password change). */
  async updateProfile(userId: string, data: any) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName ?? undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        telegram: data.telegram ?? undefined,
        whatsapp: data.whatsapp ?? undefined,
        instagram: data.instagram ?? undefined,
        website: data.website ?? undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : (data.birthDate === '' ? null : undefined),
        gender: data.gender || undefined,
        city: data.city ?? undefined,
        activity: data.activity ?? undefined,
        category: data.category ?? undefined,
        goal: data.goal ?? undefined,
        bio: data.bio ?? undefined,
      },
    });
    return this.sanitize(user);
  }

  sanitize(u: any) {
    const { password, ...rest } = u;
    return rest;
  }

  static async hashPassword(p: string) {
    return bcrypt.hash(p, 10);
  }
}
