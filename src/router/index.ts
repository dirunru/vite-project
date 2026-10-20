import { createRouter, createWebHashHistory } from "vue-router";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/stockTrend",
    },
    {
      path: "/home",
      name: "home",
      component: () => import("@/views/home/index.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/login/index.vue"),
    },
    {
      path: "/table",
      name: "table",
      component: () => import("@/views/table/index.vue"),
    },
    {
      path: "/selectTags",
      name: "selectTags",
      component: () => import("@/views/selectTags/index.vue"),
    },
    {
      path: "/radio",
      name: "radio",
      component: () => import("@/views/radio/index.vue"),
    },
    {
      path: "/treeCheck",
      name: "treeCheck",
      component: () => import("@/views/treeCheck/index.vue"),
    },
    {
      path: "/pageList",
      name: "pageList",
      component: () => import("@/views/pageList/index.vue"),
    },
    {
      path: "/stockTrend",
      name: "stockTrend",
      component: () => import("@/views/stockTrend/index.vue"),
    },
  ],
});
export default router;
