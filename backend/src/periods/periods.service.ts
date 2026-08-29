import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export class CreatePeriodDto {
  @IsString() periodCode: string;
  @IsString() periodName: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsOptional() supervisorIds?: number[];
}

export class UpdatePeriodDto {
  @IsOptional() @IsString() periodName?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsEnum(PeriodStatus) status?: PeriodStatus;
  @IsOptional() @IsString() googleSheetId?: string;
  @IsOptional() @IsString() googleSheetTab?: string;
  @IsOptional() googleSheetStartRow?: number;
  @IsOptional() @IsString() googleSheetSiteCol?: string;
}

@Injectable()
export class PeriodsService {
  constructor(private prisma: PrismaService) {}

  private supervisorSelect = {
    periodUsers: {
      include: { user: { select: { id: true, fullName: true, role: true } } },
    },
  };

  async findAll() {
    return this.prisma.period.findMany({
      include: {
        _count: {
          select: {
            workOrders: true,
            periodSolutions: true,
            periodSites: true,
          },
        },
        createdBy: { select: { fullName: true } },
        ...this.supervisorSelect,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const period = await this.prisma.period.findUnique({
      where: { id },
      include: {
        periodSolutions: {
          include: { solution: true },
          orderBy: { order: 'asc' },
        },
        periodSites: { include: { site: true } },
        createdBy: { select: { fullName: true } },
        _count: {
          select: {
            workOrders: true,
            periodSolutions: true,
            periodSites: true,
          },
        },
        ...this.supervisorSelect,
      },
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ thực hiện');

    const distinctSites = await this.prisma.workOrder.findMany({
      where: { periodId: id },
      distinct: ['siteId'],
      select: { siteId: true },
    });
    return { ...period, siteCount: distinctSites.length };
  }

  async create(dto: CreatePeriodDto, createdById: number) {
    return this.prisma.period.create({
      data: {
        periodCode: dto.periodCode,
        periodName: dto.periodName,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        createdById,
        ...(dto.supervisorIds?.length && {
          periodUsers: {
            createMany: {
              data: dto.supervisorIds.map((userId) => ({ userId })),
            },
          },
        }),
      },
      include: { ...this.supervisorSelect },
    });
  }

  async update(id: number, dto: UpdatePeriodDto) {
    await this.findOneBasic(id);
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.googleSheetSiteCol !== undefined)
      data.googleSheetSiteCol = dto.googleSheetSiteCol?.trim().toUpperCase() || null;
    if (dto.googleSheetStartRow !== undefined)
      data.googleSheetStartRow = dto.googleSheetStartRow || null;
    return this.prisma.period.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOneBasic(id);
    await this.prisma.period.delete({ where: { id } });
    return { message: 'Đã xóa kỳ thực hiện' };
  }

  async assignSupervisors(id: number, userIds: number[]) {
    await this.assertNotClosed(id);
    await this.prisma.periodUser.deleteMany({ where: { periodId: id } });
    if (userIds.length) {
      await this.prisma.periodUser.createMany({
        data: userIds.map((userId) => ({ periodId: id, userId })),
      });
    }
    return this.findOne(id);
  }

  async assignSolutions(id: number, solutionIds: number[]) {
    await this.assertNotClosed(id);
    const existing = await this.prisma.periodSolution.findMany({
      where: { periodId: id },
    });
    const configMap = new Map(existing.map((e) => [e.solutionId, e]));
    await this.prisma.periodSolution.deleteMany({ where: { periodId: id } });
    await this.prisma.periodSolution.createMany({
      data: solutionIds.map((solutionId, index) => {
        const prev = configMap.get(solutionId);
        return {
          periodId: id,
          solutionId,
          order: index,
          sheetTab: prev?.sheetTab ?? null,
          sheetStartRow: prev?.sheetStartRow ?? null,
          sheetSiteCol: prev?.sheetSiteCol ?? null,
          sheetWrittenCol: prev?.sheetWrittenCol ?? null,
          sheetActCol: prev?.sheetActCol ?? null,
          sheetTtkvCol: prev?.sheetTtkvCol ?? null,
          sheetSiteRecvCol: prev?.sheetSiteRecvCol ?? null,
          sheetProgressStartCol: prev?.sheetProgressStartCol ?? null,
          sheetPlanDateCol: prev?.sheetPlanDateCol ?? null,
          sheetExecutorCol: prev?.sheetExecutorCol ?? null,
          sheetInstallCol: prev?.sheetInstallCol ?? null,
          sheetPhotoCol: prev?.sheetPhotoCol ?? null,
          sheetIntegrationCol: prev?.sheetIntegrationCol ?? null,
          sheetNoteCol: prev?.sheetNoteCol ?? null,
          sheetIssueCol: prev?.sheetIssueCol ?? null,
          sheetCompletedDateCol: prev?.sheetCompletedDateCol ?? null,
          genCol: prev?.genCol ?? null,
        };
      }),
    });
    return this.findOne(id);
  }

  async updateSolutionSheetConfig(
    id: number,
    solutionId: number,
    dto: {
      sheetTab?: string | null;
      sheetStartRow?: number | null;
      sheetSiteCol?: string | null;
      sheetWrittenCol?: string | null;
      sheetActCol?: string | null;
      sheetTtkvCol?: string | null;
      sheetSiteRecvCol?: string | null;
      sheetPlanDateCol?: string | null;
      sheetExecutorCol?: string | null;
      sheetInstallCol?: string | null;
      sheetPhotoCol?: string | null;
      sheetIntegrationCol?: string | null;
      sheetNoteCol?: string | null;
      sheetIssueCol?: string | null;
      sheetCompletedDateCol?: string | null;
    },
  ) {
    await this.assertNotClosed(id);
    const norm = (v?: string | null) => (v?.trim() ? v.trim().toUpperCase() : null);
    await this.prisma.periodSolution.update({
      where: { periodId_solutionId: { periodId: id, solutionId } },
      data: {
        sheetTab: dto.sheetTab?.trim() || null,
        sheetStartRow: dto.sheetStartRow ?? null,
        sheetSiteCol: norm(dto.sheetSiteCol),
        sheetWrittenCol: norm(dto.sheetWrittenCol),
        sheetActCol: norm(dto.sheetActCol),
        sheetTtkvCol: norm(dto.sheetTtkvCol),
        sheetSiteRecvCol: norm(dto.sheetSiteRecvCol),
        sheetPlanDateCol: norm(dto.sheetPlanDateCol),
        sheetExecutorCol: norm(dto.sheetExecutorCol),
        sheetInstallCol: norm(dto.sheetInstallCol),
        sheetPhotoCol: norm(dto.sheetPhotoCol),
        sheetIntegrationCol: norm(dto.sheetIntegrationCol),
        sheetNoteCol: norm(dto.sheetNoteCol),
        sheetIssueCol: norm(dto.sheetIssueCol),
        sheetCompletedDateCol: norm(dto.sheetCompletedDateCol),
      },
    });
    return this.findOne(id);
  }

  async updateSolutionGenCol(id: number, solutionId: number, genCol: string | null) {
    await this.assertNotClosed(id);
    await this.prisma.periodSolution.update({
      where: { periodId_solutionId: { periodId: id, solutionId } },
      data: { genCol: genCol?.trim() ? genCol.trim().toUpperCase() : null },
    });
    return this.findOne(id);
  }

  async assignSites(id: number, siteIds: number[]) {
    await this.assertNotClosed(id);
    await this.prisma.periodSite.deleteMany({ where: { periodId: id } });
    await this.prisma.periodSite.createMany({
      data: siteIds.map((siteId) => ({ periodId: id, siteId })),
    });
    return this.findOne(id);
  }

  async generateWorkOrders(id: number, createdById: number) {
    const period = await this.findOne(id);

    if (period.status === PeriodStatus.CLOSED)
      throw new BadRequestException('Kỳ đã đóng — không thể sinh phiếu thi công');
    if (!period.periodSolutions.length)
      throw new BadRequestException('Kỳ chưa có giải pháp');
    if (!period.periodSites.length)
      throw new BadRequestException('Kỳ chưa có trạm');

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = `GEN_${period.periodCode}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    const existingWOs = await this.prisma.workOrder.findMany({
      where: { periodId: id },
      select: { siteId: true, solutionId: true },
    });
    const existingSet = new Set(
      existingWOs.map((w) => `${w.siteId}-${w.solutionId}`),
    );

    const toCreate: any[] = [];
    // Global sequence: count all existing WOs to get next number
    let seq = await this.prisma.workOrder.count();

    for (const ps of period.periodSites) {
      for (const sol of period.periodSolutions) {
        const key = `${ps.siteId}-${sol.solutionId}`;
        if (!existingSet.has(key)) {
          seq++;
          toCreate.push({
            ticketNo: `WO-${String(seq).padStart(5, '0')}`,
            periodId: id,
            siteId: ps.siteId,
            solutionId: sol.solutionId,
            createdById,
            label,
          });
        }
      }
    }

    if (toCreate.length === 0)
      return { message: 'Tất cả Work Order đã được sinh trước đó', created: 0 };

    await this.prisma.workOrder.createMany({ data: toCreate });
    return {
      message: `Đã sinh ${toCreate.length} Work Order`,
      created: toCreate.length,
    };
  }

  private async findOneBasic(id: number) {
    const period = await this.prisma.period.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ thực hiện');
    return period;
  }

  /** Dùng trong các hàm sửa cấu hình kỳ (gán giải pháp/trạm, cấu hình Sheet) — chặn khi kỳ đã đóng. */
  private async assertNotClosed(id: number) {
    const period = await this.findOneBasic(id);
    if (period.status === PeriodStatus.CLOSED)
      throw new BadRequestException('Kỳ đã đóng — không thể thay đổi cấu hình');
    return period;
  }
}
