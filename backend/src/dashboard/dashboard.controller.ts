import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query('periodId') periodId?: string) {
    return this.dashboardService.getSummary(
      periodId ? parseInt(periodId) : undefined,
    );
  }

  @Get('by-period')
  getByPeriod() {
    return this.dashboardService.getByPeriod();
  }

  @Get('by-solution')
  getBySolution(@Query('periodId') periodId?: string) {
    return this.dashboardService.getBySolution(
      periodId ? parseInt(periodId) : undefined,
    );
  }

  @Get('by-province')
  getByProvince() {
    return this.dashboardService.getByProvince();
  }

  @Get('by-ttkv')
  getByTtkv(@Query('periodId') periodId?: string) {
    return this.dashboardService.getByTtkv(
      periodId ? parseInt(periodId) : undefined,
    );
  }

  @Get('material-progress')
  getMaterialProgress(@Query('periodId') periodId?: string) {
    return this.dashboardService.getMaterialProgress(
      periodId ? parseInt(periodId) : undefined,
    );
  }

  @Get('material-progress-by-ttkv')
  getMaterialProgressByTtkv(@Query('periodId') periodId?: string) {
    return this.dashboardService.getMaterialProgressByTtkv(
      periodId ? parseInt(periodId) : undefined,
    );
  }
}
