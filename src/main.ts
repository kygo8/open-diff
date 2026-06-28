import { createApp } from 'vue'
import naive from 'naive-ui'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import { router } from './app/router'
import { createAppI18n, installI18n } from './i18n'
import './styles/main.css'

const app = createApp(App)
const i18n = createAppI18n(localStorage.getItem('open-diff-locale'))

app.use(createPinia())
app.use(naive)
installI18n(app, i18n)
app.use(router)
app.mount('#app')
