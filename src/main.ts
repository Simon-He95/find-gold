import { createApp } from 'vue'
import { VividTyping } from 'vivid-typing'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import 'uno.css'
import 'vivid-typing/style.css'
import './styles/main.css'

const app = createApp(App)
app.component('VividTyping', VividTyping)
app.mount('#app')
