import { IsString } from 'class-validator';

/** GAPS #8 — redeem a single-use email-verification token. */
export class VerifyEmailDto {
  @IsString()
  token: string;
}
