/**
 * Requirements.js — 需求管理
 *
 * 功能:
 *   1. 需求列表（分为"活跃"和"已归档"两组）
 *   2. 手动新建需求（标题输入 + 添加按钮）
 *   3. 从收集箱条目转化（由 Inbox 调用或外部触发）
 *   4. 行内编辑、归档/激活、删除
 */

import { requirementStore, inboxStore } from '../services/storage.js';
import { parse } from '../services/parser.js';
import { breakdownRequirement } from './Todos.js';

/* ---- SVG 图标 ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  archive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  unarchive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  inbox: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** 查找需求对应的收集箱原文 */
function getSourceContent(sourceInboxId) {
  if (!sourceInboxId) return null;
  const item = inboxStore.getById(sourceInboxId);
  return item ? item.content : null;
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const all = requirementStore.getAll();
  const active = all.filter((r) => r.status !== 'archived');
  const archived = all.filter((r) => r.status === 'archived');

  container.innerHTML = `
    <div class="req-view">

      <!-- 新建需求 -->
      <div class="req-view__add-bar">
        <input
          type="text"
          class="req-view__input"
          id="req-input"
          placeholder="输入需求标题，Enter 添加"
        />
        <button class="btn btn--primary" id="req-btn-add">${ICONS.plus} 添加</button>
      </div>

      <!-- 活跃需求 -->
      <div class="req-view__section">
        <h3 class="req-view__section-title">活跃需求 (${active.length})</h3>
        <div class="req-view__list" id="req-list-active">
          ${active.length === 0
            ? `<div class="req-view__empty">暂无活跃需求</div>`
            : active.map((r) => renderCard(r)).join('')
          }
        </div>
      </div>

      <!-- 已归档需求 -->
      ${archived.length > 0 ? `
        <div class="req-view__section">
          <h3 class="req-view__section-title">已归档 (${archived.length})</h3>
          <div class="req-view__list" id="req-list-archived">
            ${archived.map((r) => renderCard(r)).join('')}
          </div>
        </div>
      ` : `<div class="req-view__section" id="req-section-archived" style="display:none;"></div>`}
    </div>
  `;
}

function renderCard(req) {
  const source = getSourceContent(req.sourceInboxId);

  return `
    <div class="req-card" data-id="${req.id}">
      <div class="req-card__main">
        <div class="req-card__title" id="req-title-${req.id}">${escapeHtml(req.title)}</div>
        ${source ? `
          <div class="req-card__source" title="来自收集箱">
            ${ICONS.inbox} <span class="truncate">${escapeHtml(source)}</span>
          </div>
        ` : ''}
      </div>
      <div class="req-card__actions">
        <button class="btn btn--sm req-card__breakdown" data-id="${req.id}" title="拆解为待办事项">
          ${ICONS.plus} 拆解待办
        </button>
        <button class="btn-icon btn-icon--sm req-card__edit" data-id="${req.id}" title="编辑标题">${ICONS.edit}</button>
        ${req.status === 'archived'
          ? `<button class="btn-icon btn-icon--sm req-card__unarchive" data-id="${req.id}" title="激活">${ICONS.unarchive}</button>`
          : `<button class="btn-icon btn-icon--sm req-card__archive" data-id="${req.id}" title="归档">${ICONS.archive}</button>`
        }
        <button class="btn-icon btn-icon--sm req-card__delete" data-id="${req.id}" title="删除">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

/* ================================================================== */
/*  逻辑                                                               */
/* ================================================================== */

function refresh() {
  const container = document.querySelector('.req-view');
  if (container) {
    render(container);
    bindEvents();
  }
}

function addRequirement(title) {
  const trimmed = title.trim();
  if (!trimmed) return;
  requirementStore.add({ title: trimmed });
  refresh();
}

/** 将收集箱条目转化为需求 */
export function convertFromInbox(inboxItem) {
  // 使用 parser 提取标题
  const parsed = parse(inboxItem.content);
  const title = parsed.title || inboxItem.content;
  requirementStore.add({
    title,
    sourceInboxId: inboxItem.id,
  });
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  const input = document.querySelector('#req-input');
  const addBtn = document.querySelector('#req-btn-add');

  // 新建
  function handleAdd() {
    if (!input.value.trim()) return;
    addRequirement(input.value);
    input.value = '';
    input.focus();
  }

  addBtn?.addEventListener('click', handleAdd);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  });

  // 编辑
  document.querySelectorAll('.req-card__edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const titleEl = document.querySelector(`#req-title-${id}`);
      if (!titleEl) return;

      const current = requirementStore.getById(id);
      if (!current) return;

      // 切换为输入框
      titleEl.innerHTML = `
        <input
          type="text"
          class="req-card__title-input"
          value="${escapeHtml(current.title)}"
          id="req-edit-input-${id}"
        />
      `;
      const inp = titleEl.querySelector('input');
      inp.focus();
      inp.select();

      function saveEdit() {
        const newTitle = inp.value.trim();
        if (newTitle && newTitle !== current.title) {
          requirementStore.update(id, { title: newTitle });
        }
        refresh();
      }

      inp.addEventListener('blur', saveEdit);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEdit();
        }
        if (e.key === 'Escape') {
          inp.value = current.title;
          saveEdit();
        }
      });
    });
  });

  // 归档
  document.querySelectorAll('.req-card__archive').forEach((btn) => {
    btn.addEventListener('click', () => {
      requirementStore.update(btn.dataset.id, { status: 'archived' });
      refresh();
    });
  });

  // 激活
  document.querySelectorAll('.req-card__unarchive').forEach((btn) => {
    btn.addEventListener('click', () => {
      requirementStore.update(btn.dataset.id, { status: 'active' });
      refresh();
    });
  });

  // 拆解为待办
  document.querySelectorAll('.req-card__breakdown').forEach((btn) => {
    btn.addEventListener('click', () => {
      const req = requirementStore.getById(btn.dataset.id);
      if (req) {
        breakdownRequirement(req);
      }
    });
  });

  // 删除
  document.querySelectorAll('.req-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('确认删除此需求？关联的待办事项不会自动删除。')) return;
      requirementStore.remove(btn.dataset.id);
      refresh();
    });
  });
}

/* ================================================================== */
/*  初始化                                                             */
/* ================================================================== */

export function init(container) {
  render(container);
  bindEvents();
}
