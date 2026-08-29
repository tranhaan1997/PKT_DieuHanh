import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AmsSyncService } from './ams-sync.service';

@Controller('api/admin/sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private amsSyncService: AmsSyncService) {}

  @Get('status')
  status() {
    return {
      amsApiUrl: process.env.AMS_API_URL || null,
      hasSyncToken: Boolean(process.env.AMS_SYNC_TOKEN),
    };
  }

  @Post('ams-users/list')
  listAmsUsers(@Body('amsToken') amsToken: string) {
    return this.amsSyncService.listOperators(amsToken);
  }

  @Post('ams-users')
  syncAmsUsers(
    @Body('amsToken') amsToken: string,
    @Body('selectedUsernames') selectedUsernames: string[],
  ) {
    return this.amsSyncService.syncSelected(amsToken, selectedUsernames);
  }

  @Post('employees')
  bootstrapEmployees() {
    return this.amsSyncService.bootstrapEmployees();
  }
}
