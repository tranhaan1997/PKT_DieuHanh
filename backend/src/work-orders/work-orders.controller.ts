import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  WorkOrdersService,
  UpdateWorkOrderDto,
  WorkOrderQueryDto,
} from './work-orders.service';

@Controller('api/work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(private workOrdersService: WorkOrdersService) {}

  @Get()
  findAll(@Query() query: WorkOrderQueryDto) {
    return this.workOrdersService.findAll(query);
  }

  @Get('export')
  async exportExcel(@Query() query: WorkOrderQueryDto, @Res() res: Response) {
    const buffer = await this.workOrdersService.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=work-orders.xlsx',
    );
    res.send(buffer);
  }

  @Get('labels')
  listLabels() {
    return this.workOrdersService.listLabels();
  }

  @Post('import-materials')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('file'))
  importMaterials(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.importMaterials(file, user);
  }

  @Post('bulk-delete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  removeMany(@Body('ids') ids: number[]) {
    return this.workOrdersService.removeMany(ids);
  }

  @Delete('by-label/:label')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  removeByLabel(@Param('label') label: string) {
    return this.workOrdersService.removeByLabel(decodeURIComponent(label));
  }

  @Get('my-logs')
  findMyLogs(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workOrdersService.findMyLogs(user.id, { search, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workOrdersService.findOne(+id);
  }

  @Get(':id/logs')
  findLogs(@Param('id') id: string) {
    return this.workOrdersService.findLogs(+id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.update(+id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('id') id: string) {
    return this.workOrdersService.remove(+id);
  }

  @Post(':id/sync-sheet')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  retrySheetSync(@Param('id') id: string) {
    return this.workOrdersService.retrySheetSync(+id);
  }

  @Post(':id/sync-sheet/dismiss')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  dismissSheetSyncError(@Param('id') id: string) {
    return this.workOrdersService.dismissSheetSyncError(+id);
  }
}
