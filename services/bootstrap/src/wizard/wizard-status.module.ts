import { Module } from '@nestjs/common';
import { WizardStatusService } from './wizard-status.service';
import { WizardStatusController } from './wizard-status.controller';

@Module({
  providers: [WizardStatusService],
  exports: [WizardStatusService],
  controllers: [WizardStatusController],
})
export class WizardStatusModule {}
