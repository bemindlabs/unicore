import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class AddMessageDto {
  @IsString()
  @MaxLength(10000)
  content!: string;

  @IsOptional()
  @IsString()
  @IsIn(['user', 'agent', 'system'])
  role?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  authorName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['human', 'agent', 'system'])
  authorType?: string;
}
