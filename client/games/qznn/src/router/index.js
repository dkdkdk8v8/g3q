import { createRouter, createWebHashHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'

const AutoConnect = () => import('../views/AutoConnect.vue');

const routes = [
  {
    path: '/',
    name: 'autoConnect',
    component: AutoConnect
  },
  {
    path: '/lobby',
    name: 'lobby',
    component: LobbyView
  },
  {
    path: '/game',
    name: 'game',
    component: GameView
  }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  next();
});

export default router
