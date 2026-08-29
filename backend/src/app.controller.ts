import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/version')
  getVersion() {
    return {
      version: process.env.APP_VERSION || 'dev',
      buildSha: (process.env.BUILD_SHA || '').slice(0, 7) || 'local',
    };
  }
}
