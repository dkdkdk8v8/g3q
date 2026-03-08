import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import path from 'path' // Need to import path

export default defineConfig(({ mode }) => {
  return {
    base: '/qznn/',
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    plugins: [
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

