import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  
  // Ensure environment variables are available
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://indulgeconcierge.com/api',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'https://indulgeconcierge.com',
  },
  
  // Output standalone for better deployment
  output: 'standalone',
};

export default nextConfig;
