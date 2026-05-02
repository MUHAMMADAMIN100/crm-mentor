import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from './audit.service';

const DEFAULT_SETTINGS: Record<string, string> = {
  'platform.name': 'Miz',
  'platform.logoUrl': '',
  'default.lang': 'ru',
  'default.timezone': 'Europe/Moscow',
  'default.currency': 'RUB',
  'default.dateFormat': 'DD.MM.YYYY',
  'feature.ai': 'true',
  'feature.marketplace': 'false',
  'feature.schools': 'false',
  'feature.managers': 'true',
  // Reference dictionaries (JSON arrays serialised as strings).
  'ref.subscriptionStatuses': JSON.stringify(['TRIAL', 'ACTIVE', 'EXPIRED', 'BLOCKED', 'PAUSED', 'CANCELED']),
  'ref.subscriptionTypes': JSON.stringify(['MONTH', 'YEAR']),
  'ref.teacherCategories': JSON.stringify(['math', 'english', 'physics', 'chemistry', 'music', 'programming', 'design', 'business']),
  'ref.studentTags': JSON.stringify(['vip', 'new', 'inactive', 'problem', 'champion']),
  'ref.paymentSources': JSON.stringify(['manual_admin', 'card', 'invoice', 'crypto', 'cash', 'transfer']),
  // Security settings
  'security.minPasswordLength': '6',
  'security.lockoutOnFailedAttempts': 'false',
  'security.maxFailedAttempts': '5',
  'security.requireTwoFactorForAdmin': 'false',
  'security.passwordRotationDays': '0',
  // Bumped on "force logout all" — JWTs issued before this timestamp are rejected.
  'security.jwtEpoch': '0',
};

const DEFAULT_TEMPLATES = [
  { code: 'welcome', title: 'Добро пожаловать в Miz!', body: 'Здравствуйте, {{name}}. Рады видеть вас на платформе.' },
  { code: 'trial_ending', title: 'Скоро заканчивается пробный период', body: 'Ваш пробный период заканчивается {{date}}. Продлите подписку, чтобы не потерять доступ.' },
  { code: 'subscription_expired', title: 'Подписка истекла', body: 'Подписка истекла {{date}}. Свяжитесь с менеджером для продления.' },
  { code: 'payment_reminder', title: 'Напоминание об оплате', body: 'Не забудьте оплатить подписку до {{date}}.' },
];

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async getAllSettings() {
    const rows = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = { ...DEFAULT_SETTINGS };
    rows.forEach((r) => { map[r.key] = r.value; });
    return map;
  }

  async setSetting(actorId: string, key: string, value: string) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.audit.log(actorId, 'system.setting', { meta: { key, value } });
    return { key, value };
  }

  async setSettings(actorId: string, settings: Record<string, string>) {
    const out: any = {};
    for (const [key, value] of Object.entries(settings)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      out[key] = value;
    }
    this.audit.log(actorId, 'system.settings', { meta: { keys: Object.keys(settings) } });
    return out;
  }

  async listTemplates() {
    const existing = await this.prisma.notificationTemplate.findMany({ orderBy: { code: 'asc' } });
    // Seed defaults if absent.
    for (const t of DEFAULT_TEMPLATES) {
      if (!existing.find((x) => x.code === t.code)) {
        await this.prisma.notificationTemplate.create({ data: { ...t, enabled: true } });
      }
    }
    return this.prisma.notificationTemplate.findMany({ orderBy: { code: 'asc' } });
  }

  async updateTemplate(actorId: string, id: string, data: { title?: string; body?: string; enabled?: boolean }) {
    const t = await this.prisma.notificationTemplate.update({
      where: { id },
      data: { title: data.title ?? undefined, body: data.body ?? undefined, enabled: data.enabled ?? undefined },
    });
    this.audit.log(actorId, 'system.template', { targetType: 'NotificationTemplate', targetId: id });
    return t;
  }

  // ============================================================
  // Security operations
  // ============================================================

  /**
   * Force-logout all non-admin users by bumping the JWT epoch. Existing
   * tokens issued before this timestamp will be rejected by the JWT guard.
   */
  async forceLogoutAll(actorId: string) {
    const epoch = String(Date.now());
    await this.prisma.systemSetting.upsert({
      where: { key: 'security.jwtEpoch' },
      update: { value: epoch },
      create: { key: 'security.jwtEpoch', value: epoch },
    });
    this.audit.log(actorId, 'security.forceLogoutAll', { meta: { epoch } });
    return { ok: true, epoch };
  }

  /**
   * Require all teachers to set a new password on next login. Sets
   * mustChangePassword=true on every TEACHER row.
   */
  async resetAllTeacherPasswords(actorId: string) {
    const r = await this.prisma.user.updateMany({ where: { role: 'TEACHER', archived: false }, data: { mustChangePassword: true } });
    this.audit.log(actorId, 'security.resetAllTeacherPasswords', { meta: { count: r.count } });
    return { ok: true, count: r.count };
  }

  /**
   * Set a fresh password for a specific user (used by support to help
   * a stuck user). Stores plainPassword for the actor's reference.
   */
  async setUserPassword(actorId: string, userId: string, password: string) {
    if (!password || password.length < 6) throw new BadRequestException('Минимум 6 символов');
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();
    const hash = await AuthService.hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash, plainPassword: password, mustChangePassword: false },
    });
    this.audit.log(actorId, 'security.setUserPassword', { targetType: 'User', targetId: userId });
    return { ok: true };
  }
}
