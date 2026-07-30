<script setup>
import { ref } from 'vue';

import LinkCreationForm from '../components/LinkCreationForm.vue';
import LinkResultCard from '../components/LinkResultCard.vue';

const createdLink = ref(null);

function resetCreation() {
  createdLink.value = null;
}
</script>

<template>
  <main
    class="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.12),_transparent_32rem)] px-4 py-10 sm:px-6 sm:py-16"
  >
    <div class="mx-auto max-w-6xl">
      <header class="max-w-3xl">
        <p
          class="text-sm font-semibold tracking-[0.24em] text-teal-700"
        >
          LINKFOLD
        </p>
        <h1
          class="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
        >
          把冗長連結，摺成剛好的長度。
        </h1>
        <p class="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
          建立容易分享的短網址，視需要加入備註、自訂短碼與密碼保護。
        </p>
      </header>

      <LinkCreationForm
        v-if="!createdLink"
        @created="createdLink = $event"
      />
      <LinkResultCard
        v-else
        :result="createdLink"
        @create-another="resetCreation"
      />
    </div>
  </main>
</template>
