import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    '6000-firebase-studio-1772649924486.cluster-r7kbxfo3fnev2vskbkhhphetq6.cloudworkstations.dev',
    '9000-firebase-studio-1772649924486.cluster-r7kbxfo3fnev2vskbkhhphetq6.cloudworkstations.dev',
  ],

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },

  //output: 'export',
};

export default nextConfig;