/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    return [
      // Text queries
      {
        source: '/api/query',
        destination: `${apiUrl}/chat`,
      },
      // Media uploads
      {
        source: '/api/upload/image',
        destination: `${apiUrl}/analyze-image`,
      },
      {
        source: '/api/upload/video',
        destination: `${apiUrl}/analyze-video`,
      },
      {
        source: '/api/upload/voice',
        destination: `${apiUrl}/extract-text`,
      },
      {
        source: '/api/upload/video/comprehensive',
        destination: `${apiUrl}/analyze-video`,
      },
      {
        source: '/api/upload/video/audio',
        destination: `${apiUrl}/analyze-video`,
      },
      // Job status
      {
        source: '/api/job_status/:id',
        destination: `${apiUrl}/job-status/:id`,
      },
      {
        source: '/api/job-status/:id',
        destination: `${apiUrl}/job-status/:id`,
      },
      // Fallback for any other API routes
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
}

module.exports = nextConfig 