/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kroxy/types'],
  async rewrites() {
    return [
      {
        source: '/api/events',
        destination: 'http://localhost:3001/api/audit/stream',
      },
      {
        source: '/api/events/:path*',
        destination: 'http://localhost:3001/api/audit/stream',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
