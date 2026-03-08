import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 重定向 /bjlnn 到 /bjlnn/，兼容不带尾部斜杠的访问
function trailingSlashPlugin() {
  return {
    name: 'trailing-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/bjlnn' || url.startsWith('/bjlnn?') || url.startsWith('/bjlnn#')) {
          const rest = url.slice('/bjlnn'.length)
          res.writeHead(301, { Location: '/bjlnn/' + rest })
          res.end()
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/bjlnn/',
  plugins: [trailingSlashPlugin(), vue(), tailwindcss()],
})
