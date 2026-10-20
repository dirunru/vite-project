import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import router from './router/index'
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";


import pinia from './stores'  //引入


const app = createApp(App)

app.use(router).use(ElementPlus).use(pinia).mount('#app')
