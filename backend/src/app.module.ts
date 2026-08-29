import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { SolutionsModule } from './solutions/solutions.module';
import { PeriodsModule } from './periods/periods.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { TtkvsModule } from './ttkvs/ttkvs.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    SitesModule,
    TtkvsModule,
    SolutionsModule,
    PeriodsModule,
    WorkOrdersModule,
    DashboardModule,
    AdminModule,
    NotificationsModule,
    GoogleSheetsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
