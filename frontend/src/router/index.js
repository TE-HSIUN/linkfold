import { createRouter, createWebHistory } from 'vue-router';

import CreateLinkView from '../views/CreateLinkView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'create-link',
      component: CreateLinkView,
    },
  ],
});

export default router;
