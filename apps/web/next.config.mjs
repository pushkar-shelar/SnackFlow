/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@snackflow/shared'],
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
