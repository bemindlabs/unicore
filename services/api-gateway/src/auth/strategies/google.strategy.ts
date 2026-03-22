import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    const name =
      profile.displayName ||
      [profile.name?.givenName, profile.name?.familyName]
        .filter(Boolean)
        .join(' ') ||
      email ||
      'Google User';
    const avatarUrl = profile.photos?.[0]?.value || null;

    const user = await this.authService.validateOAuthUser('google', {
      providerAccountId: profile.id,
      email: email || null,
      name,
      avatarUrl,
      accessToken,
      refreshToken: refreshToken || null,
    });

    done(null, user);
  }
}
