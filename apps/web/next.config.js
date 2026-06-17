/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@peaceclock/api-types', '@peaceclock/count-engine', '@peaceclock/db'],
};

module.exports = nextConfig;
