import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

// 重定向 /brnn 到 /brnn/，兼容不带尾部斜杠的访问
function trailingSlashPlugin() {
  return {
    name: 'trailing-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/brnn' || url.startsWith('/brnn?') || url.startsWith('/brnn#')) {
          const rest = url.slice('/brnn'.length)
          res.writeHead(301, { Location: '/brnn/' + rest })
          res.end()
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  return {
    base: '/brnn/',
    server: {
      host: '127.0.0.1',
      port: 5174,
    },
    plugins: [
      trailingSlashPlugin(),
      vue(),
      AutoImport({
        resolvers: [VantResolver()],
      }),
      Components({
        resolvers: [VantResolver()],
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../../components'),
      },
      dedupe: ['vue', 'pinia', 'vue-router', 'vant', 'howler', '@msgpack/msgpack'],
    },
    optimizeDeps: {
      include: ['howler', '@msgpack/msgpack'],
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  }
})
