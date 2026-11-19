/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the floating "N" dev-tools button (development only; errors still show)
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
