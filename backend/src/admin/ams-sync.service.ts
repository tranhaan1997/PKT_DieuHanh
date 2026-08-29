import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AmsOperator {
  USERNAME: string;
  OPER_ID: number;
  DEPT_ID: string;
  DEPT_NAME: string | null;
  DEPT_GROUP: string | null;
  PARENTDEPTNAME: string | null;
  FULLDEPTNAME: string | null;
  EMAIL: string | null;
  OPER_NAME: string;
  MOBILE: string | null;
  POS_NAME: string | null;
  STAT_ID: string;
  EMPLOYEE_CODE: string | null;
  LASTLOGIN: string | null;
}

export type SyncStatus = 'new' | 'update' | 'skip' | 'no-email';

export interface OperatorWithStatus extends AmsOperator {
  syncStatus: SyncStatus;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class AmsSyncService {
  constructor(private prisma: PrismaService) {}

  private get apiUrl() {
    return process.env.AMS_API_URL || 'https://ams.vienthongact.vn/Api';
  }
  private get syncToken() {
    return process.env.AMS_SYNC_TOKEN || '';
  }

  // ── Fetch operators from AMS ────────────────────────────────────────
  private async fetchOperators(amsToken: string): Promise<AmsOperator[]> {
    if (!amsToken) throw new BadRequestException('ams_token_missing');

    const url = `${this.apiUrl}/Systems/Operators_Sync_Getlist`;
    console.log(`[AMS] GET ${url}`);

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${amsToken}` },
      });
    } catch (err: any) {
      console.error('[AMS] Network error:', err?.message);
      throw new InternalServerErrorException(
        `Không thể kết nối AMS: ${err?.message}`,
      );
    }

    const bodyText = await resp.text().catch(() => '');
    console.log(`[AMS] Response ${resp.status}: ${bodyText.substring(0, 300)}`);

    // Use 422 (not 401) so axios interceptor doesn't confuse with DH auth failure
    if (resp.status === 401)
      throw new HttpException(
        'ams_token_expired',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

    if (!resp.ok) {
      throw new InternalServerErrorException(
        `AMS trả về lỗi ${resp.status}: ${bodyText.substring(0, 200)}`,
      );
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new InternalServerErrorException(
        `AMS trả về dữ liệu không hợp lệ: ${bodyText.substring(0, 100)}`,
      );
    }

    // AMS custom error format: { O_RESULT: -2, O_MESSAGE: "..." }
    // O_RESULT: -2 = token/auth error (AMS returns HTTP 200 but with error payload)
    if (typeof data?.O_RESULT === 'number' && data.O_RESULT < 0) {
      if (data.O_RESULT === -2)
        throw new HttpException(
          'ams_token_expired',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      throw new InternalServerErrorException(
        `AMS: ${data.O_MESSAGE || 'Lỗi không xác định'}`,
      );
    }

    // Handle various response shapes — AMS uses O_DATATABLE for list data
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.O_DATATABLE)
        ? data.O_DATATABLE
        : Array.isArray(data?.O_DATA)
          ? data.O_DATA
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.operators)
                ? data.operators
                : Array.isArray(data?.result)
                  ? data.result
                  : Array.isArray(data?.Data)
                    ? data.Data
                    : Array.isArray(data?.Result)
                      ? data.Result
                      : [];

    console.log(`[AMS] Parsed ${list.length} operators`);
    if (list.length === 0 && !Array.isArray(data)) {
      console.warn(
        '[AMS] Unexpected response shape, keys:',
        Object.keys(data || {}),
      );
    }

    return list as AmsOperator[];
  }

  // ── Interactive: list with sync status ─────────────────────────────
  async listOperators(amsToken: string): Promise<OperatorWithStatus[]> {
    const operators = await this.fetchOperators(amsToken);

    const emails = operators
      .map((o) => (o.EMAIL || '').toLowerCase())
      .filter(Boolean);

    const existingUsers = emails.length
      ? await this.prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true, ssoId: true },
        })
      : [];

    const byEmail = new Map(existingUsers.map((u) => [u.email!, u]));

    return operators.map((op) => {
      const email = (op.EMAIL || '').toLowerCase() || null;
      if (!email) return { ...op, syncStatus: 'no-email' };
      const existing = byEmail.get(email);
      if (!existing) return { ...op, syncStatus: 'new' };
      if (existing.ssoId) return { ...op, syncStatus: 'skip' };
      return { ...op, syncStatus: 'update' };
    });
  }

  // ── Interactive: sync selected operators ───────────────────────────
  async syncSelected(
    amsToken: string,
    usernames: string[],
  ): Promise<SyncResult> {
    const operators = await this.fetchOperators(amsToken);
    const targets = operators.filter((o) => usernames.includes(o.USERNAME));

    let synced = 0,
      skipped = 0,
      errors = 0;

    for (const op of targets) {
      const email = (op.EMAIL || '').toLowerCase() || null;
      if (!email) {
        skipped++;
        continue;
      }
      try {
        const user = await this.prisma.user.findFirst({ where: { email } });
        if (!user) {
          // Tạo tài khoản DH mới từ nhân viên AMS
          const base = (op.USERNAME || email.split('@')[0])
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_');
          let username = base;
          let n = 1;
          while (await this.prisma.user.findUnique({ where: { username } })) {
            username = `${base}${n++}`;
          }
          await this.prisma.user.create({
            data: {
              username,
              fullName: op.OPER_NAME || email,
              email,
              role: UserRole.TECHNICIAN,
              ssoId: op.OPER_ID ? String(op.OPER_ID) : null,
              phone: op.MOBILE || null,
              position: op.POS_NAME || null,
              department: op.FULLDEPTNAME || op.DEPT_NAME || null,
              departmentGroup: op.DEPT_GROUP || null,
              passwordHash: await bcrypt.hash(
                crypto.randomBytes(32).toString('hex'),
                10,
              ),
              active: true,
            },
          });
          synced++;
          continue;
        }
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ssoId: op.OPER_ID ? String(op.OPER_ID) : user.ssoId,
            fullName: op.OPER_NAME || user.fullName,
            phone: op.MOBILE || user.phone,
            position: op.POS_NAME || user.position,
            department: op.FULLDEPTNAME || op.DEPT_NAME || user.department,
            departmentGroup: op.DEPT_GROUP || (user as any).departmentGroup,
          },
        });
        synced++;
      } catch {
        errors++;
      }
    }

    return { synced, skipped, errors };
  }

  // ── Bootstrap: sync all employees using AMS_SYNC_TOKEN ─────────────
  async bootstrapEmployees(): Promise<SyncResult> {
    if (!this.syncToken)
      throw new BadRequestException('AMS_SYNC_TOKEN chưa được cấu hình');

    const url = `${this.apiUrl}/Employee/List`;
    console.log(`[AMS Bootstrap] GET ${url}`);

    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.syncToken}` },
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Không thể kết nối AMS: ${err?.message}`,
      );
    }

    const bodyText = await resp.text().catch(() => '');
    console.log(
      `[AMS Bootstrap] Response ${resp.status}: ${bodyText.substring(0, 200)}`,
    );

    if (!resp.ok)
      throw new InternalServerErrorException(
        `AMS lỗi ${resp.status}: ${bodyText.substring(0, 200)}`,
      );

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new InternalServerErrorException('AMS trả về dữ liệu không hợp lệ');
    }

    const list: AmsOperator[] = Array.isArray(body)
      ? body
      : (body.data ?? body.items ?? []);
    let synced = 0,
      skipped = 0,
      errors = 0;

    for (const emp of list) {
      const email = (emp.EMAIL || '').toLowerCase() || null;
      if (!email) {
        skipped++;
        continue;
      }
      try {
        const user = await this.prisma.user.findFirst({ where: { email } });
        if (!user) {
          skipped++;
          continue;
        }
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ssoId: emp.OPER_ID ? String(emp.OPER_ID) : user.ssoId,
            fullName: emp.OPER_NAME || user.fullName,
            phone: emp.MOBILE || user.phone,
            position: emp.POS_NAME || user.position,
            department: emp.FULLDEPTNAME || emp.DEPT_NAME || user.department,
            departmentGroup: emp.DEPT_GROUP || (user as any).departmentGroup,
          },
        });
        synced++;
      } catch {
        errors++;
      }
    }

    return { synced, skipped, errors };
  }
}
