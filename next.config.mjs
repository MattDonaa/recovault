/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Serve brand PNGs as-is (no runtime image optimization needed).
  images: { unoptimized: true },
};

export default nextConfig;
