/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les packages du monorepo sont publiés en TypeScript source, sans étape de build.
  transpilePackages: ['@rack/core', '@rack/ui'],
};

export default nextConfig;
