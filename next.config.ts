// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 👉 Next 16: chiave corretta (non più in experimental)
  serverExternalPackages: ['@resvg/resvg-js'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Cintura e bretelle: segnala comunque il pacchetto come external
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
