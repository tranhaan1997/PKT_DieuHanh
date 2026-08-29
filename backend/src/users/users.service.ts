import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export class CreateUserDto {
  @IsString() username: string;
  @IsString() fullName: string;
  @IsOptional() @IsString() email?: string;
  @IsEnum(UserRole) role: UserRole;
  @IsString() password: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() departmentGroup?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() departmentGroup?: string;
}

const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  role: true,
  active: true,
  ssoId: true,
  department: true,
  departmentGroup: true,
  phone: true,
  position: true,
  lastLogin: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Username đã tồn tại');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
        department: dto.department,
        departmentGroup: dto.departmentGroup,
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Block deletion if user has created any Work Orders
    const woCount = await this.prisma.workOrder.count({
      where: { createdById: id },
    });
    if (woCount > 0) {
      throw new BadRequestException(
        `Không thể xóa: tài khoản đã tạo ${woCount} Work Order`,
      );
    }
    // Nullify Period.createdById (nullable) to allow deletion
    await this.prisma.period.updateMany({
      where: { createdById: id },
      data: { createdById: null },
    });
    // PeriodUser rows cascade-delete automatically
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Đã xóa tài khoản' };
  }
}
