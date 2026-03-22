import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

interface GithubProfile {
  id: string;
  displayName?: string;
  username?: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:4000/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GithubProfile,
    done: (err: Error | null, user?: any) => void,
  ): Promise<void> {
    let email = profile.emails?.[0]?.value || null;

    // GitHub may not return email in profile — fetch from /user/emails API
    if (!email) {
      try {
        const res = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (res.ok) {
          const emails = (await res.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primary = emails.find((e) => e.primary && e.verified);
          email = primary?.email || emails.find((e) => e.verified)?.email || null;
        }
      } catch {
        // Proceed without email — OAuth account still links by providerAccountId
      }
    }

    const name =
      profile.displayName || profile.username || email || 'GitHub User';
    const avatarUrl = profile.photos?.[0]?.value || null;

    const user = await this.authService.validateOAuthUser('github', {
      providerAccountId: String(profile.id),
      email,
      name,
      avatarUrl,
      accessToken,
      refreshToken: refreshToken || null,
    });

    done(null, user);
  }
}
