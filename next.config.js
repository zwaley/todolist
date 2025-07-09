const withNextIntl = require('next-intl/plugin')(
  // 指向 i18n 配置文件的路径
  './src/i18n.ts'
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 实验性功能
  experimental: {
    // App Router 在 Next.js 13+ 中默认启用，无需配置
  },

  // 图片优化配置
  images: {
    // 允许的外部图片域名
    domains: [
      'localhost',
      // 如果使用 Supabase Storage，添加你的 Supabase 域名
      // 'your-project.supabase.co'
    ],
    // 图片格式优化
    formats: ['image/webp', 'image/avif'],
  },

  // 环境变量配置
  env: {
    // 自定义环境变量（如果需要）
  },

  // 重定向配置
  async redirects() {
    return [
      // 示例：重定向根路径到仪表板
      // {
      //   source: '/',
      //   destination: '/dashboard',
      //   permanent: false,
      // },
    ];
  },

  // 重写配置
  async rewrites() {
    return [
      // 示例：API 路由重写
      // {
      //   source: '/api/v1/:path*',
      //   destination: '/api/:path*',
      // },
    ];
  },

  // 头部配置
  async headers() {
    return [
      {
        // 为所有路由添加安全头部
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // 编译配置
  compiler: {
    // 移除 console.log（仅在生产环境）
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // TypeScript 配置
  typescript: {
    // 在构建时忽略 TypeScript 错误（不推荐，仅用于紧急部署）
    // ignoreBuildErrors: false,
  },

  // ESLint 配置
  eslint: {
    // 在构建时忽略 ESLint 错误（不推荐，仅用于紧急部署）
    // ignoreDuringBuilds: false,
  },

  // 输出配置
  // output: 'standalone', // 用于 Docker 部署（开发模式下注释掉）

  // 压缩配置
  compress: true,

  // 电源配置（用于性能优化）
  poweredByHeader: false,

  // 严格模式
  reactStrictMode: true,

  // SWC 最小化器在 Next.js 13+ 中默认启用
};

module.exports = withNextIntl(nextConfig);