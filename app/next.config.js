import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@bemindlabs/unicore-ui', '@bemindlabs/unicore-shared-types', '@bemindlabs/unicore-branding', '@bemindlabs/unicore-branding-base'],
  // Workspace packages live outside app/ — Turbopack refuses to load them unless
  // its root is the monorepo root, not the app directory.
  turbopack: {
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
