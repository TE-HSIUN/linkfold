<script setup>
import { computed, nextTick, reactive, ref } from 'vue';

import {
  createLink,
  fetchPageMetadata,
} from '../services/api.js';

const emit = defineEmits(['created']);

const CUSTOM_CODE_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])$/;
const RESERVED_CODES = new Set(['api', 'health']);
const API_ERROR_FIELDS = {
  INVALID_URL: 'originalUrl',
  INVALID_SHORT_CODE: 'shortCode',
  SHORT_CODE_TAKEN: 'shortCode',
  INVALID_NOTE: 'note',
  INVALID_PASSWORD: 'password',
  INVALID_ENABLED: 'enabled',
};

const form = reactive({
  originalUrl: '',
  shortCode: '',
  password: '',
  note: '',
  enabled: true,
});
const errors = reactive({});
const originalUrlInput = ref(null);
const shortCodeInput = ref(null);
const passwordInput = ref(null);
const noteInput = ref(null);
const enabledInput = ref(null);
const showPassword = ref(false);
const isSubmitting = ref(false);
const formMessage = ref('');
const isFetchingMetadata = ref(false);
const metadataCandidate = ref('');
const metadataMessage = ref('');

const fieldRefs = {
  originalUrl: originalUrlInput,
  shortCode: shortCodeInput,
  password: passwordInput,
  note: noteInput,
  enabled: enabledInput,
};

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const isOriginalUrlValid = computed(() =>
  isHttpUrl(form.originalUrl),
);

function clearErrors() {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  formMessage.value = '';
}

function validate() {
  clearErrors();

  if (!isOriginalUrlValid.value) {
    errors.originalUrl = '請輸入完整的 http 或 https 網址';
  }

  if (
    form.shortCode !== '' &&
    (!CUSTOM_CODE_PATTERN.test(form.shortCode) ||
      RESERVED_CODES.has(form.shortCode))
  ) {
    errors.shortCode =
      '自訂短碼須為 4–32 個小寫英數或連字號，且頭尾不可為連字號';
  }

  if (
    form.password !== '' &&
    (form.password.length < 8 || form.password.length > 128)
  ) {
    errors.password = '密碼須為 8–128 個字元';
  }

  if (form.note.length > 500) {
    errors.note = '備註不可超過 500 個字元';
  }

  return Object.keys(errors);
}

async function focusFirstError(errorFields) {
  if (errorFields.length === 0) {
    return;
  }

  await nextTick();
  fieldRefs[errorFields[0]]?.value?.focus();
}

function buildPayload() {
  const payload = {
    originalUrl: form.originalUrl.trim(),
    enabled: form.enabled,
  };

  if (form.shortCode !== '') {
    payload.shortCode = form.shortCode;
  }

  if (form.note !== '') {
    payload.note = form.note;
  }

  if (form.password !== '') {
    payload.password = form.password;
  }

  return payload;
}

function combineMetadata({ title, description }) {
  const parts = [title, description]
    .filter((part) => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join('\n').slice(0, 500);
}

async function handleMetadata() {
  if (!isOriginalUrlValid.value || isFetchingMetadata.value) {
    return;
  }

  isFetchingMetadata.value = true;
  metadataCandidate.value = '';
  metadataMessage.value = '';

  try {
    const metadata = await fetchPageMetadata(
      form.originalUrl.trim(),
    );
    const nextNote = combineMetadata(metadata);

    if (nextNote === '') {
      metadataMessage.value = '找不到可用的頁面資訊，仍可直接建立短網址。';
      return;
    }

    if (form.note === '') {
      form.note = nextNote;
      metadataMessage.value = '已將頁面資訊填入備註。';
      return;
    }

    metadataCandidate.value = nextNote;
    metadataMessage.value =
      '已保留原有備註；若要改用抓取結果，請選擇取代。';
  } catch {
    metadataMessage.value =
      '無法取得頁面資訊，仍可保留目前內容並建立短網址。';
  } finally {
    isFetchingMetadata.value = false;
  }
}

function replaceNoteWithMetadata() {
  if (metadataCandidate.value === '') {
    return;
  }

  form.note = metadataCandidate.value;
  metadataCandidate.value = '';
  metadataMessage.value = '已用頁面資訊取代備註。';
}

async function handleSubmit() {
  if (isSubmitting.value) {
    return;
  }

  const errorFields = validate();

  if (errorFields.length > 0) {
    await focusFirstError(errorFields);
    return;
  }

  isSubmitting.value = true;

  try {
    const result = await createLink(buildPayload());

    emit('created', result);
  } catch (error) {
    const apiError = error?.response?.data?.error;
    const field = API_ERROR_FIELDS[apiError?.code];

    if (field) {
      errors[field] =
        apiError.message || '這個欄位無法使用，請確認後再試。';
      await focusFirstError([field]);
    } else if (error?.request && !error?.response) {
      formMessage.value = '無法連上服務，請檢查網路後再試。';
    } else {
      formMessage.value = '建立失敗，請稍後再試。';
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <form
    class="mt-10 rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-8"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
      <div class="md:col-span-6">
        <label
          class="mb-2 block text-sm font-semibold text-slate-800"
          for="original-url"
        >
          完整網址
        </label>
        <input
          id="original-url"
          ref="originalUrlInput"
          v-model="form.originalUrl"
          class="w-full rounded-2xl border bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
          :class="
            errors.originalUrl
              ? 'border-rose-400'
              : 'border-slate-200'
          "
          type="url"
          inputmode="url"
          autocomplete="url"
          placeholder="https://example.com/your-long-link"
          :aria-invalid="Boolean(errors.originalUrl)"
          :aria-describedby="
            errors.originalUrl ? 'original-url-error' : undefined
          "
        >
        <p
          v-if="errors.originalUrl"
          id="original-url-error"
          class="mt-2 text-sm text-rose-700"
        >
          {{ errors.originalUrl }}
        </p>
      </div>

      <div class="md:col-span-3">
        <label
          class="mb-2 block text-sm font-semibold text-slate-800"
          for="short-code"
        >
          自訂短碼
          <span class="font-normal text-slate-400">（選填）</span>
        </label>
        <div
          class="flex rounded-2xl border bg-white transition focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10"
          :class="
            errors.shortCode ? 'border-rose-400' : 'border-slate-200'
          "
        >
          <span
            class="flex items-center border-r border-slate-200 px-3 text-sm text-slate-400"
            aria-hidden="true"
          >
            /
          </span>
          <input
            id="short-code"
            ref="shortCodeInput"
            v-model="form.shortCode"
            class="min-w-0 flex-1 rounded-r-2xl px-3 py-3 text-slate-950 outline-none"
            type="text"
            autocomplete="off"
            maxlength="32"
            placeholder="my-docs"
            :aria-invalid="Boolean(errors.shortCode)"
            :aria-describedby="
              errors.shortCode ? 'short-code-error' : undefined
            "
          >
        </div>
        <p
          v-if="errors.shortCode"
          id="short-code-error"
          class="mt-2 text-sm text-rose-700"
        >
          {{ errors.shortCode }}
        </p>
      </div>

      <div class="md:col-span-3">
        <label
          class="mb-2 block text-sm font-semibold text-slate-800"
          for="password"
        >
          密碼
          <span class="font-normal text-slate-400">（選填）</span>
        </label>
        <div
          class="flex rounded-2xl border bg-white transition focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10"
          :class="
            errors.password ? 'border-rose-400' : 'border-slate-200'
          "
        >
          <input
            id="password"
            ref="passwordInput"
            v-model="form.password"
            class="min-w-0 flex-1 rounded-l-2xl px-4 py-3 text-slate-950 outline-none"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            maxlength="128"
            placeholder="至少 8 個字元"
            :aria-invalid="Boolean(errors.password)"
            :aria-describedby="
              errors.password ? 'password-error' : undefined
            "
          >
          <button
            class="rounded-r-2xl px-4 text-slate-500 transition hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            type="button"
            data-action="toggle-password"
            :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
            @click="showPassword = !showPassword"
          >
            <svg
              aria-hidden="true"
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle
                cx="12"
                cy="12"
                r="3"
              />
            </svg>
          </button>
        </div>
        <p
          v-if="errors.password"
          id="password-error"
          class="mt-2 text-sm text-rose-700"
        >
          {{ errors.password }}
        </p>
      </div>

      <div class="md:col-span-12">
        <div
          class="mb-2 flex flex-wrap items-center justify-between gap-3"
        >
          <label
            class="text-sm font-semibold text-slate-800"
            for="note"
          >
            備註
            <span class="font-normal text-slate-400">（選填）</span>
          </label>
          <button
            class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            data-action="metadata"
            :disabled="!isOriginalUrlValid || isFetchingMetadata"
            @click="handleMetadata"
          >
            {{ isFetchingMetadata ? '取得中…' : '取得頁面資訊' }}
          </button>
        </div>
        <textarea
          id="note"
          ref="noteInput"
          v-model="form.note"
          class="min-h-32 w-full resize-y rounded-2xl border bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
          :class="errors.note ? 'border-rose-400' : 'border-slate-200'"
          maxlength="500"
          placeholder="寫下一段只有你在建立結果中會看見的說明"
          :aria-invalid="Boolean(errors.note)"
          :aria-describedby="errors.note ? 'note-error' : 'note-count'"
        />
        <div class="mt-2 flex justify-between gap-4">
          <p
            v-if="errors.note"
            id="note-error"
            class="text-sm text-rose-700"
          >
            {{ errors.note }}
          </p>
          <span
            v-else
            aria-hidden="true"
          />
          <p
            id="note-count"
            data-testid="note-count"
            class="text-sm tabular-nums text-slate-400"
          >
            {{ form.note.length }} / 500
          </p>
        </div>
        <div
          v-if="metadataMessage"
          class="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900"
          aria-live="polite"
        >
          <p>{{ metadataMessage }}</p>
          <button
            v-if="metadataCandidate"
            class="font-semibold underline decoration-teal-400 underline-offset-4"
            type="button"
            data-action="replace-metadata"
            @click="replaceNoteWithMetadata"
          >
            以頁面資訊取代
          </button>
        </div>
      </div>
    </div>

    <div
      class="mt-7 flex flex-col gap-5 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <label
          class="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800"
          for="enabled"
        >
          <input
            id="enabled"
            ref="enabledInput"
            v-model="form.enabled"
            class="size-5 rounded border-slate-300 accent-teal-700"
            type="checkbox"
            :aria-invalid="Boolean(errors.enabled)"
            :aria-describedby="
              errors.enabled ? 'enabled-error' : undefined
            "
          >
          建立後立即啟用
        </label>
        <p
          v-if="errors.enabled"
          id="enabled-error"
          class="mt-2 text-sm text-rose-700"
        >
          {{ errors.enabled }}
        </p>
        <p
          v-if="!form.enabled"
          class="mt-2 max-w-xl text-sm text-amber-700"
        >
          此版本建立後尚無法重新啟用，短網址將回傳找不到。
        </p>
      </div>

      <button
        class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-7 py-3 font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? '建立中…' : '建立短網址' }}
      </button>
    </div>

    <p
      v-if="formMessage"
      data-testid="form-message"
      class="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
      role="alert"
    >
      {{ formMessage }}
    </p>
    <p
      class="sr-only"
      data-testid="creation-status"
      aria-live="polite"
      role="status"
    >
      {{ isSubmitting ? '正在建立短網址，請稍候。' : '' }}
    </p>
  </form>
</template>
