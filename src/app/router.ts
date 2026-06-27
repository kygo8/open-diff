import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TextCompareView from '@/views/TextCompareView.vue'
import FolderCompareView from '@/views/FolderCompareView.vue'
import FolderSyncView from '@/views/FolderSyncView.vue'
import TableCompareView from '@/views/TableCompareView.vue'
import SettingsView from '@/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/compare/text', name: 'text-compare', component: TextCompareView },
    { path: '/compare/folder', name: 'folder-compare', component: FolderCompareView },
    { path: '/sync/folder', name: 'folder-sync', component: FolderSyncView },
    { path: '/compare/table', name: 'table-compare', component: TableCompareView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
