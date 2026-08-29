import { Module } from '@nestjs/common';
import { TtkvsController } from './ttkvs.controller';
import { TtkvsService } from './ttkvs.service';

@Module({
  controllers: [TtkvsController],
  providers: [TtkvsService],
  exports: [TtkvsService],
})
export class TtkvsModule {}
