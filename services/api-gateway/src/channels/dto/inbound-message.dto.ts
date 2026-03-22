import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class InboundMessageDto {
  @IsString()
  @IsNotEmpty()
  channel!: string;

  @IsString()
  @IsNotEmpty()
  senderId!: string;

  @IsString()
  @IsOptional()
  senderName?: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsObject()
  @IsOptional()
  rawPayload?: Record<string, unknown>;
}
