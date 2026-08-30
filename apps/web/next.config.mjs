/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les packages du monorepo sont publiés en TypeScript source, sans étape de build.
  transpilePackages: ['@rig/core', '@rig/ui'],
};

export default nextConfig;
