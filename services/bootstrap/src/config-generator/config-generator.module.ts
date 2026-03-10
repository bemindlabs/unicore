import { Module } from '@nestjs/common';
import { ConfigGeneratorService } from './config-generator.service';

@Module({
  providers: [ConfigGeneratorService],
  exports: [ConfigGeneratorService],
})
export class ConfigGeneratorModule {}
