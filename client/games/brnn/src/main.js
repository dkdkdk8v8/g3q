import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'

// 引入 Vant 样式
import 'vant/lib/index.css';
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 强制从首页(Loading页面)开始，无论刷新前在哪个页面
router.replace('/')

app.mount('#app')
