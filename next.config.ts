import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const demoMode = process.env.DCS_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DCS_DEMO_MODE === 'true';
const legacyApiRewrites = process.env.DCS_LEGACY_API_REWRITES === 'true';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    if (demoMode || !legacyApiRewrites) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
