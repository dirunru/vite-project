import {createRouter,createWebHashHistory} from 'vue-router'
const router=createRouter({
    history:createWebHashHistory(),
    routes:[
        {
            path:"/",
            alias: '/home',
            name:'home',
            component:()=>import ('@/views/home/index.vue')
        },
        {
            path:"/login",
            name:'login',
            component:()=>import ('@/views/login/index.vue')
        }
    ]
})
export default router
