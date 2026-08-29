import {
  PrismaClient,
  UserRole,
  PeriodStatus,
  WrittenTicketStatus,
  MaterialStatus,
  InstallStatus,
  PhotoStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PROVINCES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Khánh Hòa'];
const DISTRICTS: Record<string, string[]> = {
  'Hà Nội':     ['Hoàn Kiếm', 'Đống Đa', 'Ba Đình', 'Cầu Giấy', 'Thanh Xuân', 'Hoàng Mai'],
  'TP.HCM':     ['Quận 1', 'Quận 3', 'Bình Thạnh', 'Gò Vấp', 'Tân Phú', 'Bình Tân'],
  'Đà Nẵng':    ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn'],
  'Hải Phòng':  ['Hồng Bàng', 'Ngô Quyền', 'Lê Chân', 'Hải An'],
  'Cần Thơ':    ['Ninh Kiều', 'Bình Thủy', 'Cái Răng'],
  'Bình Dương': ['Thủ Dầu Một', 'Thuận An', 'Dĩ An'],
  'Đồng Nai':   ['Biên Hòa', 'Long Khánh', 'Trảng Bom'],
  'Khánh Hòa':  ['Nha Trang', 'Cam Ranh', 'Ninh Hòa'],
};
const SITE_TYPES = ['BTS', 'NodeB', 'eNodeB', 'gNodeB'];
const EXECUTOR_NAMES = [
  'Nguyễn Văn An', 'Trần Minh Hoàng', 'Lê Quốc Việt', 'Phạm Thành Đạt',
  'Hoàng Đức Mạnh', 'Vũ Tiến Dũng', 'Đặng Hải Nam', 'Bùi Thanh Tùng',
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log('Seeding mock data...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  const users = [
    { username: 'admin',    fullName: 'Administrator',        email: 'admin@dh.local',    role: UserRole.ADMIN,       pw: 'Admin@123' },
    { username: 'dieuhanh', fullName: 'Nguyễn Điều Hành',     email: 'dieuhanh@dh.local', role: UserRole.SUPERVISOR,  pw: 'Dieuhanh@123' },
    { username: 'thicong1', fullName: 'Trần Minh Hoàng',       email: 'hoang@dh.local',    role: UserRole.TECHNICIAN,  pw: 'Thicong@123' },
    { username: 'thicong2', fullName: 'Lê Quốc Việt',          email: 'viet@dh.local',     role: UserRole.TECHNICIAN,  pw: 'Thicong@123' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, fullName: u.fullName, email: u.email, role: u.role, passwordHash: await hash(u.pw), active: true },
    });
  }
  console.log(`✓ ${users.length} users`);

  // ─── Sites ────────────────────────────────────────────────────────────────
  const sitesData: { siteCode: string; siteName: string; province: string; district: string; siteType: string }[] = [];
  let siteIdx = 1;
  for (const province of PROVINCES) {
    const districts = DISTRICTS[province];
    const count = province === 'Hà Nội' || province === 'TP.HCM' ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const type = rand(SITE_TYPES);
      const district = districts[i % districts.length];
      sitesData.push({
        siteCode: `DH${String(siteIdx).padStart(4, '0')}`,
        siteName: `Trạm ${type} ${district} ${i + 1}`,
        province,
        district,
        siteType: type,
      });
      siteIdx++;
    }
  }

  for (const s of sitesData) {
    await prisma.site.upsert({
      where: { siteCode: s.siteCode },
      update: {},
      create: {
        siteCode: s.siteCode, siteName: s.siteName,
        province: s.province, district: s.district, siteType: s.siteType,
        latitude:  10 + Math.random() * 12,
        longitude: 104 + Math.random() * 6,
        sector5G: rand([1, 2, 3, 6]),
        managerName: rand(EXECUTOR_NAMES),
        phone: `09${randInt(10000000, 99999999)}`,
        active: true,
      },
    });
  }
  console.log(`✓ ${sitesData.length} sites`);

  // ─── Solutions ────────────────────────────────────────────────────────────
  const solutionsData = [
    { solutionCode: 'SWAP-4G',   solutionName: 'SWAP thiết bị 4G LTE',            description: 'Thay thế toàn bộ thiết bị Radio 4G LTE',              expectedDays: 45 },
    { solutionCode: 'UPLIFT-5G', solutionName: 'Uplift 5G NSA',                   description: 'Nâng cấp trạm lên 5G Non-Standalone',                 expectedDays: 60 },
    { solutionCode: 'FIBER-BB',  solutionName: 'Triển khai Backhaul Quang',        description: 'Kéo cáp quang, cấu hình backhaul',                    expectedDays: 30 },
    { solutionCode: 'ANT-OPT',   solutionName: 'Tối ưu ăng-ten & phủ sóng',      description: 'Điều chỉnh tilt, azimuth, cấu hình beam forming',      expectedDays: 14 },
    { solutionCode: 'MW-LINK',   solutionName: 'Lắp đặt kết nối Microwave',       description: 'Lắp thiết bị MW, căn chỉnh ăng-ten, kết nối truyền dẫn', expectedDays: 21 },
  ];

  for (const sol of solutionsData) {
    await prisma.solution.upsert({
      where: { solutionCode: sol.solutionCode },
      update: {},
      create: { ...sol, active: true },
    });
  }
  console.log(`✓ ${solutionsData.length} solutions`);

  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const allSites = await prisma.site.findMany({ select: { id: true } });
  const allSolutions = await prisma.solution.findMany({ select: { id: true, expectedDays: true } });

  // ─── Period 1: Kỳ Q1/2026 (CLOSED) ───────────────────────────────────────
  const p1 = await prisma.period.upsert({
    where: { periodCode: 'KY-Q1-2026' },
    update: {},
    create: {
      periodCode: 'KY-Q1-2026',
      periodName: 'Kỳ triển khai Q1/2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: PeriodStatus.CLOSED,
      createdById: admin!.id,
    },
  });

  // Gán 3 solutions và 15 sites cho kỳ 1
  const p1Solutions = allSolutions.slice(0, 3);
  const p1Sites = allSites.slice(0, 15);
  for (const s of p1Solutions) {
    await prisma.periodSolution.upsert({ where: { periodId_solutionId: { periodId: p1.id, solutionId: s.id } }, update: {}, create: { periodId: p1.id, solutionId: s.id } });
  }
  for (const s of p1Sites) {
    await prisma.periodSite.upsert({ where: { periodId_siteId: { periodId: p1.id, siteId: s.id } }, update: {}, create: { periodId: p1.id, siteId: s.id } });
  }

  // ─── Period 2: Kỳ Q2/2026 (ACTIVE) ──────────────────────────────────────
  const p2 = await prisma.period.upsert({
    where: { periodCode: 'KY-Q2-2026' },
    update: {},
    create: {
      periodCode: 'KY-Q2-2026',
      periodName: 'Kỳ triển khai Q2/2026',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
      status: PeriodStatus.ACTIVE,
      createdById: admin!.id,
    },
  });

  // Gán tất cả solutions và sites cho kỳ 2
  for (const s of allSolutions) {
    await prisma.periodSolution.upsert({ where: { periodId_solutionId: { periodId: p2.id, solutionId: s.id } }, update: {}, create: { periodId: p2.id, solutionId: s.id } });
  }
  for (const s of allSites) {
    await prisma.periodSite.upsert({ where: { periodId_siteId: { periodId: p2.id, siteId: s.id } }, update: {}, create: { periodId: p2.id, siteId: s.id } });
  }

  console.log('✓ 2 periods');

  // ─── Work Orders ──────────────────────────────────────────────────────────
  // Kỳ 1: tất cả done/mixed (đã kết thúc)
  let woIdx = 1;
  const makeTicket = () => `WO-${String(woIdx++).padStart(5, '0')}`;

  for (const site of p1Sites) {
    for (const sol of p1Solutions) {
      const done = Math.random() > 0.15;
      const createdDaysAgo = randInt(60, 90);
      await prisma.workOrder.upsert({
        where: { ticketNo: `WO-${String(woIdx).padStart(5, '0')}` },
        update: {},
        create: {
          ticketNo: makeTicket(),
          periodId: p1.id, siteId: site.id, solutionId: sol.id, createdById: admin!.id,
          createdAt: daysAgo(createdDaysAgo),
          writtenTicket: WrittenTicketStatus.WRITTEN,
          actReceivedMaterial: MaterialStatus.RECEIVED,
          ttkvReceivedMaterial: MaterialStatus.TRANSFERRED,
          planDate: daysAgo(createdDaysAgo - 5),
          executorName: rand(EXECUTOR_NAMES),
          installationStatus: done ? InstallStatus.COMPLETED : InstallStatus.IN_PROGRESS,
          photoStatus: done ? PhotoStatus.TAKEN : PhotoStatus.NOT_TAKEN,
          integrationStatus: done ? InstallStatus.COMPLETED : rand([InstallStatus.NOT_STARTED, InstallStatus.IN_PROGRESS]),
          completedDate: done ? daysAgo(randInt(5, 30)) : null,
          note: done ? 'Hoàn thành đúng tiến độ' : 'Đang thi công, vướng mặt bằng',
        },
      });
    }
  }

  // Kỳ 2 (đang chạy): mix các trạng thái SLA
  for (const site of allSites) {
    // mỗi trạm chọn random 2-4 solutions
    const numSol = randInt(2, Math.min(4, allSolutions.length));
    const chosenSols = [...allSolutions].sort(() => Math.random() - 0.5).slice(0, numSol);

    for (const sol of chosenSols) {
      const createdDaysAgo = randInt(5, 55);
      const r = Math.random();

      let installStatus: InstallStatus;
      let photoStatus: PhotoStatus;
      let integrationStatus: InstallStatus;
      let completedDate: Date | null = null;
      let writtenTicket: WrittenTicketStatus;
      let actMat: MaterialStatus;
      let ttkvMat: MaterialStatus;
      let note: string | null = null;
      let issue: string | null = null;
      let executorName: string | null = null;
      let planDate: Date | null = null;

      if (r < 0.25) {
        // Hoàn thành
        installStatus = InstallStatus.COMPLETED;
        photoStatus = PhotoStatus.TAKEN;
        integrationStatus = InstallStatus.COMPLETED;
        completedDate = daysAgo(randInt(1, createdDaysAgo - 1));
        writtenTicket = WrittenTicketStatus.WRITTEN;
        actMat = MaterialStatus.RECEIVED;
        ttkvMat = MaterialStatus.TRANSFERRED;
        executorName = rand(EXECUTOR_NAMES);
        planDate = daysAgo(createdDaysAgo - 3);
        note = 'Hoàn thành, đã nghiệm thu';
      } else if (r < 0.50) {
        // Đang thi công - đúng hạn
        installStatus = InstallStatus.IN_PROGRESS;
        photoStatus = PhotoStatus.NOT_TAKEN;
        integrationStatus = InstallStatus.NOT_STARTED;
        writtenTicket = WrittenTicketStatus.WRITTEN;
        actMat = MaterialStatus.RECEIVED;
        ttkvMat = MaterialStatus.TRANSFERRED;
        executorName = rand(EXECUTOR_NAMES);
        planDate = daysFromNow(randInt(3, 10));
        note = 'Đang thi công lắp đặt thiết bị';
      } else if (r < 0.68) {
        // Sắp quá hạn (còn < 3 ngày)
        installStatus = InstallStatus.IN_PROGRESS;
        photoStatus = PhotoStatus.NOT_TAKEN;
        integrationStatus = InstallStatus.NOT_STARTED;
        writtenTicket = WrittenTicketStatus.WRITTEN;
        actMat = MaterialStatus.RECEIVED;
        ttkvMat = rand([MaterialStatus.EMPTY, MaterialStatus.TRANSFERRED]);
        executorName = rand(EXECUTOR_NAMES);
        planDate = daysFromNow(randInt(0, 2));
        note = 'Tiến độ chậm, cần đẩy nhanh';
        issue = 'Thiếu nhân lực tại công trường';
      } else if (r < 0.82) {
        // Quá hạn (createdAt + expectedDays < today)
        installStatus = InstallStatus.IN_PROGRESS;
        photoStatus = PhotoStatus.NOT_TAKEN;
        integrationStatus = InstallStatus.NOT_STARTED;
        writtenTicket = rand([WrittenTicketStatus.EMPTY, WrittenTicketStatus.WRITTEN]);
        actMat = rand([MaterialStatus.EMPTY, MaterialStatus.RECEIVED]);
        ttkvMat = MaterialStatus.EMPTY;
        executorName = rand([...EXECUTOR_NAMES, null]);
        issue = rand(['Vướng mặt bằng', 'Thiếu vật tư', 'Chờ phê duyệt thiết kế', 'Thời tiết xấu', 'Đơn vị thi công bận']);
      } else {
        // Chưa bắt đầu
        installStatus = InstallStatus.NOT_STARTED;
        photoStatus = PhotoStatus.NOT_TAKEN;
        integrationStatus = InstallStatus.NOT_STARTED;
        writtenTicket = rand([WrittenTicketStatus.EMPTY, WrittenTicketStatus.WRITTEN]);
        actMat = rand([MaterialStatus.EMPTY, MaterialStatus.RECEIVED]);
        ttkvMat = MaterialStatus.EMPTY;
      }

      await prisma.workOrder.upsert({
        where: { ticketNo: `WO-${String(woIdx).padStart(5, '0')}` },
        update: {},
        create: {
          ticketNo: makeTicket(),
          periodId: p2.id, siteId: site.id, solutionId: sol.id, createdById: admin!.id,
          createdAt: daysAgo(createdDaysAgo),
          writtenTicket, actReceivedMaterial: actMat, ttkvReceivedMaterial: ttkvMat,
          planDate, executorName,
          installationStatus: installStatus,
          photoStatus,
          integrationStatus,
          completedDate, note, issue,
        },
      });
    }
  }

  const totalWO = await prisma.workOrder.count();
  console.log(`✓ ${totalWO} work orders`);
  console.log('\nDone! Accounts:');
  console.log('  admin       / Admin@123   (ADMIN)');
  console.log('  dieuhanh    / Dieuhanh@123 (SUPERVISOR)');
  console.log('  thicong1    / Thicong@123  (TECHNICIAN)');
  console.log('  thicong2    / Thicong@123  (TECHNICIAN)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
