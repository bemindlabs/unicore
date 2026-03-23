import { IsString, IsEnum, IsOptional, MaxLength, IsBoolean, Matches } from 'class-validator';

export enum InviteParticipantType {
  USER = 'USER',
  AGENT = 'AGENT',
}

export class InviteParticipantDto {
  @IsString()
  @MaxLength(200)
  participantId!: string;

  @IsEnum(InviteParticipantType)
  participantType!: InviteParticipantType;

  @IsString()
  @MaxLength(200)
  participantName!: string;

  @IsBoolean()
  @IsOptional()
  autoAssigned?: boolean;

  /** Hex colour for avatar badge — UNC-1031 */
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'participantColor must be a valid hex colour' })
  participantColor?: string;

  /** AI-only: auto-respond without human approval — UNC-1031 */
  @IsBoolean()
  @IsOptional()
  autoRespond?: boolean;
}

export class UpdateParticipantDto {
  /** Toggle auto-respond for AI agents — UNC-1031 */
  @IsBoolean()
  @IsOptional()
  autoRespond?: boolean;

  /** Update avatar colour — UNC-1031 */
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'participantColor must be a valid hex colour' })
  participantColor?: string;
}

/** Parsed from /invite @agentType commands */
export class InviteCommandDto {
  @IsString()
  @MaxLength(500)
  command!: string;
}
