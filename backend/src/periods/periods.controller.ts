import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  PeriodsService,
  CreatePeriodDto,
  UpdatePeriodDto,
} from './periods.service';

@Controller('api/periods')
@UseGuards(JwtAuthGuard)
export class PeriodsController {
  constructor(private periodsService: PeriodsService) {}

  @Get()
  findAll() {
    return this.periodsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(+id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  create(@Body() dto: CreatePeriodDto, @CurrentUser() user: any) {
    return this.periodsService.create(dto, user.id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('id') id: string, @Body() dto: UpdatePeriodDto) {
    return this.periodsService.update(+id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.periodsService.remove(+id);
  }

  @Post(':id/supervisors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  assignSupervisors(
    @Param('id') id: string,
    @Body('userIds') userIds: number[],
  ) {
    return this.periodsService.assignSupervisors(+id, userIds);
  }

  @Post(':id/solutions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  assignSolutions(
    @Param('id') id: string,
    @Body('solutionIds') solutionIds: number[],
  ) {
    return this.periodsService.assignSolutions(+id, solutionIds);
  }

  @Post(':id/sites')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  assignSites(@Param('id') id: string, @Body('siteIds') siteIds: number[]) {
    return this.periodsService.assignSites(+id, siteIds);
  }

  @Post(':id/generate-workorders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  generateWorkOrders(@Param('id') id: string, @CurrentUser() user: any) {
    return this.periodsService.generateWorkOrders(+id, user.id);
  }

  @Put(':id/solutions/:solutionId/sheet-config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  updateSolutionSheetConfig(
    @Param('id') id: string,
    @Param('solutionId') solutionId: string,
    @Body()
    dto: {
      sheetTab?: string;
      sheetStartRow?: number;
      sheetSiteCol?: string;
      sheetWrittenCol?: string;
      sheetActCol?: string;
      sheetTtkvCol?: string;
      sheetSiteRecvCol?: string;
      sheetPlanDateCol?: string;
      sheetExecutorCol?: string;
      sheetInstallCol?: string;
      sheetPhotoCol?: string;
      sheetIntegrationCol?: string;
      sheetNoteCol?: string;
      sheetIssueCol?: string;
      sheetCompletedDateCol?: string;
    },
  ) {
    return this.periodsService.updateSolutionSheetConfig(+id, +solutionId, dto);
  }

  @Put(':id/solutions/:solutionId/gen-col')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  updateSolutionGenCol(
    @Param('id') id: string,
    @Param('solutionId') solutionId: string,
    @Body('genCol') genCol: string,
  ) {
    return this.periodsService.updateSolutionGenCol(+id, +solutionId, genCol);
  }
}
