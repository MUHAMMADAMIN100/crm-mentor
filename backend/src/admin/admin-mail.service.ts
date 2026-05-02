import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

/**
 * Daily email digest for admins about subscriptions that need attention.
 *
 * Configuration via env (all optional — without SMTP_* the service no-ops):
 *   SMTP_HOST     SMTP server hostname
 *   SMTP_PORT     SMTP server port (number; defaults to 587)
 *   SMTP_USER     SMTP username
 *   SMTP_PASS     SMTP password / app password
 *   SMTP_FROM     "From" email (defaults to SMTP_USER)
 *   ADMIN_DIGEST_EMAILS  comma-separated list of recipients
 *                        (defaults to all User.role=ADMIN with email set)
 */
@Injectable()
export class AdminMailService {
  private readonly log = new Logger('AdminMail');
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private buildTransport() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    return nodemailer.createTransport({
      host,
      port: +(process.env.SMTP_PORT || 587),
      secure: +(process.env.SMTP_PORT || 587) === 465,
      auth: { user, pass },
    });
  }

  private async getRecipients(): Promise<string[]> {
    const explicit = (process.env.ADMIN_DIGEST_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (explicit.length > 0) return explicit;
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', archived: false, email: { not: null } },
      select: { email: true },
    });
    return admins.map((a) => a.email!).filter(Boolean);
  }

  /** Runs every day at 08:00 server time. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyDigest() {
    const transport = this.buildTransport();
    if (!transport) {
      this.log.debug('Skipping admin digest — SMTP_* env not configured');
      return;
    }
    const recipients = await this.getRecipients();
    if (recipients.length === 0) {
      this.log.debug('Skipping admin digest — no recipients');
      return;
    }

    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 86400000);
    const in7d = new Date(now.getTime() + 7 * 86400000);

    const [expiringIn3d, expiringIn7d, expired] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in3d } },
        include: { teacher: { select: { fullName: true, login: true, email: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gt: in3d, lte: in7d } },
        include: { teacher: { select: { fullName: true, login: true, email: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.subscription.findMany({
        where: { OR: [{ status: 'EXPIRED' }, { AND: [{ status: 'ACTIVE' }, { endDate: { lt: now } }] }] },
        include: { teacher: { select: { fullName: true, login: true, email: true } } },
        orderBy: { endDate: 'asc' },
        take: 30,
      }),
    ]);

    if (expiringIn3d.length === 0 && expiringIn7d.length === 0 && expired.length === 0) {
      this.log.debug('Skipping admin digest — nothing to report');
      return;
    }

    const html = this.renderHtml({ expiringIn3d, expiringIn7d, expired });
    const subject = `Miz · ежедневный дайджест: ${expiringIn3d.length + expiringIn7d.length + expired.length} подписок требуют внимания`;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    try {
      await transport.sendMail({ from, to: recipients.join(','), subject, html });
      this.audit.log('system', 'system.dailyDigest', { meta: { recipients: recipients.length, expiringIn3d: expiringIn3d.length, expiringIn7d: expiringIn7d.length, expired: expired.length } });
      this.log.log(`Sent admin digest to ${recipients.length} recipient(s)`);
    } catch (e: any) {
      this.log.error(`Failed to send admin digest: ${e?.message || e}`);
    }
  }

  private renderHtml(data: { expiringIn3d: any[]; expiringIn7d: any[]; expired: any[] }) {
    function renderList(title: string, list: any[], color: string) {
      if (list.length === 0) return '';
      const rows = list.map((s) => {
        const t = s.teacher;
        const end = s.endDate ? new Date(s.endDate).toLocaleDateString() : '—';
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${escape(t?.fullName || '—')}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#888">${escape(t?.login || '')}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${end}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${(s.amount || 0).toLocaleString()} ₽</td></tr>`;
      }).join('');
      return `<h3 style="color:${color};margin:20px 0 8px">${title} (${list.length})</h3><table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:#666;font-size:12px"><th style="padding:6px 12px">Учитель</th><th style="padding:6px 12px">Логин</th><th style="padding:6px 12px">Конец</th><th style="padding:6px 12px">Сумма</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1f1d2b;max-width:680px;margin:0 auto;padding:24px">
        <h2 style="color:#7c3aed;margin:0 0 16px">Miz — ежедневный дайджест админа</h2>
        <p style="color:#666;font-size:13px;margin:0 0 20px">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${renderList('🔴 Подписки заканчиваются за 3 дня', data.expiringIn3d, '#b45309')}
        ${renderList('🟡 Подписки заканчиваются за 7 дней', data.expiringIn7d, '#d97706')}
        ${renderList('⚫ Просроченные подписки', data.expired, '#ef4444')}
        <p style="color:#999;font-size:11px;margin-top:24px">Это автоматическое сообщение Miz CRM. Откройте админ-панель, чтобы продлить подписки.</p>
      </div>
    `;
  }
}

function escape(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
