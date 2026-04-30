import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  /**
   * Lightweight uptime endpoint — doesn't touch the DB or guards.
   * Used by Vercel cron / UptimeRobot to keep Railway warm and avoid
   * cold-start latency on the first user request.
   */
  @Get('health')
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
