import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  assigneeName?: string;
}

export class TransitionStatusDto {
  @IsString()
  @IsIn(['OPEN', 'ASSIGNED', 'PENDING', 'RESOLVED', 'CLOSED'])
  status!: string;
}
