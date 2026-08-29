import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateTtkvDto {
  @IsString() code: string;
  @IsString() name: string;
}

export class UpdateTtkvDto {
  @IsOptional() @IsString() name?: string;
}

@Injectable()
export class TtkvsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.ttkv.findMany({ orderBy: { code: 'asc' } });
  }

  async findOne(code: string) {
    const ttkv = await this.prisma.ttkv.findUnique({ where: { code } });
    if (!ttkv) throw new NotFoundException('Không tìm thấy TTKV');
    return ttkv;
  }

  async create(dto: CreateTtkvDto) {
    const exists = await this.prisma.ttkv.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Mã TTKV "${dto.code}" đã tồn tại`);
    return this.prisma.ttkv.create({ data: dto });
  }

  async update(code: string, dto: UpdateTtkvDto) {
    await this.findOne(code);
    return this.prisma.ttkv.update({ where: { code }, data: dto });
  }

  async remove(code: string) {
    await this.findOne(code);
    const siteCount = await this.prisma.site.count({ where: { ttkvCode: code } });
    if (siteCount > 0)
      throw new ConflictException(
        `TTKV đang được dùng bởi ${siteCount} trạm, không thể xóa`,
      );
    await this.prisma.ttkv.delete({ where: { code } });
    return { message: 'Đã xóa TTKV' };
  }
}
