import { createRouter, createWebHistory } from 'vue-router'
import PedalboardView from '@/views/PedalboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'pedalboard',
      component: PedalboardView,
    },
  ],
})

export default router
