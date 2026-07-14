/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'localhost:3001'] },
  },
  outputFileTracing: false,
  // pdf-parse must run server-side only (Node.js APIs)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules in the client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
        'pdf-parse': false,
        'pdfjs-dist': false,
      }
    }
    return config
  },
}

module.exports = nextConfig
