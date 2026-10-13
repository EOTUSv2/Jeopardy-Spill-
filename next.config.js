/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The production build goes to its own folder so it never collides with `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
