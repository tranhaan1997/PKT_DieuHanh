import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleSheetsService } from './google-sheets.service';

const ENABLED_KEY = 'autoStatusSyncEnabled';
const INTERVAL_KEY = 'autoStatusSyncIntervalMinutes';
const DEFAULT_INTERVAL_MINUTES = 15;

@Injectable()
export class AutoStatusSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoStatusSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private googleSheets: GoogleSheetsService,
  ) {}

  async onModuleInit() {
    await this.reschedule();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  async getConfig() {
    const [enabledRow, intervalRow] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: ENABLED_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: INTERVAL_KEY } }),
    ]);
    return {
      enabled: enabledRow?.value === 'true',
      intervalMinutes: intervalRow ? parseInt(intervalRow.value, 10) : DEFAULT_INTERVAL_MINUTES,
    };
  }

  async setConfig(enabled: boolean, intervalMinutes: number) {
    await this.prisma.$transaction([
      this.prisma.systemConfig.upsert({
        where: { key: ENABLED_KEY },
        create: { key: ENABLED_KEY, value: String(enabled) },
        update: { value: String(enabled) },
      }),
      this.prisma.systemConfig.upsert({
        where: { key: INTERVAL_KEY },
        create: { key: INTERVAL_KEY, value: String(intervalMinutes) },
        update: { value: String(intervalMinutes) },
      }),
    ]);
    await this.reschedule();
  }

  async getRecentRuns(limit = 20) {
    return this.prisma.autoSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /** Đọc lại config và lên lịch (hoặc dừng) lượt chạy kế tiếp. */
  private async reschedule() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const { enabled, intervalMinutes } = await this.getConfig();
    if (!enabled) return;

    this.timer = setTimeout(async () => {
      await this.runOnce();
      await this.reschedule();
    }, intervalMinutes * 60 * 1000);
  }

  /** Chạy 1 lượt đồng bộ trạng thái viết phiếu cho mọi kỳ ACTIVE đã cấu hình Sheet đầy đủ. */
  async runOnce() {
    if (this.isRunning) {
      this.logger.warn('Bỏ qua lượt chạy — lượt trước chưa hoàn tất');
      return null;
    }
    this.isRunning = true;
    const startedAt = new Date();
    const errors: string[] = [];
    const updatedItems: Array<{
      periodCode: string;
      solutionCode: string;
      ticketNo: string;
      siteCode: string;
      siteName: string;
      changes: Record<string, { from: string; to: string }>;
    }> = [];
    let totalUpdated = 0;
    let periodsProcessed = 0;

    try {
      const eligible = await this.prisma.periodSolution.findMany({
        where: {
          period: { status: PeriodStatus.ACTIVE, googleSheetId: { not: null } },
          sheetTab: { not: null },
          sheetSiteCol: { not: null },
          // Đủ cả 4 trạng thái: Viết phiếu, ACT nhận VT, TTKV nhận VT, VT lên trạm
          sheetWrittenCol: { not: null },
          sheetActCol: { not: null },
          sheetTtkvCol: { not: null },
          sheetSiteRecvCol: { not: null },
        },
        select: {
          periodId: true,
          solutionId: true,
          period: { select: { periodCode: true } },
          solution: { select: { solutionCode: true } },
        },
      });

      for (const ps of eligible) {
        periodsProcessed++;
        try {
          const result = await this.googleSheets.syncStatuses(
            ps.period.periodCode,
            ps.solutionId,
            null,
          );
          totalUpdated += result.updated;
          if (result.errors.length) {
            errors.push(`${ps.period.periodCode}/${ps.solution.solutionCode}: ${result.errors.join('; ')}`);
          }
          for (const item of result.updatedItems) {
            updatedItems.push({
              periodCode: ps.period.periodCode,
              solutionCode: ps.solution.solutionCode,
              ...item,
            });
          }
        } catch (err: any) {
          errors.push(`${ps.period.periodCode}/${ps.solution.solutionCode}: ${err?.message || 'Lỗi không xác định'}`);
        }
      }
    } catch (err: any) {
      errors.push(`Lỗi tổng quát: ${err?.message || 'Lỗi không xác định'}`);
    }

    const status = errors.length === 0 ? 'SUCCESS' : totalUpdated > 0 ? 'PARTIAL' : 'FAILED';
    const run = await this.prisma.autoSyncRun.create({
      data: {
        startedAt,
        finishedAt: new Date(),
        status,
        periodsProcessed,
        totalUpdated,
        errors: errors.length ? errors : undefined,
        updatedItems: updatedItems.length ? updatedItems : undefined,
      },
    });

    this.isRunning = false;
    return run;
  }
}
