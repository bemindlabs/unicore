import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateAgentNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}

export class UpdateAgentNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}

export class UpsertContactChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  channel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  channelUserId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  displayName?: string;
}
