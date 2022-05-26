import { createApp } from 'vue'
import App from './App.vue'
import { VividTyping } from 'vivid-typing'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const app = createApp(App)
app.component('vivid-typing', VividTyping)
app.mount('#app')
