import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantsService, MembershipView } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';

interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Multi-business membership endpoints (Phase 5 / W1a). One user can own/operate
 * several solopreneur businesses (tenants) and switch the active one.
 */
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /** List the current user's businesses (tenantId, name, plan, role, isActive). */
  @Get()
  list(@CurrentUser('id') userId: string): Promise<MembershipView[]> {
    return this.tenants.listForUser(userId);
  }

  /** Create a new business; the caller becomes its OWNER. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTenantDto,
  ): Promise<MembershipView> {
    return this.tenants.createForUser(userId, dto.name);
  }

  /** Switch the active business; re-issues an access token with the new tid. */
  @Post('switch')
  @HttpCode(HttpStatus.OK)
  switch(
    @CurrentUser() user: AuthedUser,
    @Body() dto: SwitchTenantDto,
  ): Promise<AuthResponseDto> {
    return this.tenants.switchForUser(user, dto.tenantId);
  }
}
