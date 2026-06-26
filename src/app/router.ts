import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TextCompareView from '@/views/TextCompareView.vue'
import SettingsView from '@/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/compare/text', name: 'text-compare', component: TextCompareView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
