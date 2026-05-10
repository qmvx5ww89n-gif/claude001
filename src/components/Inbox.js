/**
 * Inbox.js — 收集箱组件
 *
 * 功能:
 *   1. 多行文本输入框 + 添加按钮（Ctrl/Cmd+Enter 提交）
 *   2. "从剪贴板读取" 按钮
 *   3. "AI 智能解析" 按钮 — 支持从聊天对话批量提取任务
 *   4. 规则引擎实时解析预览
 *   5. 收集箱条目列表：展示、删除
 */

import { inboxStore } from '../services/storage.js';
import { parse } from '../services/parser.js';
import { aiParse, hasApiKey } from '../services/aiParser.js';

/** 当前规则解析结果 */
let currentParsed = null;
/** 当前 AI 解析结果（含 tasks 数组） */
let currentAiResult = null;
/** AI 是否正在解析中 */
let isAiLoading = false;

/* ---- 纯 SVG 图标 ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  clipboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>`,
  sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L21 9l-5 4.8 1.8 7.2-6-3.6-6 3.6L7.6 13.8 2 9l6.6.2L12 2z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  tag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  note: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  loader: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6" class="spinner__line"/><line x1="12" y1="18" x2="12" y2="22" class="spinner__line"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" class="spinner__line"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" class="spinner__line"/><line x1="2" y1="12" x2="6" y2="12" class="spinner__line"/><line x1="18" y1="12" x2="22" y2="12" class="spinner__line"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" class="spinner__line"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" class="spinner__line"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

/* ================================================================== */
/*  渲染函数                                                          */
/* ================================================================== */

/** 渲染整个收集箱页面 */
function render(container) {
  const items = inboxStore.getAll();

  container.innerHTML = `
    <div class="inbox">

      <!-- 输入区域 -->
      <div class="inbox__input-area">
        <div class="inbox__input-row">
          <textarea
            class="inbox__textarea"
            id="inbox-input"
            placeholder="输入任务内容，支持多行文本或粘贴聊天记录&#10;例如：&#10;张三：明天下午3点把报告交了&#10;李四：好的，周五之前给你反馈&#10;&#10;Ctrl+Enter 添加到收集箱"
            rows="3"
            autofocus
          ></textarea>
        </div>
        <div class="inbox__textarea-actions">
          <button class="btn btn--sm btn--ghost" id="inbox-btn-clear-text" title="清空输入框">清空文本</button>
        </div>

        <!-- 操作按钮行 -->
        <div class="inbox__actions-row">
          <button class="inbox__clipboard-btn" id="inbox-btn-clipboard">
            ${ICONS.clipboard}
            <span>从剪贴板读取</span>
          </button>
          <button class="inbox__ai-btn" id="inbox-btn-ai" title="使用大模型智能解析任务文本">
            ${ICONS.sparkle}
            <span>AI 智能解析</span>
          </button>
          <button class="btn btn--primary" id="inbox-btn-add" title="添加到收集箱 (Ctrl+Enter)">
            ${ICONS.plus} <span>添加</span>
          </button>
        </div>

        <!-- 规则引擎解析预览 -->
        <div class="inbox__preview" id="inbox-preview" style="display:none;"></div>

        <!-- AI 解析结果面板 -->
        <div class="inbox__ai-panel" id="inbox-ai-panel" style="display:none;"></div>
      </div>

      <!-- 条目列表 -->
      <div class="inbox__list" id="inbox-list">
        ${items.length === 0
          ? `<div class="inbox__empty">
               <p class="text-secondary">收集箱为空</p>
               <p class="text-tertiary">在上方输入内容或粘贴聊天记录，点击 AI 智能解析</p>
             </div>`
          : items.map((item) => renderItem(item)).join('')
        }
      </div>

    </div>
  `;
}

/** 渲染单条收集箱条目 */
function renderItem(item) {
  const parsed = parse(item.content);
  const hasMeta = parsed.dateLabel || parsed.timeLabel;

  return `
    <div class="inbox-item" data-id="${item.id}">
      <div class="inbox-item__content">
        <p class="inbox-item__text">${escapeHtml(item.content)}</p>
        ${hasMeta ? `
          <div class="inbox-item__meta">
            ${parsed.dateLabel ? `<span class="inbox-item__tag tag--date">${ICONS.calendar} ${parsed.dateLabel}</span>` : ''}
            ${parsed.timeLabel ? `<span class="inbox-item__tag tag--time">${ICONS.clock} ${parsed.timeLabel}</span>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="inbox-item__actions">
        <span class="inbox-item__source" title="来源: ${item.source}">${sourceLabel(item.source)}</span>
        <button class="btn-icon btn-icon--sm inbox-item__delete" data-id="${item.id}" title="删除">
          ${ICONS.trash}
        </button>
      </div>
    </div>
  `;
}

/** 渲染规则引擎解析预览 */
function renderPreview(parsed) {
  const el = document.querySelector('#inbox-preview');
  if (!el) return;

  if (!parsed || (!parsed.dateLabel && !parsed.timeLabel)) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="preview__title">规则引擎识别</div>
    <div class="preview__body">
      <div class="preview__row">
        <span class="preview__label">标题</span>
        <span class="preview__value">${escapeHtml(parsed.title) || '—'}</span>
      </div>
      ${parsed.dateLabel ? `
        <div class="preview__row">
          <span class="preview__label">日期</span>
          <span class="preview__value preview__value--date">${ICONS.calendar} ${parsed.dateLabel} → ${parsed.recognizedDate}</span>
        </div>
      ` : ''}
      ${parsed.timeLabel ? `
        <div class="preview__row">
          <span class="preview__label">时间</span>
          <span class="preview__value preview__value--time">${ICONS.clock} ${parsed.timeLabel} → ${parsed.recognizedTime}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/** 渲染 AI 解析结果面板（支持多任务） */
function renderAiPanel(state, resultOrError) {
  const el = document.querySelector('#inbox-ai-panel');
  if (!el) return;
  el.style.display = 'block';

  // 加载中
  if (state === 'loading') {
    el.innerHTML = `
      <div class="ai-panel__loading">
        <span class="spinner">${ICONS.loader}</span>
        <span>AI 正在分析文本...</span>
      </div>
    `;
    return;
  }

  // 出错
  if (state === 'error') {
    const msg = resultOrError || '未知错误';
    el.innerHTML = `
      <div class="ai-panel__error">
        <span class="ai-panel__error-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </span>
        <span>${escapeHtml(msg)}</span>
      </div>
    `;
    return;
  }

  // 成功 — 多任务列表
  if (state === 'success' && resultOrError) {
    const tasks = resultOrError.tasks || [];
    const providerInfo = resultOrError.providerName
      ? `${resultOrError.providerName} / ${resultOrError.model}`
      : 'AI';

    const priorityLabels = { high: '高', medium: '中', low: '低' };

    if (tasks.length === 0) {
      el.innerHTML = `
        <div class="ai-panel__error">未识别到任务</div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="ai-panel">
        <div class="ai-panel__header">
          <span class="ai-panel__badge">${ICONS.sparkle} AI 解析结果</span>
          <span class="ai-panel__meta">识别到 <strong>${tasks.length}</strong> 个任务 · ${escapeHtml(providerInfo)}</span>
        </div>
        <div class="ai-panel__body">
          <div class="ai-task-list" id="ai-task-list">
            ${tasks.map((t, i) => `
              <label class="ai-task-item" data-index="${i}">
                <input type="checkbox" class="ai-task-item__check" checked />
                <div class="ai-task-item__content">
                  <div class="ai-task-item__title">
                    ${t.person ? `<span class="ai-person-badge">${escapeHtml(t.person)}</span> ` : ''}${escapeHtml(t.title)}
                  </div>
                  <div class="ai-task-item__meta">
                    ${t.recognizedDate ? `<span class="inbox-item__tag tag--date">${ICONS.calendar} ${t.recognizedDate}</span>` : ''}
                    ${t.recognizedTime ? `<span class="inbox-item__tag tag--time">${ICONS.clock} ${t.recognizedTime}</span>` : ''}
                    <span class="ai-priority ai-priority--${t.priority}">${priorityLabels[t.priority] || t.priority}</span>
                    ${t.tags && t.tags.length > 0 ? t.tags.map(tg => `<span class="ai-tag">${escapeHtml(tg)}</span>`).join(' ') : ''}
                  </div>
                  ${t.notes ? `<div class="ai-task-item__notes text-secondary">${escapeHtml(t.notes)}</div>` : ''}
                </div>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="ai-panel__footer">
          <button class="btn btn--sm btn--ghost" id="ai-btn-discard">忽略</button>
          <button class="btn btn--sm btn--ghost" id="ai-btn-toggle">全不选</button>
          <button class="btn btn--sm btn--primary" id="ai-btn-add-all">
            ${ICONS.check} 添加选中 (${tasks.length})
          </button>
        </div>
      </div>
    `;

    // 绑定按钮事件
    bindAiPanelEvents(tasks);
  }
}

/** 绑定 AI 面板按钮 */
function bindAiPanelEvents(tasks) {
  const checkboxes = document.querySelectorAll('.ai-task-item__check');
  const btnAddAll = document.querySelector('#ai-btn-add-all');
  const btnToggle = document.querySelector('#ai-btn-toggle');
  const btnDiscard = document.querySelector('#ai-btn-discard');

  function updateCount() {
    const checked = document.querySelectorAll('.ai-task-item__check:checked');
    const count = checked.length;
    if (btnAddAll) {
      btnAddAll.innerHTML = `${ICONS.check} 添加选中 (${count})`;
    }
    if (btnToggle) {
      const allChecked = count === tasks.length;
      btnToggle.textContent = allChecked ? '全不选' : '全选';
    }
  }

  // 单个 checkbox 变化
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', updateCount);
  });

  // 全选/全不选切换
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const allChecked = document.querySelectorAll('.ai-task-item__check:checked').length === tasks.length;
      checkboxes.forEach((cb) => { cb.checked = !allChecked; });
      updateCount();
    });
  }

  // 添加选中
  if (btnAddAll) {
    btnAddAll.addEventListener('click', () => {
      let added = 0;
      tasks.forEach((t, i) => {
        const cb = document.querySelector(`.ai-task-item[data-index="${i}"] .ai-task-item__check`);
        if (cb && cb.checked) {
          const content = buildTaskContent(t);
          inboxStore.add({ content, source: 'ai' });
          added++;
        }
      });
      if (added > 0) {
        refreshList();
        clearInput();
      }
    });
  }

  // 忽略
  if (btnDiscard) {
    btnDiscard.addEventListener('click', () => {
      hideAiPanel();
    });
  }
}

/** 将单个 AI 任务转为收集箱条目文本 */
function buildTaskContent(t) {
  const parts = [];
  if (t.person) parts.push(`【${t.person}】`);
  parts.push(t.title);
  if (t.recognizedDate) parts.push(t.recognizedDate);
  if (t.recognizedTime) parts.push(t.recognizedTime);
  if (t.tags && t.tags.length > 0) parts.push(`[${t.tags.join(', ')}]`);
  return parts.join(' | ');
}

/* ================================================================== */
/*  逻辑                                                               */
/* ================================================================== */

function sourceLabel(source) {
  const map = { manual: '手动', clipboard: '剪贴板', cli: 'CLI', ai: 'AI' };
  return map[source] || source;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** 隐藏 AI 面板 */
function hideAiPanel() {
  const el = document.querySelector('#inbox-ai-panel');
  if (el) el.style.display = 'none';
  currentAiResult = null;
}

/** 添加条目到收集箱并刷新列表 */
function addItem(content, source = 'manual') {
  const trimmed = content.trim();
  if (!trimmed) return;

  inboxStore.add({ content: trimmed, source });
  refreshList();
  clearInput();
}

/** 刷新列表区域 */
function refreshList() {
  const listEl = document.querySelector('#inbox-list');
  if (!listEl) return;

  const items = inboxStore.getAll();
  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="inbox__empty">
        <p class="text-secondary">收集箱为空</p>
        <p class="text-tertiary">在上方输入内容或粘贴聊天记录，点击 AI 智能解析</p>
      </div>
    `;
  } else {
    listEl.innerHTML = items.map((item) => renderItem(item)).join('');
  }
}

/** 仅清空预览面板，保留输入框内容以便回看 */
function clearInput() {
  const preview = document.querySelector('#inbox-preview');
  if (preview) preview.style.display = 'none';
  hideAiPanel();
  currentParsed = null;
}

/** 触发 AI 解析 */
async function triggerAiParse() {
  const input = document.querySelector('#inbox-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();

  if (!hasApiKey()) {
    renderAiPanel('error', '请先在设置中配置 API Key（点击右上角齿轮图标）');
    return;
  }

  isAiLoading = true;
  renderAiPanel('loading');

  try {
    const result = await aiParse(text);
    currentAiResult = result;
    renderAiPanel('success', result);
  } catch (err) {
    let message = 'AI 解析失败，请稍后重试';
    if (err.message === 'INVALID_API_KEY') {
      message = 'API Key 无效，请在设置中重新配置';
    } else if (err.message === 'NO_API_KEY') {
      message = '请先在设置中配置 API Key';
    } else if (err.message.startsWith('PARSE_ERROR')) {
      message = 'AI 返回结果格式异常，请重试';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      message = '网络请求失败，请检查网络连接';
    }
    renderAiPanel('error', message);
  } finally {
    isAiLoading = false;
  }
}

/* ================================================================== */
/*  初始化                                                             */
/* ================================================================== */

export function init(container) {
  render(container);

  const textarea = document.querySelector('#inbox-input');
  const addBtn = document.querySelector('#inbox-btn-add');
  const clipboardBtn = document.querySelector('#inbox-btn-clipboard');
  const aiBtn = document.querySelector('#inbox-btn-ai');
  const clearTextBtn = document.querySelector('#inbox-btn-clear-text');
  const listEl = document.querySelector('#inbox-list');

  /* ---- 手动添加（Ctrl/Cmd+Enter） ---- */
  function handleAdd() {
    addItem(textarea.value, 'manual');
  }

  addBtn.addEventListener('click', handleAdd);

  /* ---- 清空输入框 ---- */
  clearTextBtn.addEventListener('click', () => {
    textarea.value = '';
    textarea.style.height = 'auto';
    textarea.focus();
    const preview = document.querySelector('#inbox-preview');
    if (preview) preview.style.display = 'none';
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
  });

  /* ---- 自动调整高度 ---- */
  textarea.addEventListener('input', () => {
    // 自适应高度
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';

    // 规则引擎预览（只对第一行做快速解析）
    const firstLine = textarea.value.split('\n')[0] || '';
    const parsed = parse(firstLine);
    currentParsed = parsed;
    renderPreview(parsed);
  });

  /* ---- 从剪贴板读取 ---- */
  clipboardBtn.addEventListener('click', async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        textarea.value = clipText.trim();
        textarea.focus();
        // 触发自适应高度和解析
        textarea.dispatchEvent(new Event('input'));
      }
    } catch {
      alert('无法访问剪贴板，请手动粘贴内容（Ctrl+V / Cmd+V）到输入框中。');
    }
  });

  /* ---- AI 智能解析 ---- */
  aiBtn.addEventListener('click', () => {
    triggerAiParse();
  });

  /* ---- 列表操作：删除 ---- */
  listEl.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.inbox-item__delete');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    if (id) {
      inboxStore.remove(id);
      refreshList();
    }
  });
}
