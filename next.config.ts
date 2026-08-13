/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // El lint se corre localmente (npm run lint = tsc --noEmit). Evita que
    // Vercel falle/adverta por falta de eslint en el build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
