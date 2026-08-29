import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AutoStatusSyncService } from '../google-sheets/auto-status-sync.service';

@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettingsController {
  constructor(
    private prisma: PrismaService,
    private autoStatusSync: AutoStatusSyncService,
  ) {}

  @Get('google-sheets')
  async getGoogleSheets() {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'googleServiceAccountJson' },
    });
    return { hasServiceAccount: Boolean(row?.value) };
  }

  @Put('google-sheets')
  async putGoogleSheets(
    @Body() body: { googleServiceAccountJson?: string },
  ) {
    if (!body.googleServiceAccountJson?.trim()) {
      return { success: false, error: 'Service Account JSON không được để trống' };
    }
    try {
      JSON.parse(body.googleServiceAccountJson);
    } catch {
      return { success: false, error: 'Service Account JSON không hợp lệ' };
    }
    await this.prisma.systemConfig.upsert({
      where: { key: 'googleServiceAccountJson' },
      create: { key: 'googleServiceAccountJson', value: body.googleServiceAccountJson },
      update: { value: body.googleServiceAccountJson },
    });
    return { success: true };
  }

  @Get('sheet-write-back')
  async getSheetWriteBack() {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'sheetWriteBackEnabled' },
    });
    // Mặc định BẬT nếu chưa từng cấu hình
    return { enabled: row ? row.value === 'true' : true };
  }

  @Put('sheet-write-back')
  async putSheetWriteBack(@Body() body: { enabled: boolean }) {
    await this.prisma.systemConfig.upsert({
      where: { key: 'sheetWriteBackEnabled' },
      create: { key: 'sheetWriteBackEnabled', value: String(body.enabled) },
      update: { value: String(body.enabled) },
    });
    return { success: true, enabled: body.enabled };
  }

  @Get('auto-status-sync')
  async getAutoStatusSync() {
    return this.autoStatusSync.getConfig();
  }

  @Put('auto-status-sync')
  async putAutoStatusSync(@Body() body: { enabled: boolean; intervalMinutes: number }) {
    const allowedIntervals = [5, 15, 30, 60];
    const intervalMinutes = allowedIntervals.includes(body.intervalMinutes)
      ? body.intervalMinutes
      : 15;
    await this.autoStatusSync.setConfig(body.enabled, intervalMinutes);
    return { success: true, enabled: body.enabled, intervalMinutes };
  }

  @Get('auto-status-sync/runs')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getAutoStatusSyncRuns() {
    return this.autoStatusSync.getRecentRuns();
  }

  @Post('auto-status-sync/run-now')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async runAutoStatusSyncNow() {
    const run = await this.autoStatusSync.runOnce();
    if (!run)
      return { success: false, message: 'Lượt chạy trước chưa hoàn tất, vui lòng thử lại sau' };
    return { success: true, run };
  }
}
