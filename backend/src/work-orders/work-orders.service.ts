import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  InstallStatus,
  UserRole,
  WrittenTicketStatus,
  MaterialStatus,
  PhotoStatus,
  PeriodStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { computeSlaStatus } from '../common/utils/sla.util';
import * as XLSX from 'xlsx';

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsEnum(WrittenTicketStatus)
  writtenTicket?: WrittenTicketStatus;
  @IsOptional() @IsEnum(MaterialStatus) actReceivedMaterial?: MaterialStatus;
  @IsOptional() @IsEnum(MaterialStatus) ttkvReceivedMaterial?: MaterialStatus;
  @IsOptional() @IsEnum(MaterialStatus) siteReceivedMaterial?: MaterialStatus;
  @IsOptional() @IsString() planDate?: string;
  @IsOptional() @IsString() executorName?: string;
  @IsOptional() @IsEnum(InstallStatus) installationStatus?: InstallStatus;
  @IsOptional() @IsEnum(PhotoStatus) photoStatus?: PhotoStatus;
  @IsOptional() @IsEnum(InstallStatus) integrationStatus?: InstallStatus;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() issue?: string;
  @IsOptional() @IsString() completedDate?: string;
}

export class WorkOrderQueryDto {
  @IsOptional() @IsString() periodId?: string;
  @IsOptional() @IsString() periodStatus?: string;
  @IsOptional() @IsString() solutionId?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() installationStatus?: string;
  @IsOptional() @IsString() slaStatus?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private googleSheets: GoogleSheetsService,
  ) {}

  async findAll(query: WorkOrderQueryDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '100');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.periodId) where.periodId = parseInt(query.periodId);
    if (query.periodStatus) where.period = { status: query.periodStatus };
    if (query.solutionId) where.solutionId = parseInt(query.solutionId);
    if (query.siteId) where.siteId = parseInt(query.siteId);
    if (query.installationStatus)
      where.installationStatus = query.installationStatus;
    if (query.province) where.site = { province: query.province };
    if (query.label) where.label = query.label;
    if (query.search) {
      where.OR = [
        { ticketNo: { contains: query.search, mode: 'insensitive' } },
        { site: { siteCode: { contains: query.search, mode: 'insensitive' } } },
        { site: { siteName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          site: {
            select: {
              siteCode: true,
              siteName: true,
              province: true,
              district: true,
              address: true,
              ttkvCode: true,
              managerName: true,
              phone: true,
            },
          },
          solution: {
            select: {
              solutionCode: true,
              solutionName: true,
              expectedDays: true,
            },
          },
          period: { select: { periodCode: true, periodName: true, status: true } },
          createdBy: { select: { fullName: true } },
          officeUpdatedBy: { select: { fullName: true } },
          techUpdatedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    const data = items.map((wo) => ({
      ...wo,
      slaStatus: computeSlaStatus(wo),
    }));

    if (query.slaStatus) {
      const filtered = data.filter((wo) => wo.slaStatus === query.slaStatus);
      return { data: filtered, total: filtered.length, page, limit };
    }

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        site: true,
        solution: true,
        period: true,
        createdBy: { select: { fullName: true } },
      },
    });
    if (!wo) throw new NotFoundException('Không tìm thấy Work Order');
    return { ...wo, slaStatus: computeSlaStatus(wo) };
  }

  async retrySheetSync(id: number) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Không tìm thấy Work Order');
    return this.googleSheets.pushProgressToSheet(id);
  }

  /** Bỏ qua lỗi đồng bộ — dùng khi đã tự cập nhật tay lên Sheet, không cần gọi lại API. */
  async dismissSheetSyncError(id: number) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Không tìm thấy Work Order');
    return this.prisma.workOrder.update({
      where: { id },
      data: { sheetSyncError: null, sheetSyncedAt: new Date() },
    });
  }

  async update(id: number, dto: UpdateWorkOrderDto, user: any) {
    if (user.role === UserRole.VIEWER)
      throw new ForbiddenException('Tài khoản chỉ xem — không có quyền cập nhật');

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { period: { select: { status: true } } },
    });
    if (!wo) throw new NotFoundException('Không tìm thấy Work Order');
    if (wo.period.status === PeriodStatus.CLOSED)
      throw new ForbiddenException('Kỳ đã đóng — không thể cập nhật phiếu thi công');

    const supervisorOnlyFields = [
      'writtenTicket',
      'actReceivedMaterial',
      'ttkvReceivedMaterial',
      'siteReceivedMaterial',
    ];
    const technicianFields = [
      'planDate',
      'executorName',
      'installationStatus',
      'photoStatus',
      'integrationStatus',
      'completedDate',
      'note',
      'issue',
    ];

    const presentKeys = Object.keys(dto).filter(
      (k) => (dto as any)[k] !== undefined,
    );

    if (user.role === UserRole.TECHNICIAN) {
      const forbiddenKeys = presentKeys.filter((k) =>
        supervisorOnlyFields.includes(k),
      );
      if (forbiddenKeys.length > 0)
        throw new ForbiddenException('Không có quyền cập nhật trường này');
    }

    if (user.role === UserRole.SUPERVISOR) {
      const forbiddenKeys = presentKeys.filter(
        (k) =>
          !supervisorOnlyFields.includes(k) && !technicianFields.includes(k),
      );
      if (forbiddenKeys.length > 0)
        throw new ForbiddenException('Không có quyền cập nhật trường này');
    }

    const updatingTechFields = presentKeys.some((k) => technicianFields.includes(k));
    const siteReceivedMaterial = dto.siteReceivedMaterial ?? wo.siteReceivedMaterial;
    if (updatingTechFields && siteReceivedMaterial !== 'TRANSFERRED')
      throw new ForbiddenException('Chưa chuyển vật tư lên trạm — không thể cập nhật thi công');

    const data: any = { ...dto };
    if (dto.planDate) data.planDate = new Date(dto.planDate);
    if (dto.completedDate) data.completedDate = new Date(dto.completedDate);
    if (
      dto.installationStatus === InstallStatus.COMPLETED &&
      !wo.completedDate
    ) {
      data.completedDate = new Date();
    }

    const officeFields = new Set([
      'writtenTicket',
      'actReceivedMaterial',
      'ttkvReceivedMaterial',
      'siteReceivedMaterial',
    ]);
    const techFields = new Set([
      'planDate',
      'executorName',
      'installationStatus',
      'photoStatus',
      'integrationStatus',
      'completedDate',
      'note',
      'issue',
    ]);
    if (presentKeys.some((k) => officeFields.has(k))) {
      data.officeUpdatedById = user.id;
      data.officeUpdatedAt = new Date();
    }
    if (presentKeys.some((k) => techFields.has(k))) {
      data.techUpdatedById = user.id;
      data.techUpdatedAt = new Date();
    }

    if (
      dto.writtenTicket === WrittenTicketStatus.WRITTEN &&
      !wo.writtenTicketAt
    ) {
      data.writtenTicketAt = new Date();
    }
    if (
      dto.actReceivedMaterial &&
      dto.actReceivedMaterial !== MaterialStatus.EMPTY &&
      !wo.actReceivedAt
    ) {
      data.actReceivedAt = new Date();
    }
    if (
      dto.ttkvReceivedMaterial &&
      dto.ttkvReceivedMaterial !== MaterialStatus.EMPTY &&
      !wo.ttkvReceivedAt
    ) {
      data.ttkvReceivedAt = new Date();
    }
    if (
      dto.siteReceivedMaterial &&
      dto.siteReceivedMaterial !== MaterialStatus.EMPTY &&
      !wo.siteReceivedAt
    ) {
      data.siteReceivedAt = new Date();
    }

    // Build diff: only log fields that actually changed
    const changes: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(data)) {
      const oldVal = (wo as any)[key];
      const newVal =
        data[key] instanceof Date ? data[key].toISOString() : data[key];
      const oldStr = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
      if (String(oldStr ?? '') !== String(newVal ?? '')) {
        changes[key] = { from: oldStr ?? null, to: newVal ?? null };
      }
    }

    const woWithSite = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        site: { select: { siteCode: true, siteName: true, ttkvCode: true } },
        solution: { select: { solutionName: true } },
      },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id }, data }),
      ...(Object.keys(changes).length > 0
        ? [
            this.prisma.workOrderLog.create({
              data: { workOrderId: id, userId: user.id, changes },
            }),
          ]
        : []),
    ]);

    if (Object.keys(changes).length > 0) {
      this.notifications
        .createFromWoUpdate(
          id,
          wo.ticketNo,
          woWithSite?.site?.siteCode ?? '',
          woWithSite?.site?.siteName ?? '',
          woWithSite?.solution?.solutionName ?? '',
          user.id,
          user.fullName ?? user.username,
          user.role,
          changes,
        )
        .catch(() => {
          /* fire-and-forget */
        });
    }

    const progressFields = [
      'planDate', 'executorName', 'installationStatus',
      'photoStatus', 'integrationStatus', 'note', 'issue',
    ];
    if (presentKeys.some((k) => progressFields.includes(k))) {
      this.googleSheets.pushProgressToSheet(id).catch(() => {
        /* fire-and-forget — lỗi đã được log trong service */
      });
    }

    return updated;
  }

  async findLogs(workOrderId: number) {
    return this.prisma.workOrderLog.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, username: true, role: true } },
      },
    });
  }

  async findMyLogs(userId: number, query: { search?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));

    const where: any = { userId };
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.workOrder = {
        site: {
          OR: [
            { siteCode: { contains: term, mode: 'insensitive' } },
            { siteName: { contains: term, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrderLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          workOrder: {
            select: {
              id: true,
              ticketNo: true,
              site: { select: { siteCode: true, siteName: true } },
              solution: { select: { solutionName: true } },
              period: { select: { periodName: true } },
            },
          },
        },
      }),
      this.prisma.workOrderLog.count({ where }),
    ]);

    return { items, total, page, limit, hasMore: page * limit < total };
  }

  async exportExcel(query: WorkOrderQueryDto): Promise<Buffer> {
    const { data } = await this.findAll({
      ...query,
      page: '1',
      limit: '10000',
    });

    const WRITTEN_LABEL: Record<string, string> = {
      EMPTY: 'Chưa viết',
      WRITTEN: 'Đã viết',
    };
    const MATERIAL_LABEL: Record<string, string> = {
      EMPTY: 'Chưa nhận',
      RECEIVED: 'Đã nhận',
      TRANSFERRED: 'Đã chuyển',
    };
    const INSTALL_LABEL: Record<string, string> = {
      NOT_STARTED: 'Chưa thực hiện',
      IN_PROGRESS: 'Đang thực hiện',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Hủy',
    };
    const PHOTO_LABEL: Record<string, string> = {
      NOT_TAKEN: 'Chưa chụp',
      TAKEN: 'Đã chụp',
    };

    const rows = data.map((wo) => ({
      'Ticket No': wo.ticketNo,
      'Kỳ thực hiện': wo.period?.periodName || '',
      'Mã trạm': wo.site?.siteCode || '',
      'Tên trạm': wo.site?.siteName || '',
      'Tỉnh/Thành': wo.site?.province || '',
      'Quận/Huyện': wo.site?.district || '',
      'Giải pháp': wo.solution?.solutionName || '',
      'Viết phiếu': WRITTEN_LABEL[wo.writtenTicket] ?? wo.writtenTicket,
      'ACT nhận VT': MATERIAL_LABEL[wo.actReceivedMaterial] ?? wo.actReceivedMaterial,
      'TTKV nhận VT': MATERIAL_LABEL[wo.ttkvReceivedMaterial] ?? wo.ttkvReceivedMaterial,
      'VT lên trạm': MATERIAL_LABEL[wo.siteReceivedMaterial] ?? wo.siteReceivedMaterial,
      'Kế hoạch TH': wo.planDate
        ? new Date(wo.planDate).toLocaleDateString('vi-VN')
        : '',
      'Nhân sự TH': wo.executorName || '',
      'Hoàn thành lắp đặt': INSTALL_LABEL[wo.installationStatus] ?? wo.installationStatus,
      'Chụp hình': PHOTO_LABEL[wo.photoStatus] ?? wo.photoStatus,
      'Tích hợp': INSTALL_LABEL[wo.integrationStatus] ?? wo.integrationStatus,
      'Ghi chú': wo.note || '',
      'Vướng mắc': wo.issue || '',
      'Người tạo': wo.createdBy?.fullName || '',
      'Người cập nhật vật tư': wo.officeUpdatedBy?.fullName || '',
      'Người cập nhật thi công': wo.techUpdatedBy?.fullName || '',
      'Trạng thái SLA': (wo as any).slaStatus,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async remove(id: number) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Không tìm thấy Work Order');
    await this.prisma.workOrder.delete({ where: { id } });
    return { message: 'Đã xóa Work Order' };
  }

  async removeMany(ids: number[]): Promise<{ deleted: number }> {
    if (!ids?.length) throw new BadRequestException('Danh sách ID không được để trống');
    const { count } = await this.prisma.workOrder.deleteMany({ where: { id: { in: ids } } });
    return { deleted: count };
  }

  async removeByLabel(label: string): Promise<{ deleted: number }> {
    if (!label?.trim()) throw new BadRequestException('Label không được để trống');
    const { count } = await this.prisma.workOrder.deleteMany({ where: { label } });
    return { deleted: count };
  }

  async listLabels(): Promise<string[]> {
    const rows = await this.prisma.workOrder.findMany({
      where: { label: { not: null } },
      select: { label: true },
      distinct: ['label'],
      orderBy: { label: 'asc' },
    });
    return rows.map((r) => r.label!);
  }

  async importMaterials(file: Express.Multer.File, actor: any) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Collect all ticketNos then batch-fetch in one query
    const ticketNos = rows
      .map((r) =>
        String(r['ticketNo'] || r['Ticket No'] || r['TICKET_NO'] || '').trim(),
      )
      .filter(Boolean);

    const existing = await this.prisma.workOrder.findMany({
      where: { ticketNo: { in: ticketNos } },
      select: {
        id: true,
        ticketNo: true,
        writtenTicketAt: true,
        actReceivedAt: true,
        ttkvReceivedAt: true,
        siteReceivedAt: true,
        period: { select: { status: true } },
      },
    });
    const woMap = new Map(existing.map((wo) => [wo.ticketNo, wo.id]));
    const woStageMap = new Map(existing.map((wo) => [wo.id, wo]));

    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const ticketNo = String(
        row['ticketNo'] || row['Ticket No'] || row['TICKET_NO'] || '',
      ).trim();
      if (!ticketNo) continue;

      const woId = woMap.get(ticketNo);
      if (!woId) {
        errors.push(`Không tìm thấy: ${ticketNo}`);
        continue;
      }
      const stage = woStageMap.get(woId);
      if (stage?.period.status === PeriodStatus.CLOSED) {
        errors.push(`${ticketNo}: kỳ đã đóng — bỏ qua`);
        continue;
      }

      const data: any = {};
      const writtenTicket = String(
        row['writtenTicket'] || row['Phiếu vật tư'] || '',
      ).trim();
      if (writtenTicket === 'WRITTEN' || writtenTicket === 'Đã lập')
        data.writtenTicket = 'WRITTEN';

      const actReceived = String(
        row['actReceivedMaterial'] || row['ACT nhận VT'] || '',
      ).trim();
      if (actReceived === 'RECEIVED' || actReceived === 'Đã nhận')
        data.actReceivedMaterial = 'RECEIVED';
      if (actReceived === 'TRANSFERRED' || actReceived === 'Đã chuyển')
        data.actReceivedMaterial = 'TRANSFERRED';

      const ttkvReceived = String(
        row['ttkvReceivedMaterial'] || row['TTKV nhận VT'] || '',
      ).trim();
      if (ttkvReceived === 'RECEIVED' || ttkvReceived === 'Đã nhận')
        data.ttkvReceivedMaterial = 'RECEIVED';
      if (ttkvReceived === 'TRANSFERRED' || ttkvReceived === 'Đã chuyển')
        data.ttkvReceivedMaterial = 'TRANSFERRED';

      const note = String(row['note'] || row['Ghi chú'] || '').trim();
      if (note) data.note = note;

      if (Object.keys(data).length === 0) continue;

      if (data.writtenTicket === 'WRITTEN' && stage && !stage.writtenTicketAt) {
        data.writtenTicketAt = new Date();
      }
      if (data.actReceivedMaterial && stage && !stage.actReceivedAt) {
        data.actReceivedAt = new Date();
      }
      if (data.ttkvReceivedMaterial && stage && !stage.ttkvReceivedAt) {
        data.ttkvReceivedAt = new Date();
      }

      await this.prisma.workOrder.update({ where: { id: woId }, data });
      updated++;
    }

    return { updated, errors, total: rows.length };
  }
}
