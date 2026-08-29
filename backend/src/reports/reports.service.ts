import { Injectable } from '@nestjs/common';
import { InstallStatus, MaterialStatus, WrittenTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

export interface ReportQueryDto {
  periodId?: string;
  solutionId?: string;
}

export interface TrendQueryDto {
  solutionId?: string;
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

export interface SummaryRow {
  solutionId: number;
  solutionName: string;
  total: number;
  written: number;
  actReceived: number;
  ttkvReceived: number;
  siteReceived: number;
  installInProgress: number;
  installCompleted: number;
  integrationCompleted: number;
  cancelled: number;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(query: ReportQueryDto) {
    const where: any = {};
    if (query.periodId) where.periodId = parseInt(query.periodId);
    if (query.solutionId) where.solutionId = parseInt(query.solutionId);
    return where;
  }

  // ── Báo cáo tổng hợp: theo Công ty + theo Trung tâm (TTKV) ────────
  async getSummary(query: ReportQueryDto) {
    const where = this.buildWhere(query);
    const workOrders = await this.prisma.workOrder.findMany({
      where,
      select: {
        writtenTicket: true,
        actReceivedMaterial: true,
        ttkvReceivedMaterial: true,
        siteReceivedMaterial: true,
        installationStatus: true,
        integrationStatus: true,
        solution: { select: { id: true, solutionName: true } },
        site: { select: { ttkvCode: true, ttkv: { select: { name: true } } } },
      },
    });

    type Wo = (typeof workOrders)[number];

    const buildRow = (solutionId: number, solutionName: string, wos: Wo[]): SummaryRow => ({
      solutionId,
      solutionName,
      total: wos.length,
      written: wos.filter((w) => w.writtenTicket === WrittenTicketStatus.WRITTEN).length,
      actReceived: wos.filter((w) => w.actReceivedMaterial !== MaterialStatus.EMPTY).length,
      ttkvReceived: wos.filter((w) => w.ttkvReceivedMaterial !== MaterialStatus.EMPTY).length,
      siteReceived: wos.filter((w) => w.siteReceivedMaterial !== MaterialStatus.EMPTY).length,
      installInProgress: wos.filter((w) => w.installationStatus === InstallStatus.IN_PROGRESS).length,
      installCompleted: wos.filter((w) => w.installationStatus === InstallStatus.COMPLETED).length,
      integrationCompleted: wos.filter((w) => w.integrationStatus === InstallStatus.COMPLETED).length,
      cancelled: wos.filter((w) => w.installationStatus === InstallStatus.CANCELLED).length,
    });

    const groupBySolution = (wos: Wo[]): SummaryRow[] => {
      const map = new Map<number, { solutionId: number; solutionName: string; items: Wo[] }>();
      for (const wo of wos) {
        const id = wo.solution.id;
        if (!map.has(id)) map.set(id, { solutionId: id, solutionName: wo.solution.solutionName, items: [] });
        map.get(id)!.items.push(wo);
      }
      return Array.from(map.values())
        .map((g) => buildRow(g.solutionId, g.solutionName, g.items))
        .sort((a, b) => a.solutionName.localeCompare(b.solutionName));
    };

    const company = groupBySolution(workOrders);

    const ttkvMap = new Map<string, { ttkvCode: string; ttkvName: string; items: Wo[] }>();
    for (const wo of workOrders) {
      const code = wo.site?.ttkvCode || '__NONE__';
      const name = wo.site?.ttkv?.name || 'Không rõ';
      if (!ttkvMap.has(code)) ttkvMap.set(code, { ttkvCode: code, ttkvName: name, items: [] });
      ttkvMap.get(code)!.items.push(wo);
    }
    const byTtkv = Array.from(ttkvMap.values())
      .map((t) => ({ ttkvCode: t.ttkvCode, ttkvName: t.ttkvName, rows: groupBySolution(t.items) }))
      .sort((a, b) => a.ttkvName.localeCompare(b.ttkvName));

    return { company, byTtkv };
  }

  // ── Báo cáo: Hiệu suất nhân sự ─────────────────────────────────
  async getStaffPerformance(query: ReportQueryDto) {
    const where = this.buildWhere(query);

    const [officeGroups, techGroups] = await Promise.all([
      this.prisma.workOrder.groupBy({
        by: ['officeUpdatedById'],
        where: { ...where, officeUpdatedById: { not: null } },
        _count: { id: true },
      }),
      this.prisma.workOrder.groupBy({
        by: ['techUpdatedById'],
        where: { ...where, techUpdatedById: { not: null } },
        _count: { id: true },
      }),
    ]);

    const userIds = Array.from(
      new Set([
        ...officeGroups.map((g) => g.officeUpdatedById!),
        ...techGroups.map((g) => g.techUpdatedById!),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Thời gian xử lý trung bình — dựa vào WorkOrderLog
    const woIds = await this.prisma.workOrder.findMany({ where, select: { id: true, createdAt: true } });
    const woCreatedAtMap = new Map(woIds.map((w) => [w.id, w.createdAt]));
    const logs = await this.prisma.workOrderLog.findMany({
      where: { workOrderId: { in: woIds.map((w) => w.id) } },
      orderBy: { createdAt: 'asc' },
      select: { workOrderId: true, userId: true, changes: true, createdAt: true },
    });

    const officeHours = new Map<number, number[]>();
    const techHours = new Map<number, number[]>();
    const firstOfficeLog = new Map<number, boolean>();
    const firstTechLog = new Map<number, boolean>();

    for (const log of logs) {
      const changeKeys = Object.keys(log.changes as Record<string, unknown>);
      const woCreatedAt = woCreatedAtMap.get(log.workOrderId);
      if (!woCreatedAt) continue;
      const hours = (log.createdAt.getTime() - woCreatedAt.getTime()) / (1000 * 60 * 60);

      if (changeKeys.some((k) => officeFields.has(k)) && !firstOfficeLog.get(log.workOrderId)) {
        firstOfficeLog.set(log.workOrderId, true);
        if (!officeHours.has(log.userId)) officeHours.set(log.userId, []);
        officeHours.get(log.userId)!.push(hours);
      }
      if (changeKeys.some((k) => techFields.has(k)) && !firstTechLog.get(log.workOrderId)) {
        firstTechLog.set(log.workOrderId, true);
        if (!techHours.has(log.userId)) techHours.set(log.userId, []);
        techHours.get(log.userId)!.push(hours);
      }
    }

    const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

    const office = officeGroups
      .filter((g) => g.officeUpdatedById)
      .map((g) => ({
        userId: g.officeUpdatedById!,
        fullName: userMap.get(g.officeUpdatedById!)?.fullName || `#${g.officeUpdatedById}`,
        woCount: g._count.id,
        avgHoursToUpdate: avg(officeHours.get(g.officeUpdatedById!) || []),
      }))
      .sort((a, b) => b.woCount - a.woCount);

    const tech = techGroups
      .filter((g) => g.techUpdatedById)
      .map((g) => ({
        userId: g.techUpdatedById!,
        fullName: userMap.get(g.techUpdatedById!)?.fullName || `#${g.techUpdatedById}`,
        woCount: g._count.id,
        avgHoursToUpdate: avg(techHours.get(g.techUpdatedById!) || []),
      }))
      .sort((a, b) => b.woCount - a.woCount);

    return { office, tech };
  }

  async exportStaffPerformance(query: ReportQueryDto): Promise<Buffer> {
    const { office, tech } = await this.getStaffPerformance(query);
    const toRows = (list: typeof office) =>
      list.map((r) => ({
        'Nhân sự': r.fullName,
        'Số phiếu đã cập nhật': r.woCount,
        'TB giờ xử lý lần đầu': r.avgHoursToUpdate ?? '',
      }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(office)), 'Điều hành');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(tech)), 'Kỹ thuật');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Báo cáo: Tồn đọng vật tư ───────────────────────────────────────
  private readonly stages: Array<{
    key: 'writtenTicket' | 'actReceivedMaterial' | 'ttkvReceivedMaterial' | 'siteReceivedMaterial';
    atKey: 'writtenTicketAt' | 'actReceivedAt' | 'ttkvReceivedAt' | 'siteReceivedAt';
    label: string;
  }> = [
    { key: 'writtenTicket', atKey: 'writtenTicketAt', label: 'Viết phiếu' },
    { key: 'actReceivedMaterial', atKey: 'actReceivedAt', label: 'ACT nhận VT' },
    { key: 'ttkvReceivedMaterial', atKey: 'ttkvReceivedAt', label: 'TTKV nhận VT' },
    { key: 'siteReceivedMaterial', atKey: 'siteReceivedAt', label: 'VT lên trạm' },
  ];

  async getMaterialBottleneck(query: ReportQueryDto) {
    const where = this.buildWhere(query);
    const workOrders = await this.prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        ticketNo: true,
        createdAt: true,
        writtenTicket: true,
        actReceivedMaterial: true,
        ttkvReceivedMaterial: true,
        siteReceivedMaterial: true,
        writtenTicketAt: true,
        actReceivedAt: true,
        ttkvReceivedAt: true,
        siteReceivedAt: true,
        site: { select: { siteCode: true, siteName: true } },
      },
    });

    const now = new Date();
    const stuckByStage = this.stages.map((s) => ({ stage: s.label, count: 0, items: [] as any[] }));
    const stageDays = this.stages.map(() => [] as number[]);

    for (const wo of workOrders) {
      let prevAt: Date | null = wo.createdAt;
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        const status = (wo as any)[stage.key];
        const at = (wo as any)[stage.atKey] as Date | null;
        const isDone =
          stage.key === 'writtenTicket'
            ? status === WrittenTicketStatus.WRITTEN
            : status !== MaterialStatus.EMPTY;

        if (!isDone) {
          const daysStuck = prevAt ? Math.round((now.getTime() - prevAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          stuckByStage[i].count++;
          stuckByStage[i].items.push({
            ticketNo: wo.ticketNo,
            siteCode: wo.site?.siteCode,
            siteName: wo.site?.siteName,
            daysStuck,
          });
          break;
        }
        if (at && prevAt) {
          stageDays[i].push((at.getTime() - prevAt.getTime()) / (1000 * 60 * 60 * 24));
        }
        prevAt = at;
      }
    }

    const avgDaysPerStage = this.stages.map((s, i) => ({
      stage: s.label,
      avgDays: stageDays[i].length
        ? Math.round((stageDays[i].reduce((a, b) => a + b, 0) / stageDays[i].length) * 10) / 10
        : null,
    }));

    return {
      stuckByStage: stuckByStage.map((s) => ({
        stage: s.stage,
        count: s.count,
        avgDaysStuck: s.items.length
          ? Math.round((s.items.reduce((a, it) => a + it.daysStuck, 0) / s.items.length) * 10) / 10
          : 0,
      })),
      stuckItems: stuckByStage.flatMap((s) => s.items.map((it) => ({ ...it, stage: s.stage }))),
      avgDaysPerStage,
    };
  }

  async exportMaterialBottleneck(query: ReportQueryDto): Promise<Buffer> {
    const { stuckItems } = await this.getMaterialBottleneck(query);
    const rows = stuckItems.map((it) => ({
      'Ticket No': it.ticketNo,
      'Mã trạm': it.siteCode,
      'Tên trạm': it.siteName,
      'Đang nghẽn ở': it.stage,
      'Số ngày nghẽn': it.daysStuck,
    }));
    return this.toExcelBuffer(rows, 'Nghẽn vật tư');
  }

  // ── Báo cáo: Vướng mắc ──────────────────────────────────────────
  async getIssues(query: ReportQueryDto) {
    const where = this.buildWhere(query);
    const workOrders = await this.prisma.workOrder.findMany({
      where: { ...where, issue: { not: null } },
      select: {
        ticketNo: true,
        issue: true,
        techUpdatedAt: true,
        site: { select: { siteName: true } },
        solution: { select: { solutionName: true } },
        period: { select: { periodName: true } },
        techUpdatedBy: { select: { fullName: true } },
      },
      orderBy: { techUpdatedAt: 'desc' },
    });

    return workOrders
      .filter((wo) => wo.issue && wo.issue.trim().length > 0)
      .map((wo) => ({
        ticketNo: wo.ticketNo,
        siteName: wo.site?.siteName || '',
        solutionName: wo.solution?.solutionName || '',
        periodName: wo.period?.periodName || '',
        issue: wo.issue,
        techUpdatedByName: wo.techUpdatedBy?.fullName || '',
        techUpdatedAt: wo.techUpdatedAt,
      }));
  }

  async exportIssues(query: ReportQueryDto): Promise<Buffer> {
    const items = await this.getIssues(query);
    const rows = items.map((it) => ({
      'Ticket No': it.ticketNo,
      'Tên trạm': it.siteName,
      'Giải pháp': it.solutionName,
      'Kỳ thực hiện': it.periodName,
      'Vướng mắc': it.issue,
      'Người cập nhật': it.techUpdatedByName,
      'Thời gian': it.techUpdatedAt ? new Date(it.techUpdatedAt).toLocaleString('vi-VN') : '',
    }));
    return this.toExcelBuffer(rows, 'Vướng mắc');
  }

  // ── Báo cáo: Xu hướng theo kỳ ────────────────────────────────────
  async getTrend(query: TrendQueryDto) {
    const where: any = {};
    if (query.solutionId) where.solutionId = parseInt(query.solutionId);

    const periods = await this.prisma.period.findMany({
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        periodCode: true,
        periodName: true,
        workOrders: {
          where,
          select: { writtenTicket: true, installationStatus: true, integrationStatus: true },
        },
      },
    });

    return periods
      .filter((p) => p.workOrders.length > 0)
      .map((p) => {
        const wos = p.workOrders;
        return {
          periodId: p.id,
          periodCode: p.periodCode,
          periodName: p.periodName,
          total: wos.length,
          written: wos.filter((w) => w.writtenTicket === WrittenTicketStatus.WRITTEN).length,
          installCompleted: wos.filter((w) => w.installationStatus === InstallStatus.COMPLETED).length,
          integrationCompleted: wos.filter((w) => w.integrationStatus === InstallStatus.COMPLETED).length,
          cancelled: wos.filter((w) => w.installationStatus === InstallStatus.CANCELLED).length,
        };
      });
  }

  async exportTrend(query: TrendQueryDto): Promise<Buffer> {
    const rows = await this.getTrend(query);
    const sheetRows = rows.map((r) => ({
      'Kỳ thực hiện': r.periodName,
      'Tổng phiếu': r.total,
      'Viết phiếu': r.written,
      'Hoàn thành lắp đặt': r.installCompleted,
      'Hoàn thành tích hợp': r.integrationCompleted,
      'Hủy': r.cancelled,
    }));
    return this.toExcelBuffer(sheetRows, 'Xu hướng theo kỳ');
  }

  private toExcelBuffer(rows: any[], sheetName: string): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private summaryRowToSheetRow(r: SummaryRow) {
    return {
      'Giải pháp': r.solutionName,
      'Tổng phiếu': r.total,
      'Viết phiếu': r.written,
      'ACT nhận VT': r.actReceived,
      'TTKV nhận VT': r.ttkvReceived,
      'VT lên trạm': r.siteReceived,
      'Đang lắp đặt': r.installInProgress,
      'Hoàn thành lắp đặt': r.installCompleted,
      'Hoàn thành tích hợp': r.integrationCompleted,
      'Hủy': r.cancelled,
    };
  }

  /** Excel sheet name tối đa 31 ký tự, không chứa các ký tự đặc biệt :\/?*[] */
  private sanitizeSheetName(name: string): string {
    return name.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Sheet';
  }

  async exportSummary(query: ReportQueryDto): Promise<Buffer> {
    const { company, byTtkv } = await this.getSummary(query);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(company.map((r) => this.summaryRowToSheetRow(r))),
      'Công ty',
    );

    const usedNames = new Set<string>(['Công ty']);
    for (const t of byTtkv) {
      let sheetName = this.sanitizeSheetName(t.ttkvName);
      if (usedNames.has(sheetName)) sheetName = this.sanitizeSheetName(`${t.ttkvName} (${t.ttkvCode})`);
      usedNames.add(sheetName);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(t.rows.map((r) => this.summaryRowToSheetRow(r))),
        sheetName,
      );
    }

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
