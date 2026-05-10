/**
 * RequirementsTasks.js — 需求与任务（合并视图）
 *
 * 布局：顶部工具栏 + 左侧需求列表 + 右侧任务单面板
 * 全宽布局，工具栏置顶。
 */

import { requirementStore, taskOrderStore, inboxStore } from '../services/storage.js';
import { parse } from '../services/parser.js';
import { breakdownRequirement } from './Todos.js';

/* ---- SVG ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  archive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  unarchive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  unlink: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 3l-6.5 18.4c-.5 1.1-1.9 1.2-2.6.2L7 14l-7.6-4.9c-1-.7-.9-2.1.2-2.6L18 0"/></svg>`,
  chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronUp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const allReqs = requirementStore.getAll();
  const activeReqs = allReqs.filter((r) => r.status !== 'archived');
  const archivedReqs = allReqs.filter((r) => r.status === 'archived');
  const orders = taskOrderStore.getAll();

  container.innerHTML = `
    <div class="rt-view">

      <!-- ====== 置顶工具栏 ====== -->
      <div class="rt-toolbar">
        <div class="rt-toolbar__group">
          <input type="text" class="rt-toolbar__input" id="rt-req-input" placeholder="新建需求..." />
          <button class="btn btn--primary btn--sm" id="rt-req-add">${ICONS.plus} 添加需求</button>
        </div>
        <div class="rt-toolbar__group">
          <input type="text" class="rt-toolbar__input" id="rt-to-input" placeholder="新建任务单..." />
          <button class="btn btn--primary btn--sm" id="rt-to-add">${ICONS.plus} 创建任务单</button>
        </div>
      </div>

      <!-- ====== 双栏内容 ====== -->
      <div class="rt-content">

        <!-- 左侧：需求列表 -->
        <div class="rt-panel">
          <div class="rt-panel__header">
            <h3 class="rt-panel__title">需求 <span class="rt-panel__count">${activeReqs.length}</span></h3>
          </div>
          <div class="rt-panel__list" id="rt-req-list-active">
            ${activeReqs.length === 0
              ? '<div class="rt-panel__empty">暂无活跃需求</div>'
              : activeReqs.map((r) => renderReqCard(r)).join('')}
          </div>
          ${archivedReqs.length > 0 ? `
            <div class="rt-panel__subheader">已归档 (${archivedReqs.length})</div>
            <div class="rt-panel__list" id="rt-req-list-archived">
              ${archivedReqs.map((r) => renderReqCard(r)).join('')}
            </div>
          ` : ''}
        </div>

        <!-- 右侧：任务单列表 -->
        <div class="rt-panel">
          <div class="rt-panel__header">
            <h3 class="rt-panel__title">任务单 <span class="rt-panel__count">${orders.length}</span></h3>
          </div>
          <div class="rt-panel__list" id="rt-to-list">
            ${orders.length === 0
              ? '<div class="rt-panel__empty">暂无任务单</div>'
              : orders.map((o) => renderToCard(o)).join('')}
          </div>
        </div>

      </div>
    </div>
  `;
}

/* ---- 需求卡片 ---- */
function renderReqCard(req) {
  return `
    <div class="rt-req-item" data-id="${req.id}">
      <div class="rt-req-item__main">
        <div class="rt-req-item__title" id="rt-req-title-${req.id}">${escapeHtml(req.title)}</div>
      </div>
      <div class="rt-req-item__actions">
        <button class="btn-icon btn-icon--sm rt-req-item__breakdown" data-id="${req.id}" title="拆解为待办">${ICONS.plus}</button>
        <button class="btn-icon btn-icon--sm rt-req-item__edit" data-id="${req.id}" title="编辑">${ICONS.edit}</button>
        ${req.status === 'archived'
          ? `<button class="btn-icon btn-icon--sm rt-req-item__unarchive" data-id="${req.id}" title="激活">${ICONS.unarchive}</button>`
          : `<button class="btn-icon btn-icon--sm rt-req-item__archive" data-id="${req.id}" title="归档">${ICONS.archive}</button>`
        }
        <button class="btn-icon btn-icon--sm rt-req-item__delete" data-id="${req.id}" title="删除">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

/* ---- 任务单卡片 ---- */
function renderToCard(order) {
  const linkedReqs = order.requirementIds
    .map((id) => requirementStore.getById(id))
    .filter(Boolean);
  const availableReqs = requirementStore
    .getAll()
    .filter((r) => r.status !== 'archived' && !order.requirementIds.includes(r.id));

  return `
    <div class="rt-to-item" data-id="${order.id}">
      <div class="rt-to-item__header">
        <span class="rt-to-item__name" id="rt-to-name-${order.id}">${escapeHtml(order.name)}</span>
        <span class="rt-to-item__count">${linkedReqs.length}</span>
        <div class="rt-to-item__actions">
          <button class="btn-icon btn-icon--sm rt-to-item__edit" data-id="${order.id}" title="编辑">${ICONS.edit}</button>
          <button class="btn-icon btn-icon--sm rt-to-item__toggle" data-id="${order.id}" title="展开">${ICONS.chevronDown}</button>
          <button class="btn-icon btn-icon--sm rt-to-item__delete" data-id="${order.id}" title="删除">${ICONS.trash}</button>
        </div>
      </div>
      <div class="rt-to-item__body" id="rt-to-body-${order.id}">
        <div class="rt-to-item__reqs" id="rt-to-reqs-${order.id}">
          ${linkedReqs.length === 0
            ? '<div class="rt-to-item__empty-req">暂无关联需求</div>'
            : linkedReqs.map((r) => `
              <div class="rt-to-item__req">
                <span>${escapeHtml(r.title)}</span>
                <button class="btn-icon btn-icon--sm rt-to-item__unlink" data-id="${order.id}" data-req-id="${r.id}" title="移除">${ICONS.unlink}</button>
              </div>
            `).join('')}
        </div>
        ${availableReqs.length > 0 ? `
          <div class="rt-to-item__link-row">
            <select class="rt-to-item__select" id="rt-select-${order.id}">
              <option value="">关联需求...</option>
              ${availableReqs.map((r) => `<option value="${r.id}">${escapeHtml(r.title)}</option>`).join('')}
            </select>
            <button class="btn btn--sm btn--primary rt-to-item__link-btn" data-id="${order.id}">${ICONS.link}</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/* ================================================================== */
/*  逻辑                                                               */
/* ================================================================== */

function refresh() {
  const container = document.querySelector('.rt-view');
  if (container) {
    render(container);
    bindEvents();
  }
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  // ---- 新建需求 ----
  const reqInput = document.querySelector('#rt-req-input');
  const reqAddBtn = document.querySelector('#rt-req-add');
  function addReq() {
    const v = reqInput.value.trim();
    if (!v) return;
    requirementStore.add({ title: v });
    reqInput.value = '';
    reqInput.focus();
    refresh();
  }
  reqAddBtn?.addEventListener('click', addReq);
  reqInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addReq(); }
  });

  // ---- 新建任务单 ----
  const toInput = document.querySelector('#rt-to-input');
  const toAddBtn = document.querySelector('#rt-to-add');
  function addTo() {
    const v = toInput.value.trim();
    if (!v) return;
    taskOrderStore.add({ name: v });
    toInput.value = '';
    toInput.focus();
    refresh();
  }
  toAddBtn?.addEventListener('click', addTo);
  toInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTo(); }
  });

  // ---- 需求：编辑 ----
  document.querySelectorAll('.rt-req-item__edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const titleEl = document.querySelector(`#rt-req-title-${id}`);
      const current = requirementStore.getById(id);
      if (!titleEl || !current) return;

      titleEl.innerHTML = `<input type="text" class="rt-inline-input" value="${escapeHtml(current.title)}" id="rt-req-edit-${id}" />`;
      const inp = titleEl.querySelector('input');
      inp.focus(); inp.select();
      function save() {
        const v = inp.value.trim();
        if (v && v !== current.title) requirementStore.update(id, { title: v });
        refresh();
      }
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { inp.value = current.title; save(); }
      });
    });
  });

  // ---- 需求：归档/激活 ----
  document.querySelectorAll('.rt-req-item__archive').forEach((b) => {
    b.addEventListener('click', () => { requirementStore.update(b.dataset.id, { status: 'archived' }); refresh(); });
  });
  document.querySelectorAll('.rt-req-item__unarchive').forEach((b) => {
    b.addEventListener('click', () => { requirementStore.update(b.dataset.id, { status: 'active' }); refresh(); });
  });

  // ---- 需求：删除 ----
  document.querySelectorAll('.rt-req-item__delete').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('确认删除此需求？')) return;
      requirementStore.remove(b.dataset.id);
      refresh();
    });
  });

  // ---- 需求：拆解为待办 ----
  document.querySelectorAll('.rt-req-item__breakdown').forEach((b) => {
    b.addEventListener('click', () => {
      const req = requirementStore.getById(b.dataset.id);
      if (req) breakdownRequirement(req);
    });
  });

  // ---- 任务单：编辑 ----
  document.querySelectorAll('.rt-to-item__edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const nameEl = document.querySelector(`#rt-to-name-${id}`);
      const current = taskOrderStore.getById(id);
      if (!nameEl || !current) return;
      nameEl.innerHTML = `<input type="text" class="rt-inline-input" value="${escapeHtml(current.name)}" id="rt-to-edit-${id}" />`;
      const inp = nameEl.querySelector('input');
      inp.focus(); inp.select();
      function save() {
        const v = inp.value.trim();
        if (v && v !== current.name) taskOrderStore.update(id, { name: v });
        refresh();
      }
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { inp.value = current.name; save(); }
      });
    });
  });

  // ---- 任务单：展开/收起 ----
  document.querySelectorAll('.rt-to-item__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const body = document.querySelector(`#rt-to-body-${id}`);
      if (!body) return;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      btn.innerHTML = open ? ICONS.chevronDown : ICONS.chevronUp;
    });
  });

  // ---- 任务单：关联需求 ----
  document.querySelectorAll('.rt-to-item__link-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const sel = document.querySelector(`#rt-select-${id}`);
      if (!sel || !sel.value) return;
      const order = taskOrderStore.getById(id);
      if (!order) return;
      taskOrderStore.update(id, { requirementIds: [...order.requirementIds, sel.value] });
      refresh();
    });
  });

  // ---- 任务单：移除关联 ----
  document.querySelectorAll('.rt-to-item__unlink').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const reqId = btn.dataset.reqId;
      const order = taskOrderStore.getById(id);
      if (!order) return;
      taskOrderStore.update(id, { requirementIds: order.requirementIds.filter((rid) => rid !== reqId) });
      refresh();
    });
  });

  // ---- 任务单：删除 ----
  document.querySelectorAll('.rt-to-item__delete').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('确认删除此任务单？')) return;
      taskOrderStore.remove(b.dataset.id);
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

/** 暴露转换函数供 Inbox 使用 */
export { breakdownRequirement } from './Todos.js';

export function convertFromInbox(inboxItem) {
  const parsed = parse(inboxItem.content);
  requirementStore.add({
    title: parsed.title || inboxItem.content,
    sourceInboxId: inboxItem.id,
  });
}
