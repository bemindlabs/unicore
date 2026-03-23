import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AddMessageDto {
  @IsString()
  @MaxLength(50000)
  content!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  authorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  authorName?: string;

  @IsString()
  @IsOptional()
  authorType?: string;
}
