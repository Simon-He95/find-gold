import { VividTyping } from 'vivid-typing'
import { createApp } from 'vue'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import 'uno.css'
import 'vivid-typing/dist/index.css'
import './styles/main.css'

const app = createApp(App)
app.component('VividTyping', VividTyping)
app.mount('#app')
