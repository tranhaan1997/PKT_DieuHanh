import { Injectable } from '@nestjs/common';
import { InstallStatus, MaterialStatus, WrittenTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MATERIAL_STAGES: Array<{ key: 'writtenTicket' | 'actReceivedMaterial' | 'ttkvReceivedMaterial' | 'siteReceivedMaterial'; label: string }> = [
  { key: 'writtenTicket', label: 'Viết phiếu' },
  { key: 'actReceivedMaterial', label: 'ACT nhận VT' },
  { key: 'ttkvReceivedMaterial', label: 'TTKV nhận VT' },
  { key: 'siteReceivedMaterial', label: 'VT lên trạm' },
];

function isStageDone(stageKey: string, status: string): boolean {
  return stageKey === 'writtenTicket'
    ? status === WrittenTicketStatus.WRITTEN
    : status !== MaterialStatus.EMPTY;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(periodId?: number) {
    const where: any = { installationStatus: { not: InstallStatus.CANCELLED } };
    if (periodId) where.periodId = periodId;

    const workOrders = await this.prisma.workOrder.findMany({
      where,
      select: {
        installationStatus: true,
        issue: true,
        createdAt: true,
        solution: { select: { expectedDays: true } },
      },
    });

    const total = workOrders.length;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let overdue = 0;
    let hasIssue = 0;
    let nearDeadline = 0;

    const now = new Date();

    for (const wo of workOrders) {
      const expectedDays = wo.solution?.expectedDays || 30;
      const deadline = new Date(
        wo.createdAt.getTime() + expectedDays * 24 * 60 * 60 * 1000,
      );
      const warnDate = new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000);

      if (wo.installationStatus === InstallStatus.COMPLETED) completed++;
      else if (wo.installationStatus === InstallStatus.IN_PROGRESS)
        inProgress++;
      else notStarted++;

      if (wo.installationStatus !== InstallStatus.COMPLETED) {
        if (now > deadline) overdue++;
        else if (now > warnDate) nearDeadline++;
      }

      if (wo.issue && wo.issue.trim().length > 0) hasIssue++;
    }

    return {
      total,
      completed,
      inProgress,
      notStarted,
      overdue,
      nearDeadline,
      hasIssue,
    };
  }

  async getByPeriod() {
    const periods = await this.prisma.period.findMany({
      include: {
        workOrders: {
          where: { installationStatus: { not: InstallStatus.CANCELLED } },
          select: { installationStatus: true },
        },
      },
      orderBy: { startDate: 'desc' },
      take: 10,
    });

    return periods.map((p) => ({
      periodName: p.periodName,
      total: p.workOrders.length,
      completed: p.workOrders.filter(
        (w) => w.installationStatus === InstallStatus.COMPLETED,
      ).length,
      inProgress: p.workOrders.filter(
        (w) => w.installationStatus === InstallStatus.IN_PROGRESS,
      ).length,
      notStarted: p.workOrders.filter(
        (w) => w.installationStatus === InstallStatus.NOT_STARTED,
      ).length,
    }));
  }

  async getBySolution(periodId?: number) {
    const solutions = await this.prisma.solution.findMany({
      include: {
        workOrders: {
          where: {
            ...(periodId ? { periodId } : {}),
            installationStatus: { not: InstallStatus.CANCELLED },
          },
          select: { installationStatus: true },
        },
      },
    });

    return solutions
      .filter((s) => s.workOrders.length > 0)
      .map((s) => ({
        solutionName: s.solutionName,
        total: s.workOrders.length,
        completed: s.workOrders.filter(
          (w) => w.installationStatus === InstallStatus.COMPLETED,
        ).length,
        inProgress: s.workOrders.filter(
          (w) => w.installationStatus === InstallStatus.IN_PROGRESS,
        ).length,
        notStarted: s.workOrders.filter(
          (w) => w.installationStatus === InstallStatus.NOT_STARTED,
        ).length,
      }));
  }

  async getByTtkv(periodId?: number) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: periodId ? { periodId } : undefined,
      select: {
        installationStatus: true,
        siteReceivedMaterial: true,
        site: { select: { ttkvCode: true, ttkv: { select: { name: true } } } },
        solution: { select: { id: true, solutionName: true } },
      },
    });

    // Danh sách giải pháp xuất hiện trong dữ liệu — dùng để dựng cột động cho biểu đồ,
    // sắp theo tổng số phiếu giảm dần.
    const solutionTotals = new Map<number, { solutionId: number; solutionName: string; total: number }>();

    const ttkvMap = new Map<
      string,
      {
        ttkvCode: string; ttkvName: string; total: number; completed: number;
        notCompleted: number; materialSecured: number;
        bySolution: Map<number, { solutionId: number; solutionName: string; total: number; completed: number; percentage: number }>;
      }
    >();

    for (const wo of workOrders) {
      if (wo.installationStatus === InstallStatus.CANCELLED) continue;

      const code = wo.site.ttkvCode || 'KHONG_RO';
      const name = wo.site.ttkv?.name || (wo.site.ttkvCode ? wo.site.ttkvCode : 'Không rõ');
      const solId = wo.solution.id;
      const solName = wo.solution.solutionName;
      const isDone = wo.installationStatus === InstallStatus.COMPLETED;

      const ttkvEntry = ttkvMap.get(code) ?? { ttkvCode: code, ttkvName: name, total: 0, completed: 0, notCompleted: 0, materialSecured: 0, bySolution: new Map() };
      ttkvEntry.total++;
      if (isDone) {
        ttkvEntry.completed++;
      } else {
        ttkvEntry.notCompleted++;
        if (wo.siteReceivedMaterial !== MaterialStatus.EMPTY) ttkvEntry.materialSecured++;
      }
      const solEntry = ttkvEntry.bySolution.get(solId) ?? { solutionId: solId, solutionName: solName, total: 0, completed: 0, percentage: 0 };
      solEntry.total++;
      if (isDone) solEntry.completed++;
      ttkvEntry.bySolution.set(solId, solEntry);
      ttkvMap.set(code, ttkvEntry);

      const st = solutionTotals.get(solId) ?? { solutionId: solId, solutionName: solName, total: 0 };
      st.total++;
      solutionTotals.set(solId, st);
    }

    const solutions = [...solutionTotals.values()]
      .sort((a, b) => b.total - a.total)
      .map(({ solutionId, solutionName }) => ({ solutionId, solutionName }));

    const rows = [...ttkvMap.values()]
      .map((t) => ({
        ttkvCode: t.ttkvCode,
        ttkvName: t.ttkvName,
        total: t.total,
        completed: t.completed,
        notCompleted: t.notCompleted,
        materialSecured: t.materialSecured,
        bySolution: Object.fromEntries(
          [...t.bySolution.values()].map((s) => [
            s.solutionId,
            { ...s, percentage: s.total ? Math.round((s.completed / s.total) * 100) : 0 },
          ]),
        ),
      }))
      .sort((a, b) => b.total - a.total);

    return { solutions, rows };
  }

  async getMaterialProgress(periodId?: number) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: periodId ? { periodId } : undefined,
      select: {
        writtenTicket: true,
        actReceivedMaterial: true,
        ttkvReceivedMaterial: true,
        siteReceivedMaterial: true,
      },
    });

    const total = workOrders.length;
    return MATERIAL_STAGES.map((s) => {
      const done = workOrders.filter((wo) => isStageDone(s.key, (wo as any)[s.key])).length;
      return { stage: s.label, total, done, percentage: total ? Math.round((done / total) * 100) : 0 };
    });
  }

  async getMaterialProgressByTtkv(periodId?: number) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: periodId ? { periodId } : undefined,
      select: {
        writtenTicket: true,
        actReceivedMaterial: true,
        ttkvReceivedMaterial: true,
        siteReceivedMaterial: true,
        site: { select: { ttkvCode: true, ttkv: { select: { name: true } } } },
      },
    });

    const map = new Map<string, { ttkvName: string; total: number; stages: Map<string, { done: number; total: number }> }>();
    for (const wo of workOrders) {
      const code = wo.site.ttkvCode || 'KHONG_RO';
      const name = wo.site.ttkv?.name || (wo.site.ttkvCode ? wo.site.ttkvCode : 'Không rõ');
      const entry = map.get(code) ?? { ttkvName: name, total: 0, stages: new Map() };
      entry.total++;
      for (const s of MATERIAL_STAGES) {
        const st = entry.stages.get(s.key) ?? { done: 0, total: 0 };
        st.total++;
        if (isStageDone(s.key, (wo as any)[s.key])) st.done++;
        entry.stages.set(s.key, st);
      }
      map.set(code, entry);
    }

    return [...map.entries()]
      .map(([ttkvCode, e]) => ({
        ttkvCode,
        ttkvName: e.ttkvName,
        total: e.total,
        stages: MATERIAL_STAGES.map((s) => {
          const st = e.stages.get(s.key) ?? { done: 0, total: 0 };
          return { stage: s.label, done: st.done, total: st.total, percentage: st.total ? Math.round((st.done / st.total) * 100) : 0 };
        }),
      }))
      .sort((a, b) => b.total - a.total);
  }

  async getByProvince() {
    const result = await this.prisma.workOrder.groupBy({
      by: ['siteId'],
      _count: { id: true },
    });

    const sites = await this.prisma.site.findMany({
      select: { id: true, province: true },
    });

    const siteMap = new Map(sites.map((s) => [s.id, s.province || 'Không rõ']));
    const provinceMap: Record<string, number> = {};

    for (const r of result) {
      const province = siteMap.get(r.siteId) || 'Không rõ';
      provinceMap[province] = (provinceMap[province] || 0) + r._count.id;
    }

    return Object.entries(provinceMap).map(([province, count]) => ({
      province,
      count,
    }));
  }
}
