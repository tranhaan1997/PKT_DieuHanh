import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { TtkvsService, CreateTtkvDto, UpdateTtkvDto } from './ttkvs.service';

@Controller('api/ttkvs')
@UseGuards(JwtAuthGuard)
export class TtkvsController {
  constructor(private readonly svc: TtkvsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.svc.findOne(code);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  create(@Body() dto: CreateTtkvDto) {
    return this.svc.create(dto);
  }

  @Put(':code')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('code') code: string, @Body() dto: UpdateTtkvDto) {
    return this.svc.update(code, dto);
  }

  @Delete(':code')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('code') code: string) {
    return this.svc.remove(code);
  }
}
