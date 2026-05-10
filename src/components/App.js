/**
 * App.js — 应用主框架
 *
 * 布局结构:
 *   +------------------------------------------+
 *   |  header (标题栏 + 主题切换 + API 设置)     |
 *   +------------------------------------------+
 *   |  main (内容区 — 根据当前视图动态渲染)      |
 *   |                                          |
 *   +------------------------------------------+
 *   |  navbar (底部导航栏)                      |
 *   +------------------------------------------+
 *
 * 导出 init() 函数，在 main.js 中调用启动应用。
 */

import { init as initNavbar } from './Navbar.js';
import { init as initInbox } from './Inbox.js';
import { getApiKey, saveApiKey, hasApiKey, getProviders, getSelectedProvider, saveProvider, getAllKeys, removeApiKey } from '../services/aiParser.js';

/** 当前活跃的视图名称 */
let currentView = 'inbox';

/** 各视图的初始化函数映射（后续步骤逐步替换占位为真实组件） */
const viewInitializers = {
  inbox: initInbox,
  requirements: null,   // 下一步实现
  taskOrders: null,     // 下一步实现
  todos: null,          // 下一步实现
};

/** 各视图的占位 DOM（当对应 initializer 尚未实现时使用） */
function renderPlaceholder(view) {
  const labels = {
    inbox: '收集箱',
    requirements: '需求',
    taskOrders: '任务单',
    todos: '待办',
  };

  return `
    <div class="view view--${view}">
      <div class="view__placeholder">
        <div class="view__placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        </div>
        <h2 class="view__title">${labels[view]}</h2>
        <p class="view__desc text-secondary">此模块将在后续步骤中实现</p>
      </div>
    </div>
  `;
}

/* ---- 纯 SVG 图标 ---- */
const ICONS = {
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
};

/** 渲染 API Key 设置模态框 */
function renderSettingsModal() {
  const providers = getProviders();
  const selectedProvider = getSelectedProvider();
  const allKeys = getAllKeys();

  // 编辑中的服务商（初始为当前选中）
  const editingProviderId = selectedProvider.id;
  const editingKey = allKeys[editingProviderId] || '';
  const maskedKey = editingKey
    ? '*'.repeat(Math.max(0, editingKey.length - 4)) + editingKey.slice(-4)
    : '';

  return `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal modal--wide">
        <div class="modal__header">
          <h3 class="modal__title">AI 解析设置</h3>
          <button class="btn-icon modal__close" id="modal-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal__body">
          <!-- 服务商列表 + Key 状态 -->
          <div class="form-group">
            <label class="form-label">模型服务商</label>
            <p class="form-hint">选择一个服务商进行编辑，下方输入框会切换对应 Key</p>
            <div class="provider-list" id="provider-list">
              ${providers.map((p) => {
                const hasKey = !!allKeys[p.id];
                const isActive = p.id === selectedProvider.id;
                const isEditing = p.id === editingProviderId;

                return `
                  <div class="provider-card
                    ${isActive ? 'provider-card--active' : ''}
                    ${isEditing ? 'provider-card--editing' : ''}"
                    data-provider="${p.id}">
                    <div class="provider-card__main">
                      <div class="provider-card__info">
                        <span class="provider-card__name">${p.name}</span>
                        <span class="provider-card__model">${p.model}</span>
                        ${isActive ? '<span class="provider-card__badge">当前使用</span>' : ''}
                      </div>
                      <div class="provider-card__status">
                        ${hasKey
                          ? `<span class="key-status key-status--ok" title="已配置 Key">●</span>`
                          : `<span class="key-status key-status--none" title="未配置 Key">○</span>`
                        }
                      </div>
                    </div>
                    <span class="provider-card__desc">${p.description}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- API Key 输入（对应正在编辑的服务商） -->
          <div class="form-group" style="margin-top: var(--space-lg);">
            <label class="form-label" for="input-api-key">
              API Key — <span id="key-editing-label">${providers.find(p => p.id === editingProviderId)?.name || ''}</span>
            </label>
            <p class="form-hint">密钥仅存储在浏览器本地，不会上传到任何第三方</p>
            <input
              type="password"
              class="form-input"
              id="input-api-key"
              placeholder="${editingKey ? maskedKey : '输入 API Key...'}"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="modal__footer">
          ${editingKey ? `<button class="btn btn--danger" id="btn-clear-key">清除此 Key</button>` : ''}
          <button class="btn btn--primary" id="btn-save-key">保存</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const app = document.querySelector('#app');

  /* ---- 构建整体骨架 ---- */
  app.innerHTML = `
    <header class="app-header">
      <h1 class="app-header__title">My Task</h1>
      <div class="app-header__actions">
        <button class="btn-icon" id="btn-settings" title="设置（API Key）">
          ${ICONS.settings}
        </button>
        <button class="btn-icon" id="btn-theme-toggle" title="切换深色/浅色主题">
          ${ICONS.sun}
        </button>
      </div>
    </header>

    <main class="app-main" id="app-main"></main>

    <footer class="app-navbar" id="app-navbar"></footer>
  `;

  /* ---- 引用元素 ---- */
  const mainEl = document.querySelector('#app-main');
  const navbarEl = document.querySelector('#app-navbar');
  const themeBtn = document.querySelector('#btn-theme-toggle');
  const settingsBtn = document.querySelector('#btn-settings');

  /* ---- 渲染当前视图 ---- */
  function switchView(view) {
    currentView = view;
    const initFn = viewInitializers[view];

    if (initFn) {
      mainEl.innerHTML = `<div class="view view--${view}"></div>`;
      initFn(mainEl.querySelector('.view'));
    } else {
      mainEl.innerHTML = renderPlaceholder(view);
    }
  }

  switchView(currentView);

  /* ---- 初始化导航栏 ---- */
  initNavbar(navbarEl);

  navbarEl.addEventListener('nav-change', (e) => {
    switchView(e.detail.view);
  });

  /* ---- 深色 / 浅色主题切换 ---- */
  const savedTheme = localStorage.getItem('mytask_theme');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  if (savedTheme) applyTheme(savedTheme);

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    let next;
    if (!current) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      next = prefersDark ? 'light' : 'dark';
    } else if (current === 'dark') {
      next = 'light';
    } else {
      next = 'dark';
    }
    applyTheme(next);
    localStorage.setItem('mytask_theme', next);
  });

  /* ---- 设置模态框 ---- */
  settingsBtn.addEventListener('click', () => {
    // 如果已存在模态框则先移除
    const existing = document.querySelector('#modal-overlay');
    if (existing) {
      existing.remove();
      return;
    }

    // 插入模态框到 app 容器外
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    modalContainer.innerHTML = renderSettingsModal();
    document.body.appendChild(modalContainer);

    const overlay = document.querySelector('#modal-overlay');
    const closeBtn = document.querySelector('#modal-close');
    const saveBtn = document.querySelector('#btn-save-key');
    const clearBtn = document.querySelector('#btn-clear-key');
    const inputEl = document.querySelector('#input-api-key');
    const providerList = document.querySelector('#provider-list');
    const keyEditingLabel = document.querySelector('#key-editing-label');

    // 当前正在编辑的服务商 ID 和对应的 Key
    let editingProviderId = getSelectedProvider().id;
    const allKeys = getAllKeys();
    let editingKey = allKeys[editingProviderId] || '';

    function closeModal() {
      modalContainer.remove();
    }

    /** 切换编辑目标，刷新输入框内容 */
    function switchEditing(providerId) {
      // 更新所有卡片的高亮状态
      providerList.querySelectorAll('.provider-card').forEach((card) => {
        card.classList.toggle('provider-card--editing', card.dataset.provider === providerId);
      });

      editingProviderId = providerId;
      const keys = getAllKeys();
      editingKey = keys[providerId] || '';

      // 更新 Key 输入框
      const masked = editingKey
        ? '*'.repeat(Math.max(0, editingKey.length - 4)) + editingKey.slice(-4)
        : '';
      inputEl.value = '';
      inputEl.placeholder = editingKey ? masked : '输入 API Key...';

      // 更新标签
      const provider = getProviders().find((p) => p.id === providerId);
      if (provider && keyEditingLabel) {
        keyEditingLabel.textContent = provider.name;
      }

      // 更新清除按钮可见性
      if (clearBtn) {
        clearBtn.style.display = editingKey ? '' : 'none';
      }

      inputEl.focus();
    }

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // 关闭按钮
    closeBtn.addEventListener('click', closeModal);

    // ESC 关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 点击服务商卡片 → 切换编辑目标
    providerList.addEventListener('click', (e) => {
      const card = e.target.closest('.provider-card');
      if (!card) return;

      const providerId = card.dataset.provider;
      if (providerId) {
        // 设置为当前使用的服务商
        saveProvider(providerId);
        // 更新 active 状态
        providerList.querySelectorAll('.provider-card').forEach((c) => {
          c.classList.toggle('provider-card--active', c.dataset.provider === providerId);
        });
        // 切换到编辑此服务商
        switchEditing(providerId);
      }
    });

    // 保存
    saveBtn.addEventListener('click', () => {
      const newKey = inputEl.value.trim();
      if (newKey) {
        saveApiKey(newKey, editingProviderId);
      }
      closeModal();
    });

    // Enter 保存
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });

    // 清除当前编辑中服务商的密钥
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        removeApiKey(editingProviderId);
        // 刷新模态框内容
        closeModal();
        settingsBtn.click();
      });
    }

    // 初始化清除按钮可见性
    if (clearBtn) {
      clearBtn.style.display = editingKey ? '' : 'none';
    }

    // 自动聚焦输入框
    setTimeout(() => inputEl.focus(), 100);
  });

  console.log('[App] 应用启动完成，当前视图:', currentView);
}
