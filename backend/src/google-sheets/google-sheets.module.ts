import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsController } from './google-sheets.controller';
import { AutoStatusSyncService } from './auto-status-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService, AutoStatusSyncService],
  exports: [GoogleSheetsService, AutoStatusSyncService],
})
export class GoogleSheetsModule {}
