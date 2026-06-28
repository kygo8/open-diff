import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ClipboardCompareView from '@/views/ClipboardCompareView.vue'
import TextCompareView from '@/views/TextCompareView.vue'
import TextEditView from '@/views/TextEditView.vue'
import TextMergeView from '@/views/TextMergeView.vue'
import FolderCompareView from '@/views/FolderCompareView.vue'
import FolderMergeView from '@/views/FolderMergeView.vue'
import FolderSyncView from '@/views/FolderSyncView.vue'
import TableCompareView from '@/views/TableCompareView.vue'
import HexCompareView from '@/views/HexCompareView.vue'
import PictureCompareView from '@/views/PictureCompareView.vue'
import RegistryCompareView from '@/views/RegistryCompareView.vue'
import MediaCompareView from '@/views/MediaCompareView.vue'
import VersionCompareView from '@/views/VersionCompareView.vue'
import SettingsView from '@/views/SettingsView.vue'
import FileFormatView from '@/views/FileFormatView.vue'
import RemoteProfileView from '@/views/RemoteProfileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/compare/clipboard', name: 'clipboard-compare', component: ClipboardCompareView },
    { path: '/compare/text', name: 'text-compare', component: TextCompareView },
    { path: '/edit/text', name: 'text-edit', component: TextEditView },
    { path: '/merge/text', name: 'text-merge', component: TextMergeView },
    { path: '/compare/folder', name: 'folder-compare', component: FolderCompareView },
    { path: '/merge/folder', name: 'folder-merge', component: FolderMergeView },
    { path: '/sync/folder', name: 'folder-sync', component: FolderSyncView },
    { path: '/compare/table', name: 'table-compare', component: TableCompareView },
    { path: '/compare/hex', name: 'hex-compare', component: HexCompareView },
    { path: '/compare/picture', name: 'picture-compare', component: PictureCompareView },
    { path: '/compare/registry', name: 'registry-compare', component: RegistryCompareView },
    { path: '/compare/media', name: 'media-compare', component: MediaCompareView },
    { path: '/compare/version', name: 'version-compare', component: VersionCompareView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/settings/file-formats', name: 'file-formats', component: FileFormatView },
    { path: '/settings/remote-profiles', name: 'remote-profiles', component: RemoteProfileView },
  ],
})
