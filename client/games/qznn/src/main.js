import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { useGameStore } from './stores/game.js' // Import game store

// 引入 Vant 样式
import 'vant/lib/index.css';
import './style.css'
import SpriteNumber from './components/SpriteNumber.vue';

const app = createApp(App)

app.component('SpriteNumber', SpriteNumber);

app.use(createPinia())
app.use(router)

// 强制从首页(Loading页面)开始，无论刷新前在哪个页面
router.replace('/')

// Initialize GameStore globally to register server push listeners immediately
const gameStore = useGameStore()

app.mount('#app')
