import { Module } from '@nestjs/common';
import { DomainResolverService } from './domain-resolver.service';
import { DomainCacheService } from './domain-cache.service';
import { DomainCorsService } from './domain-cors.service';
import { DomainRoutingMiddleware } from './domain-routing.middleware';

@Module({
  providers: [
    DomainCacheService,
    DomainResolverService,
    DomainCorsService,
    DomainRoutingMiddleware,
  ],
  exports: [
    DomainCacheService,
    DomainResolverService,
    DomainCorsService,
    DomainRoutingMiddleware,
  ],
})
export class DomainModule {}
