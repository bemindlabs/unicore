import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Create an additional business (tenant) for the current user (Phase 5 / W1a).
 * The caller becomes its OWNER via a Membership and may switch to it.
 */
export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
