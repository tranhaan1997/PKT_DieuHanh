import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService, type ReportQueryDto, type TrendQueryDto } from './reports.service';

@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.VIEWER)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private sendXlsx(res: Response, buffer: Buffer, filename: string) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }

  @Get('summary')
  getSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.getSummary(query);
  }

  @Get('summary/export')
  async exportSummary(@Query() query: ReportQueryDto, @Res() res: Response) {
    this.sendXlsx(res, await this.reportsService.exportSummary(query), 'bao-cao-tong-hop.xlsx');
  }

  @Get('staff-performance')
  getStaffPerformance(@Query() query: ReportQueryDto) {
    return this.reportsService.getStaffPerformance(query);
  }

  @Get('staff-performance/export')
  async exportStaffPerformance(@Query() query: ReportQueryDto, @Res() res: Response) {
    this.sendXlsx(res, await this.reportsService.exportStaffPerformance(query), 'hieu-suat-nhan-su.xlsx');
  }

  @Get('material-bottleneck')
  getMaterialBottleneck(@Query() query: ReportQueryDto) {
    return this.reportsService.getMaterialBottleneck(query);
  }

  @Get('material-bottleneck/export')
  async exportMaterialBottleneck(@Query() query: ReportQueryDto, @Res() res: Response) {
    this.sendXlsx(res, await this.reportsService.exportMaterialBottleneck(query), 'ton-dong-vat-tu.xlsx');
  }

  @Get('issues')
  getIssues(@Query() query: ReportQueryDto) {
    return this.reportsService.getIssues(query);
  }

  @Get('issues/export')
  async exportIssues(@Query() query: ReportQueryDto, @Res() res: Response) {
    this.sendXlsx(res, await this.reportsService.exportIssues(query), 'vuong-mac.xlsx');
  }

  @Get('trend')
  getTrend(@Query() query: TrendQueryDto) {
    return this.reportsService.getTrend(query);
  }

  @Get('trend/export')
  async exportTrend(@Query() query: TrendQueryDto, @Res() res: Response) {
    this.sendXlsx(res, await this.reportsService.exportTrend(query), 'xu-huong-theo-ky.xlsx');
  }
}
