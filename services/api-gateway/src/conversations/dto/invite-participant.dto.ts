import { IsString, IsEnum, IsOptional, MaxLength, IsBoolean } from 'class-validator';

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
}

/** Parsed from /invite @agentType commands */
export class InviteCommandDto {
  @IsString()
  @MaxLength(500)
  command!: string;
}
