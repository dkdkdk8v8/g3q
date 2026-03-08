import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import path from 'path' // Need to import path

// 重定向 /qznn 到 /qznn/，兼容不带尾部斜杠的访问
function trailingSlashPlugin() {
  return {
    name: 'trailing-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/qznn' || url.startsWith('/qznn?') || url.startsWith('/qznn#')) {
          const rest = url.slice('/qznn'.length)
          res.writeHead(301, { Location: '/qznn/' + rest })
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
    base: '/qznn/',
    server: {
      host: '127.0.0.1',
      port: 5173,
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
      // 让 @shared 下的代码能从当前项目的 node_modules 解析依赖
      dedupe: ['vue', 'pinia', 'vue-router', 'vant', 'howler', '@msgpack/msgpack'],
    },
    // 确保共享组件目录中的裸模块引用能找到当前项目的 node_modules
    optimizeDeps: {
      include: ['howler', '@msgpack/msgpack'],
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  }
})

