import { createRouter, createWebHashHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'
const isDev = import.meta.env.DEV;

const routes = [
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

// Dev: LoadingPage as root; Prod: auto-connect entry
if (isDev) {
  const LoadingPage = () => import('../views/LoadingPage.vue');
  routes.unshift({
    path: '/',
    name: 'loading',
    component: LoadingPage
  });
} else {
  const AutoConnect = () => import('../views/AutoConnect.vue');
  routes.unshift({
    path: '/',
    name: 'autoConnect',
    component: AutoConnect
  });
}

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  next();
});

export default router
