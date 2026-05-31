import { IsEmail } from 'class-validator';

/** GAPS #8 — request a password-reset email. Always answered with 200 to
 * avoid leaking whether an account exists (no user enumeration). */
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
