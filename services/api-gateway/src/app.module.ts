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
import { AuditModule } from './audit/audit.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DemoModeGuard } from './common/guards/demo-mode.guard';
import { RateLimitStore } from './common/middleware/rate-limit.store';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { RequestValidationMiddleware } from './common/middleware/request-validation.middleware';
import { DomainRoutingMiddleware } from './domains/domain-routing.middleware';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ChatHistoryModule } from './chat-history/chat-history.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GamificationModule } from './gamification/gamification.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationIntelligenceModule } from './conversation-intelligence/conversation-intelligence.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ConversationsAnalyticsModule } from './conversations-analytics/conversations-analytics.module';
import { ContactProfileModule } from './contact-profile/contact-profile.module';
import { PluginsModule } from './plugins/plugins.module';
import { EmailModule } from './email/email.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { TenantContextInterceptor } from './common/tenancy/tenant-context.interceptor';
import { TenantModule } from './tenant/tenant.module';
import { SuspendedTenantGuard } from './common/guards/suspended-tenant.guard';
import { TenantRateLimitGuard } from './common/guards/tenant-rate-limit.guard';
import { TenantUsageModule } from './common/tenancy/tenant-usage.module';
@Module({
  imports: [PrismaModule, HealthModule, AuthModule, ProxyModule, LicenseModule, DomainModule, DashboardModule, AdminModule, AuditModule, SettingsModule, TasksModule, WebhooksModule, ChatHistoryModule, NotificationsModule, GamificationModule, ChannelsModule, ConversationsAnalyticsModule, ConversationsModule, ContactProfileModule, ConversationIntelligenceModule, PluginsModule, EmailModule, TenancyModule, TenantUsageModule, TenantModule],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Seeds the request-scoped tenant store (runs after JwtAuthGuard, so
    // req.user.tenantId is resolved) for the gateway's own RLS-scoped queries.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DemoModeGuard },
    // Enforces read-only for SUSPENDED tenants (saas mode); runs after the JWT
    // guard so req.user.tenantId is resolved. Self-host is a pass-through.
    { provide: APP_GUARD, useClass: SuspendedTenantGuard },
    // Per-tenant noisy-neighbor protection (FU-04): burst rate limit + monthly
    // usage cap, keyed by the resolved tenant. No-op in self-host mode.
    { provide: APP_GUARD, useClass: TenantRateLimitGuard },
    RateLimitStore,
    RateLimitMiddleware,
    RequestValidationMiddleware,
    TenantContextMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      // DomainRoutingMiddleware runs first — it attaches tenantId to req and
      // sets per-domain CORS headers before rate limiting or auth kicks in.
      // TenantContextMiddleware strips client-supplied x-tenant-id and sets the
      // self-host default tenant before auth resolves the saas tenant.
      .apply(DomainRoutingMiddleware, TenantContextMiddleware, RequestValidationMiddleware, RateLimitMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
