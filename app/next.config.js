import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@bemindlabs/unicore-ui', '@bemindlabs/unicore-shared-types', '@bemindlabs/unicore-branding', '@bemindlabs/unicore-branding-base'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
