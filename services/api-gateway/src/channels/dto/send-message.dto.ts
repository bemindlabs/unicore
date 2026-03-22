import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  channelType!: string;

  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsOptional()
  recipientId?: string;
}
