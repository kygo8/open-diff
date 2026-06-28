import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TextCompareView from '@/views/TextCompareView.vue'
import TextMergeView from '@/views/TextMergeView.vue'
import FolderCompareView from '@/views/FolderCompareView.vue'
import FolderMergeView from '@/views/FolderMergeView.vue'
import FolderSyncView from '@/views/FolderSyncView.vue'
import TableCompareView from '@/views/TableCompareView.vue'
import HexCompareView from '@/views/HexCompareView.vue'
import PictureCompareView from '@/views/PictureCompareView.vue'
import SettingsView from '@/views/SettingsView.vue'
import FileFormatView from '@/views/FileFormatView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/compare/text', name: 'text-compare', component: TextCompareView },
    { path: '/merge/text', name: 'text-merge', component: TextMergeView },
    { path: '/compare/folder', name: 'folder-compare', component: FolderCompareView },
    { path: '/merge/folder', name: 'folder-merge', component: FolderMergeView },
    { path: '/sync/folder', name: 'folder-sync', component: FolderSyncView },
    { path: '/compare/table', name: 'table-compare', component: TableCompareView },
    { path: '/compare/hex', name: 'hex-compare', component: HexCompareView },
    { path: '/compare/picture', name: 'picture-compare', component: PictureCompareView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/settings/file-formats', name: 'file-formats', component: FileFormatView },
  ],
})
