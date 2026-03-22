import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplatesModule } from './templates/templates.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { WizardStatusModule } from './wizard/wizard-status.module';
import { BootstrapSecretMiddleware } from './common/middleware/bootstrap-secret.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TemplatesModule,
    ProvisioningModule,
    WizardStatusModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BootstrapSecretMiddleware)
      .forRoutes({ path: 'provision', method: RequestMethod.POST });
  }
}
