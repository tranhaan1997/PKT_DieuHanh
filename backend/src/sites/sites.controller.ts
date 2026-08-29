import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  SitesService,
  CreateSiteDto,
  UpdateSiteDto,
  SiteQueryDto,
} from './sites.service';

@Controller('api/sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private sitesService: SitesService) {}

  @Get()
  findAll(@Query() query: SiteQueryDto) {
    return this.sitesService.findAll(query);
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.sitesService.exportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mau-import-tram.xlsx"',
    );
    res.send(buffer);
  }

  @Get('export')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.sitesService.exportExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=danh-sach-tram.xlsx',
    );
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(+id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(+id, dto);
  }

  @Delete('bulk')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  bulkRemove(@Body() body: { ids: number[] }) {
    return this.sitesService.bulkRemove(body.ids);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('id') id: string) {
    return this.sitesService.remove(+id);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.sitesService.importExcel(file.buffer);
  }
}
