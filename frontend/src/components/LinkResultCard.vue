<script setup>
import { ref } from 'vue';

defineProps({
  result: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['create-another']);

const shortUrlInput = ref(null);
const copyMessage = ref('短網址已建立。');

async function copyShortUrl(result) {
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(result.shortUrl);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    shortUrlInput.value?.select();

    try {
      copied = Boolean(
        shortUrlInput.value &&
          document.execCommand('copy'),
      );
    } catch {
      copied = false;
    }
  }

  copyMessage.value = copied
    ? '短網址已複製。'
    : '複製失敗，請選取上方短網址後手動複製。';
}
</script>

<template>
  <section
    class="mt-10 rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-8"
    data-testid="result-card"
    aria-labelledby="result-heading"
  >
    <div
      class="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <p class="text-sm font-semibold text-teal-700">
          建立完成
        </p>
        <h2
          id="result-heading"
          class="mt-1 text-2xl font-semibold text-slate-950"
        >
          你的短網址已經準備好了
        </h2>
      </div>
      <div class="flex flex-wrap gap-2 text-sm font-semibold">
        <span
          data-testid="enabled-status"
          class="rounded-full px-3 py-1.5"
          :class="
            result.enabled
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-800'
          "
        >
          {{ result.enabled ? '已啟用' : '已停用' }}
        </span>
        <span
          data-testid="protection-status"
          class="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700"
        >
          {{
            result.passwordProtected
              ? '已啟用密碼保護'
              : '未設定密碼保護'
          }}
        </span>
      </div>
    </div>

    <div class="mt-6">
      <label
        class="mb-2 block text-sm font-semibold text-slate-700"
        for="created-short-url"
      >
        短網址
      </label>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          id="created-short-url"
          ref="shortUrlInput"
          class="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-950 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
          data-testid="short-url"
          type="text"
          :value="result.shortUrl"
          readonly
        >
        <button
          class="min-h-12 rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          type="button"
          data-action="copy"
          @click="copyShortUrl(result)"
        >
          複製短網址
        </button>
        <a
          v-if="result.enabled"
          class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition hover:border-teal-500 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          data-action="open"
          :href="result.shortUrl"
          target="_blank"
          rel="noreferrer"
        >
          開啟連結
        </a>
      </div>
    </div>

    <dl class="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
      <div class="min-w-0">
        <dt class="text-xs font-semibold tracking-wide text-slate-500">
          原始網址
        </dt>
        <dd class="mt-1 break-all text-sm text-slate-800">
          {{ result.originalUrl }}
        </dd>
      </div>
      <div v-if="result.note">
        <dt class="text-xs font-semibold tracking-wide text-slate-500">
          備註
        </dt>
        <dd class="mt-1 whitespace-pre-wrap text-sm text-slate-800">
          {{ result.note }}
        </dd>
      </div>
    </dl>

    <p
      v-if="!result.enabled"
      class="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      此短網址目前無法開啟，且 MVP 尚無法重新啟用。
    </p>

    <div
      class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p
        class="text-sm text-slate-600"
        data-testid="result-live"
        aria-live="polite"
        role="status"
      >
        {{ copyMessage }}
      </p>
      <button
        class="rounded-2xl px-5 py-3 font-semibold text-teal-800 transition hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        type="button"
        data-action="create-another"
        @click="emit('create-another')"
      >
        建立另一個
      </button>
    </div>
  </section>
</template>
