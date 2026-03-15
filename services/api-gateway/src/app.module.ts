import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProxyModule } from './proxy/proxy.module';
import { LicenseModule } from './license/license.module';
import { DomainModule } from './domains/domain.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { RateLimitStore } from './common/middleware/rate-limit.store';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { RequestValidationMiddleware } from './common/middleware/request-validation.middleware';
import { DomainRoutingMiddleware } from './domains/domain-routing.middleware';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, ProxyModule, LicenseModule, DomainModule, DashboardModule, AdminModule],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    RateLimitStore,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      // DomainRoutingMiddleware runs first — it attaches tenantId to req and
      // sets per-domain CORS headers before rate limiting or auth kicks in.
      .apply(DomainRoutingMiddleware, RequestValidationMiddleware, RateLimitMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
