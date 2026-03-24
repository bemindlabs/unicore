import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@bemindlabs/unicore-ui', '@bemindlabs/unicore-shared-types', '@bemindlabs/unicore-branding', '@bemindlabs/unicore-branding-base'],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Resolve workspace packages when pnpm symlinks are broken (e.g., Docker builds)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@bemindlabs/unicore-shared-types': path.resolve(__dirname, '../../packages/shared-types'),
      '@bemindlabs/unicore-ui': path.resolve(__dirname, '../../packages/ui'),
      '@bemindlabs/unicore-config': path.resolve(__dirname, '../../packages/config'),
      '@bemindlabs/unicore-branding': path.resolve(__dirname, '../../packages/branding'),
      '@bemindlabs/unicore-branding-base': path.resolve(__dirname, '../../packages/branding-base'),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
