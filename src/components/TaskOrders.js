/**
 * TaskOrders.js — 任务单管理
 *
 * 一个任务单可以聚合多个需求，方便按项目/批次组织。
 *
 * 功能:
 *   1. 任务单列表
 *   2. 新建任务单（命名 + 选择关联需求）
 *   3. 编辑任务单名称
 *   4. 管理任务单内的需求关联（添加/移除）
 *   5. 删除任务单
 */

import { taskOrderStore, requirementStore } from '../services/storage.js';

/* ---- SVG 图标 ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  unlink: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 3l-6.5 18.4c-.5 1.1-1.9 1.2-2.6.2L7 14l-7.6-4.9c-1-.7-.9-2.1.2-2.6L18 0"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronUp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** 根据 ID 列表查找需求标题 */
function getRequirementTitles(requirementIds) {
  return requirementIds
    .map((id) => {
      const req = requirementStore.getById(id);
      return req ? { id, title: req.title } : null;
    })
    .filter(Boolean);
}

/** 获取所有未关联到指定任务单的活跃需求 */
function getAvailableRequirements(excludeIds) {
  return requirementStore
    .getAll()
    .filter((r) => r.status !== 'archived' && !excludeIds.includes(r.id));
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const orders = taskOrderStore.getAll();

  container.innerHTML = `
    <div class="to-view">

      <!-- 新建任务单 -->
      <div class="to-view__add-bar">
        <input
          type="text"
          class="to-view__input"
          id="to-input"
          placeholder="输入任务单名称，Enter 创建"
        />
        <button class="btn btn--primary" id="to-btn-add">${ICONS.plus} 创建</button>
      </div>

      <!-- 任务单列表 -->
      <div class="to-view__list" id="to-list">
        ${orders.length === 0
          ? `<div class="to-view__empty">暂无任务单，在上方创建第一个</div>`
          : orders.map((o) => renderCard(o)).join('')
        }
      </div>
    </div>
  `;
}

function renderCard(order) {
  const linkedReqs = getRequirementTitles(order.requirementIds);
  const availableReqs = getAvailableRequirements(order.requirementIds);

  return `
    <div class="to-card" data-id="${order.id}">
      <div class="to-card__header">
        <div class="to-card__title" id="to-title-${order.id}">${escapeHtml(order.name)}</div>
        <div class="to-card__count">${linkedReqs.length} 个需求</div>
        <div class="to-card__actions">
          <button class="btn-icon btn-icon--sm to-card__edit" data-id="${order.id}" title="编辑名称">${ICONS.edit}</button>
          <button class="btn-icon btn-icon--sm to-card__toggle" data-id="${order.id}" title="展开/收起">${ICONS.chevronDown}</button>
          <button class="btn-icon btn-icon--sm to-card__delete" data-id="${order.id}" title="删除任务单">${ICONS.trash}</button>
        </div>
      </div>

      <!-- 关联需求列表 -->
      <div class="to-card__body" id="to-body-${order.id}">
        <div class="to-card__req-list" id="to-req-list-${order.id}">
          ${linkedReqs.length === 0
            ? `<div class="to-card__req-empty">暂无关联需求，点击下方按钮添加</div>`
            : linkedReqs.map((r) => `
              <div class="to-card__req-item" data-req-id="${r.id}">
                <span class="to-card__req-title">${escapeHtml(r.title)}</span>
                <button class="btn-icon btn-icon--sm to-card__unlink" data-id="${order.id}" data-req-id="${r.id}" title="移除关联">${ICONS.unlink}</button>
              </div>
            `).join('')
          }
        </div>

        <!-- 添加需求 -->
        ${availableReqs.length > 0 ? `
          <div class="to-card__link-area">
            <select class="to-card__select" id="to-select-${order.id}">
              <option value="">选择要关联的需求...</option>
              ${availableReqs.map((r) => `
                <option value="${r.id}">${escapeHtml(r.title)}</option>
              `).join('')}
            </select>
            <button class="btn btn--sm btn--primary to-card__link-btn" data-id="${order.id}">${ICONS.link} 关联</button>
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
  const container = document.querySelector('.to-view');
  if (container) {
    render(container);
    bindEvents();
  }
}

function addTaskOrder(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  taskOrderStore.add({ name: trimmed });
  refresh();
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  const input = document.querySelector('#to-input');
  const addBtn = document.querySelector('#to-btn-add');

  // 新建
  function handleAdd() {
    if (!input.value.trim()) return;
    addTaskOrder(input.value);
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

  // 编辑名称
  document.querySelectorAll('.to-card__edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const titleEl = document.querySelector(`#to-title-${id}`);
      if (!titleEl) return;

      const current = taskOrderStore.getById(id);
      if (!current) return;

      titleEl.innerHTML = `
        <input
          type="text"
          class="to-card__title-input"
          value="${escapeHtml(current.name)}"
          id="to-edit-input-${id}"
        />
      `;
      const inp = titleEl.querySelector('input');
      inp.focus();
      inp.select();

      function saveEdit() {
        const newName = inp.value.trim();
        if (newName && newName !== current.name) {
          taskOrderStore.update(id, { name: newName });
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
          inp.value = current.name;
          saveEdit();
        }
      });
    });
  });

  // 展开/收起
  document.querySelectorAll('.to-card__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const body = document.querySelector(`#to-body-${id}`);
      if (!body) return;

      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      btn.innerHTML = isOpen ? ICONS.chevronDown : ICONS.chevronUp;
    });
  });

  // 关联需求
  document.querySelectorAll('.to-card__link-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const select = document.querySelector(`#to-select-${id}`);
      if (!select || !select.value) return;

      const order = taskOrderStore.getById(id);
      if (!order) return;

      const newIds = [...order.requirementIds, select.value];
      taskOrderStore.update(id, { requirementIds: newIds });
      refresh();
    });
  });

  // 移除关联
  document.querySelectorAll('.to-card__unlink').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const reqId = btn.dataset.reqId;

      const order = taskOrderStore.getById(id);
      if (!order) return;

      taskOrderStore.update(id, {
        requirementIds: order.requirementIds.filter((rid) => rid !== reqId),
      });
      refresh();
    });
  });

  // 删除
  document.querySelectorAll('.to-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('确认删除此任务单？关联的需求不会被删除。')) return;
      taskOrderStore.remove(btn.dataset.id);
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
