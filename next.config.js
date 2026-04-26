/** @type {import('next').NextConfig} */
const isGithubPages = process.env.DEPLOY_TARGET === 'ghpages'

const nextConfig = {
  reactStrictMode: true,
  ...(isGithubPages && {
    output: 'export',
    basePath: '/bus-tracker',
    images: { unoptimized: true },
  }),
}

module.exports = nextConfig
