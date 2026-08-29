import { InstallStatus } from '@prisma/client';

export function computeSlaStatus(wo: any): string {
  if (wo.installationStatus === InstallStatus.COMPLETED) return 'Hoàn thành';
  if (wo.installationStatus === InstallStatus.CANCELLED) return 'Đã hủy';
  const expectedDays = wo.solution?.expectedDays || 30;
  const created = new Date(wo.createdAt);
  const deadline = new Date(
    created.getTime() + expectedDays * 24 * 60 * 60 * 1000,
  );
  const now = new Date();
  const warnDate = new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000);
  if (now > deadline) return 'Quá hạn';
  if (now > warnDate) return 'Sắp quá hạn';
  return 'Đúng hạn';
}
