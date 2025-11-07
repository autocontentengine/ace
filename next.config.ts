// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next 16: pacchetti con native bindings lato server
  serverExternalPackages: ['@resvg/resvg-js'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Cintura & bretelle: mantieni @resvg/resvg-js come external
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : []
      externals.push('@resvg/resvg-js')
      config.externals = externals

      // (Facoltativo) evita warning del watcher su file di sistema Windows
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray((config.watchOptions as any)?.ignored)
            ? ((config.watchOptions as any).ignored as any[])
            : []),
          'C:/pagefile.sys',
          'C:/swapfile.sys',
          'C:/DumpStack.log.tmp',
        ],
      }
    }
    return config
  },
}

export default nextConfig
