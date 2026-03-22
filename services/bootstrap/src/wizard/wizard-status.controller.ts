import { Controller, Get } from '@nestjs/common';
import { WizardStatusService } from './wizard-status.service';

@Controller('wizard-status')
export class WizardStatusController {
  constructor(private readonly wizardStatusService: WizardStatusService) {}

  @Get()
  getStatus() {
    return { success: true, data: this.wizardStatusService.getStatus() };
  }
}
