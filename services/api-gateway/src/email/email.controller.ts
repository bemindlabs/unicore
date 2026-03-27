import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EmailService, type WelcomeEmailData } from './email.service';
import { SendWelcomeDto } from './dto/send-welcome.dto';

@Controller('api/v1/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /** Send welcome email after wizard provisioning — requires bootstrap secret */
  @Public()
  @Post('welcome')
  @HttpCode(200)
  async sendWelcome(@Body() dto: SendWelcomeDto) {
    const expected = process.env.BOOTSTRAP_SECRET;
    if (!expected || dto.bootstrapSecret !== expected) {
      return { sent: false, reason: 'Invalid bootstrap secret' };
    }

    const data: WelcomeEmailData = {
      adminName: dto.adminName,
      adminEmail: dto.adminEmail,
      licenseKey: dto.licenseKey,
      businessName: dto.businessName,
      dashboardUrl: dto.dashboardUrl,
      agentsEnabled: dto.agentsEnabled ?? [],
      erpModulesEnabled: dto.erpModulesEnabled ?? [],
    };

    const sent = await this.emailService.sendWelcomeEmail(data);
    return { sent };
  }
}
