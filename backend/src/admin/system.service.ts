import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}
