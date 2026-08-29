import { Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.svc.findForUser(user.id);
  }

  @Put('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.svc.markAllRead(user.id);
  }

  @Put(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.markRead(+id, user.id);
  }
}
