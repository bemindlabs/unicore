export const siteConfig = {
  name: 'UniCore AI-DLC',
  description: 'Developer Lifecycle Chat — real-time team collaboration with AI-powered SDLC agents.',
  url: 'https://dlc.unicore.bemind.tech',
  dlcGatewayUrl: process.env.NEXT_PUBLIC_DLC_GATEWAY_URL || 'http://localhost:19790',
  dlcWsUrl: process.env.NEXT_PUBLIC_DLC_WS_URL || 'ws://localhost:19789',
  licenseApiUrl: process.env.NEXT_PUBLIC_LICENSE_API_URL || 'http://localhost:4600',
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:4000',
};
