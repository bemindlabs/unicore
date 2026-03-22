import { Injectable, Logger } from '@nestjs/common';

export interface WizardStatus {
  completed: boolean;
  completedAt?: string;
}

@Injectable()
export class WizardStatusService {
  private readonly logger = new Logger(WizardStatusService.name);
  private completed = false;
  private completedAt?: Date;

  isComplete(): boolean {
    return this.completed;
  }

  markComplete(): void {
    if (this.completed) return;
    this.completed = true;
    this.completedAt = new Date();
    this.logger.log('Wizard marked as complete — platform provisioning locked');
  }

  getStatus(): WizardStatus {
    return {
      completed: this.completed,
      ...(this.completedAt ? { completedAt: this.completedAt.toISOString() } : {}),
    };
  }
}
