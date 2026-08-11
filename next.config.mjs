/** @type {import('next').NextConfig} */

// Боевая выдача живёт на github.io/termaa — префикс нужен и для роутов,
// и для статики. В dev его можно снять: NEXT_PUBLIC_BASE_PATH=""
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/termaa'

const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
