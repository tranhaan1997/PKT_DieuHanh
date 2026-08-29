import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleSheetsService } from './google-sheets.service';

@Controller('api/google-sheets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
export class GoogleSheetsController {
  constructor(private readonly svc: GoogleSheetsService) {}

  @Get('status')
  getStatus() {
    return this.svc.getStatus();
  }

  @Get('preview/:periodCode')
  preview(@Param('periodCode') periodCode: string) {
    return this.svc.previewWorkOrders(periodCode);
  }

  @Post('import-workorders')
  import(@Body('periodCode') periodCode: string, @CurrentUser() user: any) {
    return this.svc.importWorkOrders(periodCode, user.id);
  }

  @Get('status-preview/:periodCode/:solutionId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  previewStatus(
    @Param('periodCode') periodCode: string,
    @Param('solutionId') solutionId: string,
  ) {
    return this.svc.previewStatusSync(periodCode, +solutionId);
  }

  @Post('sync-status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  syncStatus(
    @Body('periodCode') periodCode: string,
    @Body('solutionId') solutionId: number,
    @CurrentUser() user: any,
  ) {
    return this.svc.syncStatuses(periodCode, +solutionId, user.id);
  }

  @Get('progress-preview/:periodCode/:solutionId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  previewProgress(
    @Param('periodCode') periodCode: string,
    @Param('solutionId') solutionId: string,
  ) {
    return this.svc.previewProgressSync(periodCode, +solutionId);
  }

  @Post('sync-progress')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  syncProgress(
    @Body('periodCode') periodCode: string,
    @Body('solutionId') solutionId: number,
  ) {
    return this.svc.syncProgressFromSheet(periodCode, +solutionId);
  }
}
