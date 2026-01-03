import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router/index.js'
import { useGameStore } from './stores/game.js' // Import game store

// 引入 Vant 样式
import 'vant/lib/index.css';

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Initialize GameStore globally to register server push listeners immediately
const gameStore = useGameStore()

app.mount('#app')
