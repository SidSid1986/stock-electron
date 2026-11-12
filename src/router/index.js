import { createWebHashHistory, createRouter } from "vue-router";
import { ElMessage } from "element-plus";

const routes = [
  {
    path: "/",
    redirect: { name: "Load" },
  },
  {
    path: "/load",
    name: "Load",
    component: () => import("@/views/load.vue"),
    meta: {
      requiresAuth: false,
      roles: ["admin", "user", "super_admin"],
    },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0, left: 0 };
  },
});

export default router;
