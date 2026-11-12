import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

/** GAPS #8 — redeem a single-use, time-limited reset token to set a new
 * password. Mirrors the password policy of register/change-password. */
export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'newPassword must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
