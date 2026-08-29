import { Injectable } from '@nestjs/common';
import { NotifType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findForUser(userId: number) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        workOrder: {
          select: {
            ticketNo: true,
            site: { select: { siteCode: true, siteName: true } },
            period: { select: { periodName: true } },
          },
        },
      },
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { items, unreadCount };
  }

  async markRead(id: number, userId: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  /** Called from WorkOrdersService after a successful update. */
  async createFromWoUpdate(
    workOrderId: number,
    ticketNo: string,
    siteCode: string,
    siteName: string,
    solutionName: string,
    actorId: number | null,
    actorName: string,
    actorRole: string,
    changes: Record<string, { from: any; to: any }>,
  ) {
    // ── Notifications for ADMIN / SUPERVISOR ──────────────────────────────
    const managerNotifs: { type: NotifType; message: string }[] = [];

    const matFields = ['actReceivedMaterial', 'ttkvReceivedMaterial'];
    const matChanged = matFields.some(
      (f) => changes[f] && ['RECEIVED', 'TRANSFERRED'].includes(changes[f].to),
    );
    if (matChanged) {
      managerNotifs.push({
        type: NotifType.MATERIAL_UPDATED,
        message: `${actorName} đã cập nhật vật tư phiếu ${ticketNo} (${siteCode} — ${solutionName})`,
      });
    }

    if (changes.installationStatus?.to === 'COMPLETED') {
      managerNotifs.push({
        type: NotifType.CONSTRUCTION_COMPLETED,
        message: `${actorName} đã hoàn thành lắp đặt phiếu ${ticketNo} (${siteCode} — ${solutionName})`,
      });
    }

    if (changes.integrationStatus?.to === 'COMPLETED') {
      managerNotifs.push({
        type: NotifType.INTEGRATION_COMPLETED,
        message: `${actorName} đã hoàn thành tích hợp phiếu ${ticketNo} (${siteCode} — ${solutionName})`,
      });
    }

    // ── Notifications for TECHNICIAN — when manager completes material ticket
    const techNotifs: { type: NotifType; message: string }[] = [];

    const managerRoles: string[] = [
      UserRole.ADMIN,
      UserRole.SUPERVISOR,
    ];
    const isManager = managerRoles.includes(actorRole);
    if (isManager && changes.writtenTicket?.to === 'WRITTEN') {
      techNotifs.push({
        type: NotifType.TICKET_READY,
        message: `Phiếu vật tư ${ticketNo} — ${siteName} (${solutionName}) đã được hoàn thành, sẵn sàng thi công`,
      });
    }

    if (!managerNotifs.length && !techNotifs.length) return;

    const rows: {
      userId: number;
      workOrderId: number;
      type: NotifType;
      message: string;
    }[] = [];

    if (managerNotifs.length) {
      const managers = await this.prisma.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPERVISOR] },
          active: true,
          ...(actorId !== null ? { id: { not: actorId } } : {}),
        },
        select: { id: true },
      });
      managers.forEach((r) =>
        managerNotifs.forEach((n) =>
          rows.push({ userId: r.id, workOrderId, ...n }),
        ),
      );
    }

    if (techNotifs.length) {
      const techs = await this.prisma.user.findMany({
        where: {
          role: UserRole.TECHNICIAN,
          active: true,
          ...(actorId !== null ? { id: { not: actorId } } : {}),
        },
        select: { id: true },
      });
      techs.forEach((r) =>
        techNotifs.forEach((n) =>
          rows.push({ userId: r.id, workOrderId, ...n }),
        ),
      );
    }

    if (rows.length) await this.prisma.notification.createMany({ data: rows });
  }
}
