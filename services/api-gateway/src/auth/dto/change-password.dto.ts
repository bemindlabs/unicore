import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Match } from '../decorators/match.decorator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'newPassword must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;

  @IsString()
  @Match('newPassword', { message: 'confirmPassword must match newPassword' })
  confirmPassword: string;
}
