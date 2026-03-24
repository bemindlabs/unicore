export const siteConfig = {
  name: 'UniCore Geek',
  description: 'Terminal-first developer portal — XP, achievements, leaderboards, and multiplayer coding sessions.',
  url: 'https://geek.unicore.bemind.tech',
  geekServerUrl: process.env.NEXT_PUBLIC_GEEK_SERVER_URL || 'http://localhost:18901',
  licenseApiUrl: process.env.NEXT_PUBLIC_LICENSE_API_URL || 'http://localhost:4600',
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:4000',
};
