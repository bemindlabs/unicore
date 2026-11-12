import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

/**
 * Self-serve SaaS signup (M3/E3). Creates a Tenant + OWNER User and starts the
 * 30-day free trial. No card is collected up front.
 */
export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  /** Business / workspace name. Defaults to the user's name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessName?: string;
}
