import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Switch the current user's active business (tenant) (Phase 5 / W1a). The target
 * tenant MUST be one the user has a Membership for, or the request is rejected.
 */
export class SwitchTenantDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
