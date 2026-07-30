import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLink, fetchPageMetadata } from '../services/api.js';
import CreateLinkView from '../views/CreateLinkView.vue';

vi.mock('../services/api.js', () => ({
  createLink: vi.fn(),
  fetchPageMetadata: vi.fn(),
}));

const SUCCESS_RESULT = {
  shortCode: 'docs-2026',
  shortUrl: 'http://localhost:3000/docs-2026',
  originalUrl: 'https://example.com/docs',
  note: null,
  passwordProtected: false,
  enabled: true,
  createdAt: '2026-07-29T10:00:00.000Z',
};

function mountView() {
  return mount(CreateLinkView, {
    attachTo: document.body,
  });
}

async function submit(wrapper) {
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

async function enterValidUrl(wrapper) {
  await wrapper
    .get('#original-url')
    .setValue('https://example.com/docs');
}

describe('CreateLinkView 表單', () => {
  beforeEach(() => {
    createLink.mockResolvedValue(SUCCESS_RESULT);
    fetchPageMetadata.mockResolvedValue({
      title: '',
      description: '',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete navigator.clipboard;
    document.body.innerHTML = '';
  });

  it('顯示所有有 label 的欄位、metadata 與建立按鈕', () => {
    const wrapper = mountView();

    expect(wrapper.get('label[for="original-url"]').text()).toContain(
      '完整網址',
    );
    expect(wrapper.get('label[for="short-code"]').text()).toContain(
      '自訂短碼',
    );
    expect(wrapper.get('label[for="password"]').text()).toContain(
      '密碼',
    );
    expect(wrapper.get('label[for="note"]').text()).toContain('備註');
    expect(wrapper.get('label[for="enabled"]').text()).toContain(
      '啟用',
    );
    expect(wrapper.get('#enabled').element.checked).toBe(true);
    expect(wrapper.get('[data-testid="note-count"]').text()).toBe(
      '0 / 500',
    );
    expect(
      wrapper.get('button[data-action="metadata"]').attributes(
        'disabled',
      ),
    ).toBeDefined();
    expect(wrapper.get('button[type="submit"]').text()).toContain(
      '建立短網址',
    );
  });

  it('密碼按鈕可切換顯示並更新 accessible name', async () => {
    const wrapper = mountView();
    const password = wrapper.get('#password');
    const toggle = wrapper.get('button[data-action="toggle-password"]');

    expect(password.attributes('type')).toBe('password');
    expect(toggle.attributes('aria-label')).toBe('顯示密碼');

    await toggle.trigger('click');

    expect(password.attributes('type')).toBe('text');
    expect(toggle.attributes('aria-label')).toBe('隱藏密碼');
  });

  it('空白選填欄位不進入 payload 且 enabled 固定為 boolean', async () => {
    const wrapper = mountView();

    await wrapper.get('#original-url').setValue('https://example.com/docs');
    await submit(wrapper);

    expect(createLink).toHaveBeenCalledTimes(1);
    expect(createLink).toHaveBeenCalledWith({
      originalUrl: 'https://example.com/docs',
      enabled: true,
    });
  });

  it.each([
    {
      shortCode: 'a1-b',
      password: '12345678',
      note: '備'.repeat(500),
    },
    {
      shortCode: `a${'b'.repeat(30)}z`,
      password: 'p'.repeat(128),
      note: '',
    },
  ])('接受合法最小與最大邊界 %#', async (values) => {
    const wrapper = mountView();

    await wrapper.get('#original-url').setValue('http://example.com/docs');
    await wrapper.get('#short-code').setValue(values.shortCode);
    await wrapper.get('#password').setValue(values.password);
    await wrapper.get('#note').setValue(values.note);
    await submit(wrapper);

    const expectedPayload = {
      originalUrl: 'http://example.com/docs',
      shortCode: values.shortCode,
      password: values.password,
      enabled: true,
    };

    if (values.note) {
      expectedPayload.note = values.note;
    }

    expect(createLink).toHaveBeenCalledWith(expectedPayload);
  });

  it('網址錯誤時不送出並 focus 第一個錯誤欄位', async () => {
    const wrapper = mountView();

    await wrapper.get('#original-url').setValue('not-a-url');
    await submit(wrapper);

    expect(createLink).not.toHaveBeenCalled();
    expect(wrapper.get('#original-url-error').text()).toContain(
      'http',
    );
    expect(wrapper.get('#original-url').attributes('aria-describedby')).toBe(
      'original-url-error',
    );
    expect(document.activeElement).toBe(
      wrapper.get('#original-url').element,
    );
  });

  it.each([
    ['abc', '#short-code-error'],
    ['a'.repeat(33), '#short-code-error'],
    ['Project-docs', '#short-code-error'],
    ['health', '#short-code-error'],
    ['1234567', '#password-error', 'password'],
    ['p'.repeat(129), '#password-error', 'password'],
    ['備'.repeat(501), '#note-error', 'note'],
  ])('拒絕非法邊界值 %#', async (value, errorSelector, field = 'short-code') => {
    const wrapper = mountView();

    await wrapper.get('#original-url').setValue('https://example.com/docs');
    await wrapper.get(`#${field}`).setValue(value);
    await submit(wrapper);

    expect(createLink).not.toHaveBeenCalled();
    expect(wrapper.get(errorSelector).text()).not.toBe('');
  });

  it('metadata 將標題與說明填入空白備註', async () => {
    fetchPageMetadata.mockResolvedValue({
      title: 'Example Docs',
      description: 'Reference guide',
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    const metadataButton = wrapper.get(
      'button[data-action="metadata"]',
    );
    expect(metadataButton.attributes('disabled')).toBeUndefined();

    await metadataButton.trigger('click');
    await flushPromises();

    expect(fetchPageMetadata).toHaveBeenCalledWith(
      'https://example.com/docs',
    );
    expect(wrapper.get('#note').element.value).toBe(
      'Example Docs\nReference guide',
    );
  });

  it('metadata 不覆蓋既有備註，須明確點擊取代', async () => {
    fetchPageMetadata.mockResolvedValue({
      title: 'Example Docs',
      description: 'Reference guide',
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper.get('#note').setValue('我的原始備註');
    await wrapper
      .get('button[data-action="metadata"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('#note').element.value).toBe('我的原始備註');
    expect(wrapper.text()).toContain('已保留原有備註');

    await wrapper
      .get('button[data-action="replace-metadata"]')
      .trigger('click');

    expect(wrapper.get('#note').element.value).toBe(
      'Example Docs\nReference guide',
    );
  });

  it('metadata 組合結果限制為 500 字元', async () => {
    fetchPageMetadata.mockResolvedValue({
      title: 'T'.repeat(300),
      description: 'D'.repeat(300),
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper
      .get('button[data-action="metadata"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.get('#note').element.value).toHaveLength(500);
    expect(wrapper.get('#note').element.value).toBe(
      `${'T'.repeat(300)}\n${'D'.repeat(199)}`,
    );
    expect(wrapper.get('[data-testid="note-count"]').text()).toBe(
      '500 / 500',
    );
  });

  it.each([
    {
      metadataResult: { title: '', description: '' },
      expectedMessage: '找不到可用的頁面資訊',
    },
    {
      metadataError: new Error('metadata unavailable'),
      expectedMessage: '無法取得頁面資訊',
    },
  ])(
    'metadata 空結果或錯誤不阻斷建立 %#',
    async ({ metadataResult, metadataError, expectedMessage }) => {
      if (metadataError) {
        fetchPageMetadata.mockRejectedValue(metadataError);
      } else {
        fetchPageMetadata.mockResolvedValue(metadataResult);
      }
      const wrapper = mountView();

      await enterValidUrl(wrapper);
      await wrapper.get('#note').setValue('保留這段內容');
      await wrapper
        .get('button[data-action="metadata"]')
        .trigger('click');
      await flushPromises();

      expect(wrapper.get('#note').element.value).toBe('保留這段內容');
      expect(wrapper.text()).toContain(expectedMessage);
      expect(
        wrapper.get('button[type="submit"]').attributes('disabled'),
      ).toBeUndefined();

      await submit(wrapper);
      expect(createLink).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['INVALID_URL', '#original-url', '#original-url-error'],
    ['INVALID_SHORT_CODE', '#short-code', '#short-code-error'],
    ['SHORT_CODE_TAKEN', '#short-code', '#short-code-error'],
    ['INVALID_NOTE', '#note', '#note-error'],
    ['INVALID_PASSWORD', '#password', '#password-error'],
    ['INVALID_ENABLED', '#enabled', '#enabled-error'],
  ])(
    '將後端 %s 錯誤關聯並聚焦至對應欄位',
    async (code, selector, errorSelector) => {
      createLink.mockRejectedValue({
        response: {
          status: code === 'SHORT_CODE_TAKEN' ? 409 : 400,
          data: {
            error: {
              code,
              message: `後端回傳 ${code}`,
            },
          },
        },
      });
      const wrapper = mountView();

      await enterValidUrl(wrapper);
      await wrapper.get('#short-code').setValue('docs-2026');
      await wrapper.get('#password').setValue('password123');
      await wrapper.get('#note').setValue('保留所有輸入');
      await submit(wrapper);

      expect(wrapper.get(selector).element.value).not.toBe('');
      expect(wrapper.get(errorSelector).text()).toContain(code);
      expect(document.activeElement).toBe(
        wrapper.get(selector).element,
      );
      expect(wrapper.get('#note').element.value).toBe('保留所有輸入');
    },
  );

  it('網路錯誤顯示可重試表單訊息並保留輸入', async () => {
    createLink.mockRejectedValue({
      request: {},
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper.get('#short-code').setValue('docs-2026');
    await wrapper.get('#note').setValue('不能被清空');
    await submit(wrapper);

    expect(wrapper.get('[data-testid="form-message"]').text()).toContain(
      '請檢查網路後再試',
    );
    expect(wrapper.get('#original-url').element.value).toBe(
      'https://example.com/docs',
    );
    expect(wrapper.get('#short-code').element.value).toBe('docs-2026');
    expect(wrapper.get('#note').element.value).toBe('不能被清空');
  });

  it('pending 期間只送出一次並透過 live region 顯示狀態', async () => {
    let resolveCreation;
    createLink.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreation = resolve;
        }),
    );
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper.get('form').trigger('submit');
    await wrapper.get('form').trigger('submit');

    expect(createLink).toHaveBeenCalledTimes(1);
    expect(wrapper.get('button[type="submit"]').text()).toContain(
      '建立中',
    );
    expect(wrapper.get('[data-testid="creation-status"]').text()).toContain(
      '正在建立短網址',
    );

    resolveCreation(SUCCESS_RESULT);
    await flushPromises();
  });

  it('enabled 結果顯示完整資料、copy、open 與建立另一個', async () => {
    createLink.mockResolvedValue({
      ...SUCCESS_RESULT,
      passwordProtected: true,
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper.get('#password').setValue('password123');
    await submit(wrapper);

    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.get('[data-testid="short-url"]').element.value).toBe(
      SUCCESS_RESULT.shortUrl,
    );
    expect(wrapper.get('[data-testid="result-card"]').text()).toContain(
      SUCCESS_RESULT.originalUrl,
    );
    expect(wrapper.get('[data-testid="enabled-status"]').text()).toContain(
      '已啟用',
    );
    expect(
      wrapper.get('[data-testid="protection-status"]').text(),
    ).toContain('密碼保護');
    expect(wrapper.get('button[data-action="copy"]').exists()).toBe(true);
    expect(wrapper.get('a[data-action="open"]').attributes('href')).toBe(
      SUCCESS_RESULT.shortUrl,
    );
    expect(
      wrapper.get('button[data-action="create-another"]').exists(),
    ).toBe(true);
  });

  it('disabled 結果可複製但不可開啟，並說明無法重新啟用', async () => {
    createLink.mockResolvedValue({
      ...SUCCESS_RESULT,
      enabled: false,
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await wrapper.get('#enabled').setValue(false);
    await submit(wrapper);

    expect(wrapper.get('[data-testid="enabled-status"]').text()).toContain(
      '已停用',
    );
    expect(wrapper.find('a[data-action="open"]').exists()).toBe(false);
    expect(wrapper.get('button[data-action="copy"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('無法重新啟用');
  });

  it('複製成功時寫入 Clipboard 並透過 live region 回饋', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await submit(wrapper);
    await wrapper.get('button[data-action="copy"]').trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(SUCCESS_RESULT.shortUrl);
    expect(wrapper.get('[data-testid="result-live"]').text()).toContain(
      '已複製',
    );
  });

  it('Clipboard 失敗時保留可選取短網址並顯示 fallback', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await submit(wrapper);
    await wrapper.get('button[data-action="copy"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="short-url"]').element.value).toBe(
      SUCCESS_RESULT.shortUrl,
    );
    expect(wrapper.get('[data-testid="result-live"]').text()).toContain(
      '複製失敗',
    );
  });

  it('建立另一個會清除結果並回到空白表單', async () => {
    const wrapper = mountView();

    await enterValidUrl(wrapper);
    await submit(wrapper);
    await wrapper
      .get('button[data-action="create-another"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="result-card"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('#original-url').element.value).toBe('');
    expect(wrapper.get('#enabled').element.checked).toBe(true);
  });
});
