import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AmsSyncService } from './ams-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';

@Module({
  imports: [PrismaModule, GoogleSheetsModule],
  controllers: [AdminController, AdminSettingsController],
  providers: [AmsSyncService],
})
export class AdminModule {}
