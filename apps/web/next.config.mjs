/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@video-factory/contracts',
    '@video-factory/database',
    '@video-factory/ui',
    '@video-factory/providers',
  ],
};

export default nextConfig;
