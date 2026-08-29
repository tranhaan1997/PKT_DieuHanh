import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateSolutionDto {
  @IsString() solutionCode: string;
  @IsString() solutionName: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() expectedDays?: number;
}

export class UpdateSolutionDto extends CreateSolutionDto {
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class SolutionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.solution.findMany({ orderBy: { solutionCode: 'asc' } });
  }

  async findOne(id: number) {
    const s = await this.prisma.solution.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Không tìm thấy giải pháp');
    return s;
  }

  async create(dto: CreateSolutionDto) {
    const exists = await this.prisma.solution.findUnique({
      where: { solutionCode: dto.solutionCode },
    });
    if (exists)
      throw new ConflictException(
        `Mã giải pháp ${dto.solutionCode} đã tồn tại`,
      );
    return this.prisma.solution.create({
      data: { ...dto, expectedDays: dto.expectedDays || 30 },
    });
  }

  async update(id: number, dto: UpdateSolutionDto) {
    await this.findOne(id);
    return this.prisma.solution.update({ where: { id }, data: dto });
  }

  private async checkInUse(id: number) {
    const [woCount, psCount] = await Promise.all([
      this.prisma.workOrder.count({ where: { solutionId: id } }),
      this.prisma.periodSolution.count({ where: { solutionId: id } }),
    ]);
    if (woCount > 0 || psCount > 0)
      throw new ConflictException(
        'Giải pháp đã phát sinh dữ liệu, không thể xóa',
      );
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.checkInUse(id);
    await this.prisma.solution.delete({ where: { id } });
    return { message: 'Đã xóa giải pháp' };
  }

  async bulkRemove(
    ids: number[],
  ): Promise<{ deleted: number; skipped: string[] }> {
    const skipped: string[] = [];
    let deleted = 0;
    for (const id of ids) {
      const sol = await this.prisma.solution.findUnique({ where: { id } });
      if (!sol) continue;
      const [woCount, psCount] = await Promise.all([
        this.prisma.workOrder.count({ where: { solutionId: id } }),
        this.prisma.periodSolution.count({ where: { solutionId: id } }),
      ]);
      if (woCount > 0 || psCount > 0) {
        skipped.push(sol.solutionCode);
      } else {
        await this.prisma.solution.delete({ where: { id } });
        deleted++;
      }
    }
    return { deleted, skipped };
  }
}
