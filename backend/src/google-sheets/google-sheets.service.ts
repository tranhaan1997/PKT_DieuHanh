import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { WrittenTicketStatus, MaterialStatus, InstallStatus, PhotoStatus, PeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface WoPreviewItem {
  siteCode: string;
  solutionCode: string;
  solutionName?: string;
  ttkv?: string;
  district?: string;
  siteFound: boolean;
  solutionFound: boolean;
  alreadyExists: boolean;
}

export interface SheetPreview {
  periodCode: string;
  periodName: string;
  /** Solutions assigned to this period */
  periodSolutions: { code: string; name: string }[];
  /** Sheet solution columns that are NOT assigned to this period (ignored) */
  notInPeriod: string[];
  items: WoPreviewItem[];
  toCreate: number;
  alreadyExists: number;
  /** Site codes in sheet not found in system DB */
  siteNotFound: string[];
  /** Solution codes in sheet not found in system DB at all */
  solutionNotFound: string[];
  /** Mã trạm xuất hiện ở nhiều hơn 1 dòng trong Sheet (dữ liệu nhập trùng) */
  duplicateSites: string[];
  errors: string[];
}

export interface StatusSyncItem {
  siteCode: string;
  current: { writtenTicket: string; actReceivedMaterial: string; ttkvReceivedMaterial: string; siteReceivedMaterial: string };
  sheet: { writtenTicket: string; actReceivedMaterial: string; ttkvReceivedMaterial: string; siteReceivedMaterial: string };
  changed: boolean;
  /** Số dòng (1-indexed) của trạm này trên Sheet — ghi nhận lại để lần cập nhật tiến độ thi công sau không cần quét lại toàn bảng. */
  rowNumber: number;
}

export interface StatusSyncPreview {
  periodCode: string;
  solutionCode: string;
  items: StatusSyncItem[];
  toUpdate: number;
  unchanged: number;
  siteNotFound: string[];
  /** Mã trạm xuất hiện ở nhiều hơn 1 dòng trong Sheet (dữ liệu nhập trùng) */
  duplicateSites: string[];
  errors: string[];
}

interface ProgressFields {
  planDate?: string;
  executorName?: string;
  installationStatus?: InstallStatus;
  photoStatus?: PhotoStatus;
  integrationStatus?: InstallStatus;
  note?: string;
  issue?: string;
  completedDate?: string;
}

export interface ProgressSyncItem {
  siteCode: string;
  current: ProgressFields;
  sheet: ProgressFields;
  changed: boolean;
  rowNumber: number;
}

export interface ProgressSyncPreview {
  periodCode: string;
  solutionCode: string;
  items: ProgressSyncItem[];
  toUpdate: number;
  unchanged: number;
  siteNotFound: string[];
  errors: string[];
}

const INSTALL_LABEL_SHEET: Record<string, string> = {
  NOT_STARTED: '', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', CANCELLED: 'Hủy',
};
const PHOTO_LABEL_SHEET: Record<string, string> = { NOT_TAKEN: '', TAKEN: 'Đã chụp' };

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async getServiceAccountJson(): Promise<string> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'googleServiceAccountJson' },
    });
    const json =
      row?.value || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
    if (!json)
      throw new ServiceUnavailableException(
        'Service Account JSON chưa được cấu hình',
      );
    return json;
  }

  private async getAuth() {
    const json = await this.getServiceAccountJson();
    const credentials = JSON.parse(json);
    return new google.auth.GoogleAuth({
      credentials,
      // Full scope (not readonly) — cần ghi ngược tiến độ thi công lên Sheet
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  private async getPeriodSheetConfig(periodCode: string): Promise<{ sheetId: string; tab: string }> {
    const period = await this.prisma.period.findFirst({
      where: { OR: [
        { periodCode: { equals: periodCode, mode: 'insensitive' } },
        { periodName: { equals: periodCode, mode: 'insensitive' } },
      ]},
      select: { googleSheetId: true, googleSheetTab: true },
    });
    const sheetId = period?.googleSheetId || '';
    const tab = period?.googleSheetTab || 'Sheet1';
    if (!sheetId)
      throw new ServiceUnavailableException(
        `Kỳ "${periodCode}" chưa được cấu hình Google Sheet ID`,
      );
    return { sheetId, tab };
  }

  async getStatus() {
    const auth = await this.getAuth();
    return { ok: true, message: 'Service Account đã được cấu hình' };
  }

  // ── Parse sheet ──────────────────────────────────────────────────────────
  // Sheet format:
  //   Row 1+: merged headers / labels (variable)
  //   Row with "Mã trạm" + "Mã kỳ" → site/period column index
  //   Row with solution codes (e.g. CVT01, IACV01) → solution column indices
  //   Data rows: STT numeric, siteCode, periodCode, 0/1 per solution
  private async fetchRows(periodCode: string): Promise<string[][]> {
    const { sheetId, tab } = await this.getPeriodSheetConfig(periodCode);
    return this.fetchTabRows(sheetId, tab);
  }

  /** Nếu `tab` là số → coi là gid, resolve sang tên sheet thật (cần cho mọi range API call). */
  private async resolveTabName(sheetId: string, tab: string, sheets: any): Promise<string> {
    if (!/^\d+$/.test(tab.trim())) return tab;
    const gid = parseInt(tab.trim());
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties' });
    const found = (meta.data.sheets || []).find((s) => s.properties?.sheetId === gid);
    if (!found) throw new BadGatewayException(`Không tìm thấy tab với gid=${gid}`);
    return found.properties!.title!;
  }

  private async fetchTabRows(sheetId: string, tab: string): Promise<string[][]> {
    const auth = await this.getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    try {
      const rangeName = await this.resolveTabName(sheetId, tab, sheets);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: rangeName,
      });
      return (res.data.values || []) as string[][];
    } catch (err: any) {
      if (err instanceof BadGatewayException) throw err;
      const msg = err?.cause?.message || err?.message || 'Lỗi không xác định từ Google API';
      throw new BadGatewayException(msg);
    }
  }

  private parseSheetStructure(
    allRows: string[][],
    overrides?: {
      siteCol?: number;
      dataStartRow?: number;
      solutions?: { col: number; code: string }[];
    },
  ): {
    siteCol: number;
    periodCol: number;
    ttkvCol: number;
    districtCol: number;
    solutions: { col: number; code: string }[];
    dataStartRow: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let siteCol = overrides?.siteCol ?? -1;
    let periodCol = -1,
      ttkvCol = -1,
      districtCol = -1;
    let solutions: { col: number; code: string }[] = overrides?.solutions ?? [];
    let headerRow = -1;

    for (let r = 0; r < Math.min(allRows.length, 10); r++) {
      const row = allRows[r];
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] || '').toString().trim();
        const low = cell.toLowerCase();
        if (overrides?.siteCol === undefined && /^mã\s*trạm$|^ma\s*tram$|^sitecode$/i.test(cell)) {
          siteCol = c;
          headerRow = r;
        } else if (overrides?.siteCol !== undefined && headerRow === -1 && /^mã\s*trạm$|^ma\s*tram$/i.test(cell)) {
          headerRow = r;
        }
        if (/^mã\s*kỳ$|^ma\s*ky$|^periodcode$|^mã kỳ$/i.test(cell))
          periodCol = c;
        if (/^ttkv$/i.test(cell)) ttkvCol = c;
        if (/^quận.huyện$|^quan.huyen$|^district$/i.test(low)) districtCol = c;
      }
      // Find solution codes row: cells matching e.g. CVT01, IACV01, DAQ01
      if (!overrides?.solutions) {
        const potentialSols = row
          .map((cell, idx) => ({ code: (cell || '').toString().trim(), idx }))
          .filter(({ code }) => /^[A-Z]{2,6}\d{2,3}$/.test(code));
        if (potentialSols.length >= 2) {
          solutions = potentialSols.map(({ code, idx }) => ({ col: idx, code }));
        }
      }
    }

    if (siteCol === -1)
      errors.push('Không tìm thấy cột "Mã trạm" — vào "Sửa thông tin kỳ" để cấu hình cột Mã trạm, hoặc đảm bảo sheet có header "Mã trạm" trong 10 hàng đầu');
    if (solutions.length === 0)
      errors.push(
        'Chưa cấu hình cột giải pháp nào — vào "Giải pháp đã gán" để gán cột tương ứng trên Sheet cho từng giải pháp, hoặc đảm bảo sheet có cột mã giải pháp (vd: CVT01) trong 10 hàng đầu',
      );

    // Data starts after the headerRow — first row where site column has a non-empty value
    // that is NOT itself a header label
    let dataStartRow = overrides?.dataStartRow ?? headerRow + 1;
    if (overrides?.dataStartRow === undefined && siteCol !== -1) {
      for (let r = headerRow + 1; r < allRows.length; r++) {
        const siteVal = (allRows[r][siteCol] || '').toString().trim();
        if (siteVal && !/^mã|^ma |^site/i.test(siteVal)) {
          dataStartRow = r;
          break;
        }
      }
    }

    return {
      siteCol,
      periodCol,
      ttkvCol,
      districtCol,
      solutions,
      dataStartRow,
      errors,
    };
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  async previewWorkOrders(periodCode: string): Promise<SheetPreview> {
    const emptyResult = (extra: Partial<SheetPreview> = {}): SheetPreview => ({
      periodCode,
      periodName: '',
      periodSolutions: [],
      notInPeriod: [],
      items: [],
      toCreate: 0,
      alreadyExists: 0,
      siteNotFound: [],
      solutionNotFound: [],
      duplicateSites: [],
      errors: [],
      ...extra,
    });

    // Load period with its assigned solutions (ordered) — needed first to
    // resolve explicit Sheet column config (Mã trạm / Dòng bắt đầu / cột giải pháp)
    const period = await this.prisma.period.findFirst({
      where: {
        OR: [
          { periodCode: { equals: periodCode, mode: 'insensitive' } },
          { periodName: { equals: periodCode, mode: 'insensitive' } },
        ],
      },
      include: {
        periodSolutions: {
          orderBy: { order: 'asc' },
          include: { solution: { select: { id: true, solutionCode: true, solutionName: true } } },
        },
      },
    });
    if (!period)
      return emptyResult({
        errors: [`Không tìm thấy kỳ thực hiện "${periodCode}" trong hệ thống`],
      });

    const allRows = await this.fetchRows(periodCode);

    const genColSolutions = period.periodSolutions
      .filter((ps) => ps.genCol)
      .map((ps) => ({ col: this.colLetterToIndex(ps.genCol!), code: ps.solution.solutionCode }));

    const {
      siteCol,
      periodCol,
      solutions,
      dataStartRow,
      errors: parseErrors,
    } = this.parseSheetStructure(allRows, {
      siteCol: period.googleSheetSiteCol ? this.colLetterToIndex(period.googleSheetSiteCol) : undefined,
      dataStartRow: period.googleSheetStartRow ? period.googleSheetStartRow - 1 : undefined,
      solutions: genColSolutions.length ? genColSolutions : undefined,
    });

    if (parseErrors.length > 0)
      return emptyResult({ periodName: period.periodName, errors: parseErrors });

    // Map: solutionCode (lower) → solutionId — ONLY period-assigned solutions
    const periodSolMap = new Map(
      period.periodSolutions.map((ps) => [
        ps.solution.solutionCode.toLowerCase(),
        ps.solution.id,
      ]),
    );
    const periodSolNameMap = new Map(
      period.periodSolutions.map((ps) => [
        ps.solution.solutionCode.toLowerCase(),
        ps.solution.solutionName,
      ]),
    );
    const periodSolCodes = period.periodSolutions.map((ps) => ({
      code: ps.solution.solutionCode,
      name: ps.solution.solutionName,
    }));

    // All solutions in DB (to distinguish "not in period" vs "not in system")
    const allSolutionsInDB = await this.prisma.solution.findMany({
      select: { solutionCode: true },
    });
    const allSolCodesInDB = new Set(
      allSolutionsInDB.map((s) => s.solutionCode.toLowerCase()),
    );

    // Sites
    const allSites = await this.prisma.site.findMany({
      select: { id: true, siteCode: true },
    });
    const siteMap = new Map(
      allSites.map((s) => [s.siteCode.toLowerCase(), s.id]),
    );

    // Existing WOs for this period
    const existingWOs = await this.prisma.workOrder.findMany({
      where: { periodId: period.id },
      select: { siteId: true, solutionId: true },
    });
    const existingSet = new Set(
      existingWOs.map((wo) => `${wo.siteId}:${wo.solutionId}`),
    );

    // Determine which sheet solution columns are "not in period" vs "not in system at all"
    const notInPeriodSet = new Set<string>();
    const solutionNotFoundSet = new Set<string>();

    for (const { code } of solutions) {
      const lower = code.toLowerCase();
      if (!periodSolMap.has(lower)) {
        if (allSolCodesInDB.has(lower)) {
          notInPeriodSet.add(code); // exists in system but not assigned to this period
        } else {
          solutionNotFoundSet.add(code); // doesn't exist in system at all
        }
      }
    }

    const items: WoPreviewItem[] = [];
    const siteNotFoundSet = new Set<string>();
    const siteRowCount = new Map<string, { count: number; display: string }>();

    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r];
      const siteCode = (row[siteCol] || '').toString().trim();

      if (!siteCode) continue;
      // Cột "Mã kỳ" không còn bắt buộc — tab Sheet đã được chỉ định riêng
      // cho kỳ này trong cấu hình, nên không cần lọc dòng theo periodCode nữa.
      if (periodCol !== -1) {
        const rowPeriod = (row[periodCol] || '').toString().trim();
        if (rowPeriod.toLowerCase() !== periodCode.toLowerCase()) continue;
      }

      const siteKey = siteCode.toLowerCase();
      const cur = siteRowCount.get(siteKey);
      siteRowCount.set(siteKey, { count: (cur?.count ?? 0) + 1, display: cur?.display ?? siteCode });

      const siteId = siteMap.get(siteCode.toLowerCase());
      if (!siteId) {
        siteNotFoundSet.add(siteCode);
      }

      // Only process solutions that ARE assigned to this period
      for (const { col, code: solutionCode } of solutions) {
        if (!periodSolMap.has(solutionCode.toLowerCase())) continue; // skip non-period solutions

        const val = (row[col] || '').toString().trim();
        if (val !== '1') continue;

        const solutionId = periodSolMap.get(solutionCode.toLowerCase())!;
        const siteFound = siteId !== undefined;
        const alreadyExists = siteFound
          ? existingSet.has(`${siteId}:${solutionId}`)
          : false;

        if (!siteFound) siteNotFoundSet.add(siteCode);

        items.push({
          siteCode,
          solutionCode,
          solutionName: periodSolNameMap.get(solutionCode.toLowerCase()),
          siteFound,
          solutionFound: true,
          alreadyExists,
        });
      }
    }

    const toCreate = items.filter(
      (i) => i.siteFound && !i.alreadyExists,
    ).length;
    const alreadyExists = items.filter((i) => i.alreadyExists).length;
    const duplicateSites = [...siteRowCount.values()]
      .filter((v) => v.count > 1)
      .map((v) => v.display);

    return {
      periodCode,
      periodName: period.periodName,
      periodSolutions: periodSolCodes,
      notInPeriod: [...notInPeriodSet],
      items,
      toCreate,
      alreadyExists,
      siteNotFound: [...siteNotFoundSet],
      solutionNotFound: [...solutionNotFoundSet],
      duplicateSites,
      errors: [],
    };
  }

  // ── Confirm import ───────────────────────────────────────────────────────
  async importWorkOrders(
    periodCode: string,
    createdById: number,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const preview = await this.previewWorkOrders(periodCode);
    if (preview.errors.length > 0)
      return { created: 0, skipped: 0, errors: preview.errors };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = `SHEET_${periodCode}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    const period = await this.prisma.period.findFirst({
      where: { periodCode: { equals: periodCode, mode: 'insensitive' } },
    });
    if (!period)
      return {
        created: 0,
        skipped: 0,
        errors: [`Không tìm thấy kỳ "${periodCode}"`],
      };
    if (period.status === PeriodStatus.CLOSED)
      return { created: 0, skipped: 0, errors: ['Kỳ đã đóng — không thể sinh phiếu từ Sheet'] };

    // Use period-assigned solutions only (same as preview)
    const periodSolutions = await this.prisma.periodSolution.findMany({
      where: { periodId: period.id },
      include: { solution: { select: { id: true, solutionCode: true } } },
    });
    const solutionMap = new Map(
      periodSolutions.map((ps) => [
        ps.solution.solutionCode.toLowerCase(),
        ps.solution.id,
      ]),
    );

    const allSites = await this.prisma.site.findMany({
      select: { id: true, siteCode: true },
    });
    const siteMap = new Map(
      allSites.map((s) => [s.siteCode.toLowerCase(), s.id]),
    );

    const existing = await this.prisma.workOrder.findMany({
      where: { periodId: period.id },
      select: { siteId: true, solutionId: true },
    });
    const existingSet = new Set(
      existing.map((wo) => `${wo.siteId}:${wo.solutionId}`),
    );

    const toCreate = preview.items.filter(
      (i) => i.siteFound && i.solutionFound && !i.alreadyExists,
    );

    let created = 0;
    for (const item of toCreate) {
      const siteId = siteMap.get(item.siteCode.toLowerCase())!;
      const solutionId = solutionMap.get(item.solutionCode.toLowerCase())!;
      const key = `${siteId}:${solutionId}`;
      if (existingSet.has(key)) continue;

      const seq =
        (await this.prisma.workOrder.count({
          where: { periodId: period.id },
        })) + 1;
      await this.prisma.workOrder.create({
        data: {
          ticketNo: `${period.periodCode}-${String(seq).padStart(4, '0')}`,
          periodId: period.id,
          siteId,
          solutionId,
          createdById,
          label,
        },
      });
      existingSet.add(key);
      created++;
    }

    return { created, skipped: preview.alreadyExists, errors: [] };
  }

  // ── Status sync (viết phiếu / nhận vật tư / chuyển TTKV) ──────────────────
  /** Chuyển chữ cột Sheet (A, B, ..., Z, AA, AB...) sang chỉ số mảng 0-based */
  private colLetterToIndex(letter: string): number {
    const s = letter.trim().toUpperCase();
    let idx = 0;
    for (let i = 0; i < s.length; i++) {
      idx = idx * 26 + (s.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  private mapWrittenStatus(cell: string): WrittenTicketStatus {
    return cell.toString().trim() ? WrittenTicketStatus.WRITTEN : WrittenTicketStatus.EMPTY;
  }

  private mapMaterialStatus(cell: string): MaterialStatus {
    const v = cell.toString().trim().toLowerCase();
    if (!v) return MaterialStatus.EMPTY;
    if (v.includes('chuyển')) return MaterialStatus.TRANSFERRED;
    if (v.includes('nhận')) return MaterialStatus.RECEIVED;
    return MaterialStatus.EMPTY;
  }

  // ── Đồng bộ tiến độ thi công (Kế hoạch / NS thực hiện / Lắp đặt / Chụp hình / Tích hợp / Ghi chú / Vướng) ──
  private mapInstallStatus(cell: string): InstallStatus {
    const v = cell.toString().trim().toLowerCase();
    if (!v) return InstallStatus.NOT_STARTED;
    if (v.includes('hủy') || v.includes('huỷ')) return InstallStatus.CANCELLED;
    if (v.includes('hoàn thành')) return InstallStatus.COMPLETED;
    return InstallStatus.IN_PROGRESS;
  }

  private mapPhotoStatus(cell: string): PhotoStatus {
    return cell.toString().trim() ? PhotoStatus.TAKEN : PhotoStatus.NOT_TAKEN;
  }

  /**
   * Đọc ngày dạng dd/mm/yyyy (hoặc Sheet serial number) từ ô Sheet, trả về Date
   * hoặc null. Luôn quy về 00:00 giờ Việt Nam (UTC+7) — đối xứng với
   * fmtDateForSheet — không dùng local time của server.
   */
  private parseSheetDate(cell: string): Date | null {
    const v = cell.toString().trim();
    if (!v) return null;
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)) - 7 * 60 * 60 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    const num = Number(v);
    if (!isNaN(num) && num > 0) {
      // Google Sheets serial date: ngày 0 = 30/12/1899
      return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
    }
    return null;
  }

  async previewStatusSync(periodCode: string, solutionId: number): Promise<StatusSyncPreview> {
    const empty = (extra: Partial<StatusSyncPreview> = {}): StatusSyncPreview => ({
      periodCode,
      solutionCode: '',
      items: [],
      toUpdate: 0,
      unchanged: 0,
      siteNotFound: [],
      duplicateSites: [],
      errors: [],
      ...extra,
    });

    const period = await this.prisma.period.findFirst({
      where: {
        OR: [
          { periodCode: { equals: periodCode, mode: 'insensitive' } },
          { periodName: { equals: periodCode, mode: 'insensitive' } },
        ],
      },
    });
    if (!period) return empty({ errors: [`Không tìm thấy kỳ thực hiện "${periodCode}"`] });
    if (period.status === PeriodStatus.CLOSED)
      return empty({ errors: [`Kỳ "${periodCode}" đã đóng — không thể đồng bộ trạng thái`] });
    if (!period.googleSheetId)
      return empty({ errors: [`Kỳ "${periodCode}" chưa cấu hình Google Sheet ID`] });

    const periodSolution = await this.prisma.periodSolution.findUnique({
      where: { periodId_solutionId: { periodId: period.id, solutionId } },
      include: { solution: { select: { solutionCode: true } } },
    });
    if (!periodSolution)
      return empty({ errors: ['Giải pháp chưa được gán vào kỳ này'] });

    const missing: string[] = [];
    if (!periodSolution.sheetTab) missing.push('tab Sheet');
    if (!periodSolution.sheetSiteCol) missing.push('cột Mã trạm');
    if (!periodSolution.sheetWrittenCol) missing.push('cột Viết phiếu');
    if (!periodSolution.sheetActCol) missing.push('cột ACT nhận VT');
    if (!periodSolution.sheetTtkvCol) missing.push('cột TTKV nhận VT');
    if (missing.length)
      return empty({
        solutionCode: periodSolution.solution.solutionCode,
        errors: [`Giải pháp "${periodSolution.solution.solutionCode}" chưa cấu hình đủ: ${missing.join(', ')}`],
      });

    const allRows = await this.fetchTabRows(period.googleSheetId, periodSolution.sheetTab!);
    const siteCol = this.colLetterToIndex(periodSolution.sheetSiteCol!);
    const writtenCol = this.colLetterToIndex(periodSolution.sheetWrittenCol!);
    const actReceivedCol = this.colLetterToIndex(periodSolution.sheetActCol!);
    const ttkvCol = this.colLetterToIndex(periodSolution.sheetTtkvCol!);
    const siteRecvCol = periodSolution.sheetSiteRecvCol ? this.colLetterToIndex(periodSolution.sheetSiteRecvCol) : null;
    const dataStartRow = Math.max(0, (periodSolution.sheetStartRow ?? 1) - 1);

    const allSites = await this.prisma.site.findMany({ select: { id: true, siteCode: true } });
    const siteMap = new Map(allSites.map((s) => [s.siteCode.toLowerCase(), s.id]));

    const workOrders = await this.prisma.workOrder.findMany({
      where: { periodId: period.id, solutionId },
      select: {
        id: true,
        siteId: true,
        writtenTicket: true,
        actReceivedMaterial: true,
        ttkvReceivedMaterial: true,
        siteReceivedMaterial: true,
      },
    });
    const woBySite = new Map(workOrders.map((w) => [w.siteId, w]));

    const items: StatusSyncItem[] = [];
    const siteNotFoundSet = new Set<string>();
    const siteRowCount = new Map<string, { count: number; display: string }>();

    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r];
      const siteCode = (row[siteCol] || '').toString().trim();
      if (!siteCode) continue;

      const siteKey = siteCode.toLowerCase();
      const cur = siteRowCount.get(siteKey);
      siteRowCount.set(siteKey, { count: (cur?.count ?? 0) + 1, display: cur?.display ?? siteCode });

      const siteId = siteMap.get(siteCode.toLowerCase());
      const wo = siteId !== undefined ? woBySite.get(siteId) : undefined;
      if (!wo) { siteNotFoundSet.add(siteCode); continue; }

      const sheetWritten = this.mapWrittenStatus(row[writtenCol] || '');
      const sheetAct = this.mapMaterialStatus(row[actReceivedCol] || '');
      const sheetTtkv = this.mapMaterialStatus(row[ttkvCol] || '');
      const sheetSiteRecv = siteRecvCol !== null ? this.mapMaterialStatus(row[siteRecvCol] || '') : wo.siteReceivedMaterial;

      const changed =
        sheetWritten !== wo.writtenTicket ||
        sheetAct !== wo.actReceivedMaterial ||
        sheetTtkv !== wo.ttkvReceivedMaterial ||
        sheetSiteRecv !== wo.siteReceivedMaterial;

      items.push({
        siteCode,
        current: {
          writtenTicket: wo.writtenTicket,
          actReceivedMaterial: wo.actReceivedMaterial,
          ttkvReceivedMaterial: wo.ttkvReceivedMaterial,
          siteReceivedMaterial: wo.siteReceivedMaterial,
        },
        sheet: {
          writtenTicket: sheetWritten,
          actReceivedMaterial: sheetAct,
          ttkvReceivedMaterial: sheetTtkv,
          siteReceivedMaterial: sheetSiteRecv,
        },
        changed,
        rowNumber: r + 1,
      });
    }

    const duplicateSites = [...siteRowCount.values()]
      .filter((v) => v.count > 1)
      .map((v) => v.display);

    return {
      periodCode,
      solutionCode: periodSolution.solution.solutionCode,
      items,
      toUpdate: items.filter((i) => i.changed).length,
      unchanged: items.filter((i) => !i.changed).length,
      siteNotFound: [...siteNotFoundSet],
      duplicateSites,
      errors: [],
    };
  }

  async syncStatuses(
    periodCode: string,
    solutionId: number,
    userId: number | null,
  ): Promise<{
    updated: number;
    errors: string[];
    updatedItems: Array<{
      ticketNo: string;
      siteCode: string;
      siteName: string;
      changes: Record<string, { from: string; to: string }>;
    }>;
  }> {
    const preview = await this.previewStatusSync(periodCode, solutionId);
    if (preview.errors.length) return { updated: 0, errors: preview.errors, updatedItems: [] };

    const period = await this.prisma.period.findFirst({
      where: { periodCode: { equals: periodCode, mode: 'insensitive' } },
    });
    if (!period) return { updated: 0, errors: [`Không tìm thấy kỳ "${periodCode}"`], updatedItems: [] };

    const allSites = await this.prisma.site.findMany({ select: { id: true, siteCode: true, siteName: true } });
    const siteMap = new Map(allSites.map((s) => [s.siteCode.toLowerCase(), s.id]));
    const siteNameMap = new Map(allSites.map((s) => [s.id, s.siteName]));

    const solution = await this.prisma.solution.findUnique({
      where: { id: solutionId },
      select: { solutionName: true },
    });

    // Actor để gắn vào thông báo — null (auto-sync) coi như thao tác của "office" (SUPERVISOR)
    // để vẫn kích hoạt thông báo TICKET_READY cho kỹ thuật khi viết phiếu hoàn thành.
    let actorName = 'Hệ thống (tự động đồng bộ)';
    let actorRole: string = 'SUPERVISOR';
    if (userId !== null) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, username: true, role: true },
      });
      if (actor) {
        actorName = actor.fullName || actor.username;
        actorRole = actor.role;
      }
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: { periodId: period.id, solutionId },
    });
    const woBySite = new Map(workOrders.map((w) => [w.siteId, w]));

    let updated = 0;
    const updatedItems: Array<{
      ticketNo: string;
      siteCode: string;
      siteName: string;
      changes: Record<string, { from: string; to: string }>;
    }> = [];
    for (const item of preview.items) {
      const siteId = siteMap.get(item.siteCode.toLowerCase());
      if (siteId === undefined) continue;
      const wo = woBySite.get(siteId);
      if (!wo) continue;

      // Luôn ghi nhận lại số dòng của trạm trên Sheet — để lần cập nhật tiến
      // độ thi công sau (pushProgressToSheet) không cần quét lại toàn bảng.
      if (!item.changed) {
        if (wo.sheetRow !== item.rowNumber) {
          await this.prisma.workOrder.update({
            where: { id: wo.id },
            data: { sheetRow: item.rowNumber },
          });
        }
        continue;
      }

      const changes: Record<string, { from: string; to: string }> = {};
      if (item.sheet.writtenTicket !== item.current.writtenTicket)
        changes.writtenTicket = { from: item.current.writtenTicket, to: item.sheet.writtenTicket };
      if (item.sheet.actReceivedMaterial !== item.current.actReceivedMaterial)
        changes.actReceivedMaterial = { from: item.current.actReceivedMaterial, to: item.sheet.actReceivedMaterial };
      if (item.sheet.ttkvReceivedMaterial !== item.current.ttkvReceivedMaterial)
        changes.ttkvReceivedMaterial = { from: item.current.ttkvReceivedMaterial, to: item.sheet.ttkvReceivedMaterial };
      if (item.sheet.siteReceivedMaterial !== item.current.siteReceivedMaterial)
        changes.siteReceivedMaterial = { from: item.current.siteReceivedMaterial, to: item.sheet.siteReceivedMaterial };

      await this.prisma.workOrder.update({
        where: { id: wo.id },
        data: {
          writtenTicket: item.sheet.writtenTicket as WrittenTicketStatus,
          actReceivedMaterial: item.sheet.actReceivedMaterial as MaterialStatus,
          ttkvReceivedMaterial: item.sheet.ttkvReceivedMaterial as MaterialStatus,
          siteReceivedMaterial: item.sheet.siteReceivedMaterial as MaterialStatus,
          sheetRow: item.rowNumber,
          officeUpdatedById: userId,
          officeUpdatedAt: new Date(),
        },
      });
      // userId null = chạy tự động (không có actor cụ thể) — không ghi WorkOrderLog
      // (vốn yêu cầu userId NOT NULL), audit ở cấp độ lượt chạy nằm trong AutoSyncRun.
      if (Object.keys(changes).length && userId !== null) {
        await this.prisma.workOrderLog.create({ data: { workOrderId: wo.id, userId, changes } });
      }
      if (Object.keys(changes).length) {
        this.notifications
          .createFromWoUpdate(
            wo.id,
            wo.ticketNo,
            item.siteCode,
            siteNameMap.get(wo.siteId) || item.siteCode,
            solution?.solutionName || '',
            userId,
            actorName,
            actorRole,
            changes,
          )
          .catch(() => {
            /* fire-and-forget — không chặn luồng đồng bộ nếu tạo thông báo lỗi */
          });
      }
      updatedItems.push({
        ticketNo: wo.ticketNo,
        siteCode: item.siteCode,
        siteName: siteNameMap.get(wo.siteId) || item.siteCode,
        changes,
      });
      updated++;
    }

    return { updated, errors: [], updatedItems };
  }

  // ── Ghi ngược tiến độ thi công lên Google Sheet ───────────────────────────
  private colIndexToLetter(idx: number): string {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /**
   * Format ngày theo giờ Việt Nam (UTC+7) cố định — không dùng local time của
   * server, vì container production có thể chạy TZ=UTC. Nếu dùng local time,
   * completedDate set bằng `new Date()` lúc 00:00–06:59 giờ VN sẽ bị ghi lùi
   * 1 ngày lên Sheet (UTC ngày trước đó).
   */
  private fmtDateForSheet(d: Date | null): string {
    if (!d) return '';
    const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
  }

  /**
   * Xác định số dòng (1-indexed, theo Sheets API) chứa siteCode, bằng cách CHỈ
   * đọc đúng 1 cột Mã trạm (range hẹp) thay vì tải toàn bộ bảng — dùng chung
   * cho cả đồng bộ trạng thái (đọc) và ghi ngược tiến độ thi công (viết).
   */
  private async findSiteRowNumber(
    sheetId: string,
    tab: string,
    siteCol: number,
    dataStartRow: number,
    siteCode: string,
  ): Promise<number> {
    const auth = await this.getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const tabName = await this.resolveTabName(sheetId, tab, sheets);
    const colLetter = this.colIndexToLetter(siteCol);
    const startRowNumber = dataStartRow + 1; // Sheets API 1-indexed
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!${colLetter}${startRowNumber}:${colLetter}`,
    });
    const col = (res.data.values || []).map((r) => (r[0] || '').toString().trim().toLowerCase());
    const offset = col.findIndex((v) => v === siteCode.toLowerCase());
    return offset === -1 ? -1 : startRowNumber + offset;
  }

  /** Đọc 1 cell Mã trạm tại đúng rowNumber đã cache — dùng để xác minh cache còn đúng trước khi ghi ngược. */
  private async readSiteCodeAtRow(
    sheetId: string,
    tab: string,
    siteCol: number,
    rowNumber: number,
  ): Promise<string> {
    const auth = await this.getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const tabName = await this.resolveTabName(sheetId, tab, sheets);
    const colLetter = this.colIndexToLetter(siteCol);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!${colLetter}${rowNumber}`,
    });
    return (res.data.values?.[0]?.[0] || '').toString().trim().toLowerCase();
  }

  /**
   * Gọi sau khi WorkOrder được cập nhật (kỹ thuật cập nhật tiến độ thi công)
   * hoặc gọi thủ công để đồng bộ lại. Không throw ra ngoài — luôn trả về kết
   * quả và LƯU LẠI trạng thái đồng bộ (sheetSyncedAt/sheetSyncError) vào WO
   * để người dùng có thể xem lỗi và đồng bộ lại.
   */
  async pushProgressToSheet(workOrderId: number): Promise<{ success: boolean; error?: string }> {
    const fail = async (error: string) => {
      this.logger.warn(`pushProgressToSheet failed for WO ${workOrderId}: ${error}`);
      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { sheetSyncError: error.slice(0, 500) },
      }).catch(() => {});
      return { success: false, error };
    };

    try {
      const writeBackConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'sheetWriteBackEnabled' },
      });
      const writeBackEnabled = writeBackConfig ? writeBackConfig.value === 'true' : true;
      if (!writeBackEnabled) {
        return { success: false, error: 'Đồng bộ ngược lên Google Sheet đang bị tắt trong Cài đặt hệ thống' };
      }

      const wo = await this.prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: { site: { select: { siteCode: true } } },
      });
      if (!wo) return fail('Không tìm thấy Work Order');

      const period = await this.prisma.period.findUnique({
        where: { id: wo.periodId },
        select: { googleSheetId: true, status: true },
      });
      if (period?.status === PeriodStatus.CLOSED)
        return fail('Kỳ đã đóng — không thể đồng bộ ngược lên Sheet');
      if (!period?.googleSheetId) return fail('Kỳ chưa cấu hình Google Sheet ID');

      const periodSolution = await this.prisma.periodSolution.findUnique({
        where: { periodId_solutionId: { periodId: wo.periodId, solutionId: wo.solutionId } },
      });
      if (!periodSolution?.sheetTab || !periodSolution.sheetSiteCol) {
        return fail('Giải pháp chưa cấu hình tab Sheet / cột Mã trạm');
      }

      const fieldCols: Array<{ col: string | null; value: string }> = [
        { col: periodSolution.sheetPlanDateCol, value: this.fmtDateForSheet(wo.planDate) },
        { col: periodSolution.sheetExecutorCol, value: wo.executorName || '' },
        { col: periodSolution.sheetInstallCol, value: INSTALL_LABEL_SHEET[wo.installationStatus] ?? '' },
        { col: periodSolution.sheetPhotoCol, value: PHOTO_LABEL_SHEET[wo.photoStatus] ?? '' },
        { col: periodSolution.sheetIntegrationCol, value: INSTALL_LABEL_SHEET[wo.integrationStatus] ?? '' },
        { col: periodSolution.sheetNoteCol, value: wo.note || '' },
        { col: periodSolution.sheetIssueCol, value: wo.issue || '' },
        { col: periodSolution.sheetCompletedDateCol, value: this.fmtDateForSheet(wo.completedDate) },
      ];
      const configured = fieldCols.filter((f) => f.col);
      if (!configured.length) {
        return fail('Giải pháp chưa cấu hình cột Sheet nào cho tiến độ thi công');
      }

      const siteCol = this.colLetterToIndex(periodSolution.sheetSiteCol);
      const dataStartRow = Math.max(0, (periodSolution.sheetStartRow ?? 1) - 1);
      const expectedSiteCode = wo.site.siteCode.toLowerCase();

      // Ưu tiên dùng số dòng đã ghi nhận từ lần đồng bộ trước — nhưng LUÔN xác
      // minh lại đúng Mã trạm tại dòng đó trước khi ghi, vì Sheet có thể đã bị
      // chèn/xoá dòng từ lần đồng bộ trước, khiến cache trỏ sai chỗ.
      let rowNumber = wo.sheetRow ?? -1;
      if (rowNumber !== -1) {
        const actualSiteCode = await this.readSiteCodeAtRow(
          period.googleSheetId,
          periodSolution.sheetTab,
          siteCol,
          rowNumber,
        );
        if (actualSiteCode !== expectedSiteCode) rowNumber = -1;
      }
      if (rowNumber === -1) {
        rowNumber = await this.findSiteRowNumber(
          period.googleSheetId,
          periodSolution.sheetTab,
          siteCol,
          dataStartRow,
          wo.site.siteCode,
        );
        if (rowNumber === -1) return fail(`Không tìm thấy trạm "${wo.site.siteCode}" trong Sheet`);
        await this.prisma.workOrder.update({ where: { id: wo.id }, data: { sheetRow: rowNumber } });
      }

      const auth = await this.getAuth();
      const sheets = google.sheets({ version: 'v4', auth });
      const tabName = await this.resolveTabName(period.googleSheetId, periodSolution.sheetTab, sheets);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: period.googleSheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: configured.map((f) => ({
            range: `${tabName}!${f.col}${rowNumber}`,
            values: [[f.value]],
          })),
        },
      });

      await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: { sheetSyncedAt: new Date(), sheetSyncError: null },
      });
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Lỗi không xác định';
      return fail(msg);
    }
  }

  // ── Đồng bộ tiến độ thi công ĐÃ CÓ trên Sheet VỀ hệ thống (1 lần, dữ liệu lịch sử) ──
  async previewProgressSync(periodCode: string, solutionId: number): Promise<ProgressSyncPreview> {
    const empty = (extra: Partial<ProgressSyncPreview> = {}): ProgressSyncPreview => ({
      periodCode, solutionCode: '', items: [], toUpdate: 0, unchanged: 0, siteNotFound: [], errors: [],
      ...extra,
    });

    const period = await this.prisma.period.findFirst({
      where: { periodCode: { equals: periodCode, mode: 'insensitive' } },
    });
    if (!period) return empty({ errors: [`Không tìm thấy kỳ "${periodCode}"`] });
    if (period.status === PeriodStatus.CLOSED)
      return empty({ errors: [`Kỳ "${periodCode}" đã đóng — không thể đồng bộ tiến độ thi công`] });
    if (!period.googleSheetId) return empty({ errors: [`Kỳ "${periodCode}" chưa cấu hình Google Sheet ID`] });

    const periodSolution = await this.prisma.periodSolution.findUnique({
      where: { periodId_solutionId: { periodId: period.id, solutionId } },
      include: { solution: { select: { solutionCode: true } } },
    });
    if (!periodSolution) return empty({ errors: ['Giải pháp chưa được gán vào kỳ này'] });
    if (!periodSolution.sheetTab || !periodSolution.sheetSiteCol) {
      return empty({
        solutionCode: periodSolution.solution.solutionCode,
        errors: [`Giải pháp "${periodSolution.solution.solutionCode}" chưa cấu hình tab Sheet / cột Mã trạm`],
      });
    }
    const fieldColDefs = this.progressFieldCols(periodSolution);
    if (!fieldColDefs.length) {
      return empty({
        solutionCode: periodSolution.solution.solutionCode,
        errors: [`Giải pháp "${periodSolution.solution.solutionCode}" chưa cấu hình cột Sheet nào cho tiến độ thi công`],
      });
    }

    const allRows = await this.fetchTabRows(period.googleSheetId, periodSolution.sheetTab);
    const siteCol = this.colLetterToIndex(periodSolution.sheetSiteCol);
    const dataStartRow = Math.max(0, (periodSolution.sheetStartRow ?? 1) - 1);

    const allSites = await this.prisma.site.findMany({ select: { id: true, siteCode: true } });
    const siteMap = new Map(allSites.map((s) => [s.siteCode.toLowerCase(), s.id]));

    const workOrders = await this.prisma.workOrder.findMany({
      where: { periodId: period.id, solutionId },
      select: {
        id: true, siteId: true, planDate: true, executorName: true,
        installationStatus: true, photoStatus: true, integrationStatus: true, note: true, issue: true,
        completedDate: true,
      },
    });
    const woBySite = new Map(workOrders.map((w) => [w.siteId, w]));

    const items: ProgressSyncItem[] = [];
    const siteNotFoundSet = new Set<string>();

    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r];
      const siteCode = (row[siteCol] || '').toString().trim();
      if (!siteCode) continue;
      const siteId = siteMap.get(siteCode.toLowerCase());
      const wo = siteId !== undefined ? woBySite.get(siteId) : undefined;
      if (!wo) { siteNotFoundSet.add(siteCode); continue; }

      const sheet = this.readProgressFromRow(row, fieldColDefs);
      const current = {
        planDate: this.fmtDateForSheet(wo.planDate),
        executorName: wo.executorName || '',
        installationStatus: wo.installationStatus,
        photoStatus: wo.photoStatus,
        integrationStatus: wo.integrationStatus,
        note: wo.note || '',
        issue: wo.issue || '',
        completedDate: this.fmtDateForSheet(wo.completedDate),
      };
      const changed = Object.keys(sheet).some(
        (k) => (sheet as any)[k] !== undefined && (sheet as any)[k] !== (current as any)[k],
      );

      items.push({ siteCode, current, sheet, changed, rowNumber: r + 1 });
    }

    return {
      periodCode,
      solutionCode: periodSolution.solution.solutionCode,
      items,
      toUpdate: items.filter((i) => i.changed).length,
      unchanged: items.filter((i) => !i.changed).length,
      siteNotFound: [...siteNotFoundSet],
      errors: [],
    };
  }

  async syncProgressFromSheet(
    periodCode: string,
    solutionId: number,
  ): Promise<{ updated: number; errors: string[] }> {
    const preview = await this.previewProgressSync(periodCode, solutionId);
    if (preview.errors.length) return { updated: 0, errors: preview.errors };

    const period = await this.prisma.period.findFirst({
      where: { periodCode: { equals: periodCode, mode: 'insensitive' } },
    });
    if (!period) return { updated: 0, errors: [`Không tìm thấy kỳ "${periodCode}"`] };

    const allSites = await this.prisma.site.findMany({ select: { id: true, siteCode: true } });
    const siteMap = new Map(allSites.map((s) => [s.siteCode.toLowerCase(), s.id]));

    const workOrders = await this.prisma.workOrder.findMany({ where: { periodId: period.id, solutionId } });
    const woBySite = new Map(workOrders.map((w) => [w.siteId, w]));

    let updated = 0;
    for (const item of preview.items) {
      if (!item.changed) continue;
      const siteId = siteMap.get(item.siteCode.toLowerCase());
      if (siteId === undefined) continue;
      const wo = woBySite.get(siteId);
      if (!wo) continue;

      const data: Record<string, unknown> = { sheetRow: item.rowNumber };
      if (item.sheet.planDate !== undefined) data.planDate = item.sheet.planDate ? this.parseSheetDate(item.sheet.planDate) : null;
      if (item.sheet.executorName !== undefined) data.executorName = item.sheet.executorName || null;
      if (item.sheet.installationStatus !== undefined) data.installationStatus = item.sheet.installationStatus;
      if (item.sheet.photoStatus !== undefined) data.photoStatus = item.sheet.photoStatus;
      if (item.sheet.integrationStatus !== undefined) data.integrationStatus = item.sheet.integrationStatus;
      if (item.sheet.note !== undefined) data.note = item.sheet.note || null;
      if (item.sheet.issue !== undefined) data.issue = item.sheet.issue || null;
      if (item.sheet.completedDate !== undefined) data.completedDate = item.sheet.completedDate ? this.parseSheetDate(item.sheet.completedDate) : null;

      await this.prisma.workOrder.update({ where: { id: wo.id }, data });
      updated++;
    }

    return { updated, errors: [] };
  }

  private progressFieldCols(ps: {
    sheetPlanDateCol: string | null; sheetExecutorCol: string | null; sheetInstallCol: string | null;
    sheetPhotoCol: string | null; sheetIntegrationCol: string | null; sheetNoteCol: string | null; sheetIssueCol: string | null;
    sheetCompletedDateCol: string | null;
  }): Array<{ field: 'planDate' | 'executorName' | 'installationStatus' | 'photoStatus' | 'integrationStatus' | 'note' | 'issue' | 'completedDate'; colIdx: number }> {
    const defs: Array<{ field: any; col: string | null }> = [
      { field: 'planDate', col: ps.sheetPlanDateCol },
      { field: 'executorName', col: ps.sheetExecutorCol },
      { field: 'installationStatus', col: ps.sheetInstallCol },
      { field: 'photoStatus', col: ps.sheetPhotoCol },
      { field: 'integrationStatus', col: ps.sheetIntegrationCol },
      { field: 'note', col: ps.sheetNoteCol },
      { field: 'issue', col: ps.sheetIssueCol },
      { field: 'completedDate', col: ps.sheetCompletedDateCol },
    ];
    return defs
      .filter((d) => d.col)
      .map((d) => ({ field: d.field, colIdx: this.colLetterToIndex(d.col!) }));
  }

  private readProgressFromRow(
    row: string[],
    fieldColDefs: Array<{ field: string; colIdx: number }>,
  ): Partial<{
    planDate: string; executorName: string; installationStatus: InstallStatus;
    photoStatus: PhotoStatus; integrationStatus: InstallStatus; note: string; issue: string; completedDate: string;
  }> {
    const out: any = {};
    for (const { field, colIdx } of fieldColDefs) {
      const cell = (row[colIdx] || '').toString().trim();
      switch (field) {
        case 'planDate': out.planDate = cell; break;
        case 'executorName': out.executorName = cell; break;
        case 'installationStatus': out.installationStatus = this.mapInstallStatus(cell); break;
        case 'photoStatus': out.photoStatus = this.mapPhotoStatus(cell); break;
        case 'integrationStatus': out.integrationStatus = this.mapInstallStatus(cell); break;
        case 'note': out.note = cell; break;
        case 'issue': out.issue = cell; break;
        case 'completedDate': out.completedDate = cell; break;
      }
    }
    return out;
  }
}
