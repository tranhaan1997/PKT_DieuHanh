import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

/** Chuẩn hoá SĐT đọc từ Excel: ép về dạng text, bổ sung số 0 đầu nếu thiếu (Excel hay tự chuyển cột số thành number, làm mất số 0 đầu). */
function normalizePhone(raw: unknown): string | null {
  const str = (raw ?? '').toString().trim();
  if (!str) return null;
  const digits = str.replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('0') ? digits : `0${digits}`;
}

export class CreateSiteDto {
  @IsString() siteCode: string;
  @IsString() siteName: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() siteType?: string;
  @IsOptional() @IsString() ttkvCode?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() managerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsNumber() sector5G?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class UpdateSiteDto extends CreateSiteDto {
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SiteQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() ttkvCode?: string;
  @IsOptional() @IsString() active?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

const INCLUDE_TTKV = { ttkv: { select: { code: true, name: true } } };

/** Ép cột theo header (vd "SĐT") thành kiểu text trong sheet, tránh Excel tự hiểu thành số và mất số 0 đầu. */
function forceTextColumn(ws: XLSX.WorkSheet, header: string, rowCount: number) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let colIdx = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell?.v === header) { colIdx = c; break; }
  }
  if (colIdx === -1) return;
  for (let r = 1; r <= rowCount; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIdx });
    const cell = ws[addr];
    if (cell) cell.t = 's';
  }
}

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: SiteQueryDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { siteCode: { contains: query.search, mode: 'insensitive' } },
        { siteName: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.province) where.province = query.province;
    if (query.ttkvCode) where.ttkvCode = query.ttkvCode;
    if (query.active !== undefined) where.active = query.active === 'true';

    const [data, total] = await Promise.all([
      this.prisma.site.findMany({
        where,
        skip,
        take: limit,
        orderBy: { siteCode: 'asc' },
        include: INCLUDE_TTKV,
      }),
      this.prisma.site.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: INCLUDE_TTKV,
    });
    if (!site) throw new NotFoundException('Không tìm thấy trạm');
    return site;
  }

  async create(dto: CreateSiteDto) {
    const exists = await this.prisma.site.findUnique({
      where: { siteCode: dto.siteCode },
    });
    if (exists)
      throw new ConflictException(`Mã trạm ${dto.siteCode} đã tồn tại`);
    return this.prisma.site.create({
      data: { ...dto, phone: dto.phone ? normalizePhone(dto.phone) : dto.phone },
      include: INCLUDE_TTKV,
    });
  }

  async update(id: number, dto: UpdateSiteDto) {
    await this.findOne(id);
    return this.prisma.site.update({
      where: { id },
      data: { ...dto, phone: dto.phone ? normalizePhone(dto.phone) : dto.phone },
      include: INCLUDE_TTKV,
    });
  }

  private async checkInUse(id: number) {
    const [woCount, psCount] = await Promise.all([
      this.prisma.workOrder.count({ where: { siteId: id } }),
      this.prisma.periodSite.count({ where: { siteId: id } }),
    ]);
    if (woCount > 0 || psCount > 0)
      throw new ConflictException('Trạm đã phát sinh dữ liệu, không thể xóa');
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.checkInUse(id);
    await this.prisma.site.delete({ where: { id } });
    return { message: 'Đã xóa trạm' };
  }

  async bulkRemove(
    ids: number[],
  ): Promise<{ deleted: number; skipped: string[] }> {
    const skipped: string[] = [];
    let deleted = 0;
    for (const id of ids) {
      const site = await this.prisma.site.findUnique({ where: { id } });
      if (!site) continue;
      const [woCount, psCount] = await Promise.all([
        this.prisma.workOrder.count({ where: { siteId: id } }),
        this.prisma.periodSite.count({ where: { siteId: id } }),
      ]);
      if (woCount > 0 || psCount > 0) {
        skipped.push(site.siteCode);
      } else {
        await this.prisma.site.delete({ where: { id } });
        deleted++;
      }
    }
    return { deleted, skipped };
  }

  async importExcel(
    buffer: Buffer,
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    // Build ttkv lowercase→code map
    const ttkvList = await this.prisma.ttkv.findMany();
    const ttkvMap = new Map(ttkvList.map((t) => [t.code.toLowerCase(), t.code]));

    const existingSites = await this.prisma.site.findMany({
      select: { id: true, siteCode: true },
    });
    const existingByLower = new Map(
      existingSites.map((s) => [s.siteCode.toLowerCase(), s.id]),
    );

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const siteCode = String(row['Mã trạm'] || row['siteCode'] || '').trim();
        const siteName = String(
          row['Tên trạm'] || row['siteName'] || '',
        ).trim();
        if (!siteCode || !siteName) {
          errors.push(`Dòng thiếu mã hoặc tên trạm`);
          continue;
        }

        const rawTtkv = (row['TTKV'] || row['ttkv'] || '').toString().trim();
        const ttkvCode = ttkvMap.get(rawTtkv.toLowerCase()) ?? null;

        const payload = {
          siteName,
          province: row['Tỉnh/Thành'] || row['province'] || null,
          district: row['Quận/Huyện'] || row['district'] || null,
          siteType: row['Loại trạm'] || row['siteType'] || null,
          ttkvCode,
          address: row['Địa chỉ'] || row['address'] || null,
          managerName: row['NVQLT'] || row['managerName'] || null,
          phone: normalizePhone(row['SĐT'] || row['phone']),
          sector5G: row['Số sector 5G'] || row['sector5G'] || null,
          latitude: row['Vĩ độ'] || row['latitude'] || null,
          longitude: row['Kinh độ'] || row['longitude'] || null,
        };

        const existingId = existingByLower.get(siteCode.toLowerCase());
        if (existingId) {
          await this.prisma.site.update({ where: { id: existingId }, data: payload });
          updated++;
        } else {
          const created = await this.prisma.site.create({ data: { siteCode, ...payload } });
          existingByLower.set(siteCode.toLowerCase(), created.id);
          imported++;
        }
      } catch (e: any) {
        errors.push(`Lỗi dòng: ${e.message}`);
      }
    }

    return { imported, updated, errors };
  }

  async exportTemplate(): Promise<Buffer> {
    const sample = [
      {
        'Mã trạm': 'HN0001',
        'Tên trạm': 'Trạm Hoàn Kiếm 1',
        'Tỉnh/Thành': 'Hà Nội',
        'Quận/Huyện': 'Hoàn Kiếm',
        'Loại trạm': 'eNodeB',
        TTKV: 'BSG',
        'Địa chỉ': '1 Đinh Tiên Hoàng',
        NVQLT: 'Nguyễn Văn A',
        SĐT: '0901234567',
      },
      {
        'Mã trạm': 'HN0002',
        'Tên trạm': 'Trạm Ba Đình 1',
        'Tỉnh/Thành': 'Hà Nội',
        'Quận/Huyện': 'Ba Đình',
        'Loại trạm': 'gNodeB',
        TTKV: 'BSG',
        'Địa chỉ': '10 Hoàng Diệu',
        NVQLT: 'Trần Thị B',
        SĐT: '0912345678',
      },
      {
        'Mã trạm': 'HCM001',
        'Tên trạm': 'Trạm Quận 1 A',
        'Tỉnh/Thành': 'TP.HCM',
        'Quận/Huyện': 'Quận 1',
        'Loại trạm': 'eNodeB',
        TTKV: 'SGN',
        'Địa chỉ': '50 Lê Lợi',
        NVQLT: 'Lê Văn C',
        SĐT: '0923456789',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    forceTextColumn(ws, 'SĐT', sample.length);
    ws['!cols'] = [16, 24, 14, 14, 10, 8, 30, 18, 14].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mẫu import trạm');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportExcel(): Promise<Buffer> {
    const sites = await this.prisma.site.findMany({
      where: { active: true },
      orderBy: { siteCode: 'asc' },
      include: INCLUDE_TTKV,
    });
    const rows = sites.map((s) => ({
      'Mã trạm': s.siteCode,
      'Tên trạm': s.siteName,
      'Tỉnh/Thành': s.province || '',
      'Quận/Huyện': s.district || '',
      'Loại trạm': s.siteType || '',
      TTKV: s.ttkv?.code || '',
      'Địa chỉ': s.address || '',
      NVQLT: s.managerName || '',
      SĐT: s.phone || '',
      'Số sector 5G': s.sector5G || '',
      'Vĩ độ': s.latitude || '',
      'Kinh độ': s.longitude || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    forceTextColumn(ws, 'SĐT', rows.length);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách trạm');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
