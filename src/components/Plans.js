/**
 * Plans.js — 计划管理
 *
 * 功能:
 *   1. 手动新建计划（标题 + 预估工时 + 截止日期）
 *   2. 从收集箱条目转化
 *   3. 计划卡片：行内编辑、归档/激活、删除
 *   4. 添加到待办 / 从待办移除
 */

import { planStore, todoStore } from '../services/storage.js';
import { parse } from '../services/parser.js';

/* ---- SVG 图标 ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  archive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  unarchive: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  todoAdd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  todoRemove: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  inbox: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(isoDate);
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const label = `${isoDate} ${dayNames[d.getDay()]}`;
  if (isoDate === today) return `今天 (${isoDate})`;
  return label;
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const all = planStore.getAll();
  const active = all.filter((p) => p.status === 'active');
  const archived = all.filter((p) => p.status === 'archived');
  const completed = all.filter((p) => p.status === 'completed');

  container.innerHTML = `
    <div class="plan-view">

      <!-- 工具栏 -->
      <div class="plan-toolbar">
        <input type="text" class="plan-toolbar__title" id="plan-input-title" placeholder="新建计划..." />
        <input type="number" class="plan-toolbar__hours" id="plan-input-hours" placeholder="工时(h)" min="0" step="0.5" title="预估工时（小时）" />
        <input type="date" class="plan-toolbar__date" id="plan-input-date" title="截止日期" />
        <button class="btn btn--primary btn--sm" id="plan-btn-add">${ICONS.plus} 添加</button>
      </div>

      <!-- 活跃计划 -->
      <div class="plan-section">
        <h3 class="plan-section__title">活跃计划 <span class="plan-section__count">${active.length}</span></h3>
        <div class="plan-list" id="plan-list-active">
          ${active.length === 0
            ? '<div class="plan-list__empty">暂无活跃计划</div>'
            : active.map((p) => renderCard(p)).join('')}
        </div>
      </div>

      <!-- 已归档 -->
      ${archived.length > 0 ? `
        <div class="plan-section">
          <h3 class="plan-section__title">已归档 <span class="plan-section__count">${archived.length}</span></h3>
          <div class="plan-list" id="plan-list-archived">
            ${archived.map((p) => renderCard(p)).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 已完成 -->
      ${completed.length > 0 ? `
        <div class="plan-section">
          <h3 class="plan-section__title">已完成 <span class="plan-section__count">${completed.length}</span></h3>
          <div class="plan-list" id="plan-list-completed">
            ${completed.map((p) => renderCard(p)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCard(plan) {
  const hasTodos = planHasTodos(plan.id);
  const hoursDisplay = plan.estimatedHours ? `${plan.estimatedHours}h` : '';
  const deadlineDisplay = plan.deadline ? formatDateLabel(plan.deadline) : '';

  return `
    <div class="plan-card ${plan.status !== 'active' ? 'plan-card--inactive' : ''}" data-id="${plan.id}">
      <div class="plan-card__main">
        <div class="plan-card__title" id="plan-title-${plan.id}">${escapeHtml(plan.title)}</div>
        <div class="plan-card__meta">
          ${hoursDisplay ? `<span class="plan-card__tag tag--hours">${ICONS.clock} ${hoursDisplay}</span>` : ''}
          ${deadlineDisplay ? `<span class="plan-card__tag tag--deadline ${isOverdue(plan) ? 'tag--overdue' : ''}">${ICONS.calendar} ${deadlineDisplay}</span>` : ''}
          ${plan.status === 'completed' ? `<span class="plan-card__tag tag--completed">已完成</span>` : ''}
          ${hasTodos ? `<span class="plan-card__tag tag--has-todos">已关联待办</span>` : ''}
        </div>
      </div>
      <div class="plan-card__actions">
        <button class="btn-icon btn-icon--sm plan-card__add-todo" data-id="${plan.id}" title="添加到待办">${ICONS.todoAdd}</button>
        ${hasTodos ? `<button class="btn-icon btn-icon--sm plan-card__remove-todo" data-id="${plan.id}" title="从待办移除">${ICONS.todoRemove}</button>` : ''}
        <button class="btn-icon btn-icon--sm plan-card__edit" data-id="${plan.id}" title="编辑">${ICONS.edit}</button>
        ${plan.status === 'archived'
          ? `<button class="btn-icon btn-icon--sm plan-card__unarchive" data-id="${plan.id}" title="激活">${ICONS.unarchive}</button>`
          : plan.status !== 'completed'
            ? `<button class="btn-icon btn-icon--sm plan-card__archive" data-id="${plan.id}" title="归档">${ICONS.archive}</button>`
            : ''
        }
        <button class="btn-icon btn-icon--sm plan-card__delete" data-id="${plan.id}" title="删除">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

/* ================================================================== */
/*  逻辑                                                               */
/* ================================================================== */

function refresh() {
  const container = document.querySelector('.plan-view');
  if (container) { render(container); bindEvents(); }
}

function planHasTodos(planId) {
  return todoStore.getAll().some((t) => t.sourceType === 'plan' && t.sourceId === planId);
}

function isOverdue(plan) {
  if (plan.status !== 'active' || !plan.deadline) return false;
  return plan.deadline < new Date().toISOString().split('T')[0];
}

function addPlan(title, estimatedHours, deadline) {
  const trimmed = title.trim();
  if (!trimmed) return;
  planStore.add({
    title: trimmed,
    estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
    deadline: deadline || null,
  });
  refresh();
}

/** 将计划添加到待办 */
function addPlanToTodos(plan) {
  todoStore.add({
    title: plan.title,
    sourceType: 'plan',
    sourceId: plan.id,
    dueDate: plan.deadline || null,
  });
  refresh();
}

/** 将计划关联的待办变为独立待办 */
function removePlanFromTodos(plan) {
  const todos = todoStore.getAll().filter((t) => t.sourceType === 'plan' && t.sourceId === plan.id);
  for (const t of todos) {
    todoStore.update(t.id, { sourceType: null, sourceId: null });
  }
  refresh();
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  const titleInput = document.querySelector('#plan-input-title');
  const hoursInput = document.querySelector('#plan-input-hours');
  const dateInput = document.querySelector('#plan-input-date');
  const addBtn = document.querySelector('#plan-btn-add');

  function handleAdd() {
    addPlan(titleInput.value, hoursInput.value, dateInput.value);
    titleInput.value = '';
    hoursInput.value = '';
    titleInput.focus();
  }

  addBtn?.addEventListener('click', handleAdd);
  titleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  });

  // 编辑
  document.querySelectorAll('.plan-card__edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const titleEl = document.querySelector(`#plan-title-${id}`);
      const current = planStore.getById(id);
      if (!titleEl || !current) return;

      titleEl.innerHTML = `<input type="text" class="plan-inline-input" value="${escapeHtml(current.title)}" id="plan-edit-${id}" />`;
      const inp = titleEl.querySelector('input');
      inp.focus(); inp.select();
      function save() {
        const v = inp.value.trim();
        if (v && v !== current.title) planStore.update(id, { title: v });
        refresh();
      }
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { inp.value = current.title; save(); }
      });
    });
  });

  // 添加到待办
  document.querySelectorAll('.plan-card__add-todo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const plan = planStore.getById(btn.dataset.id);
      if (plan) addPlanToTodos(plan);
    });
  });

  // 从待办移除
  document.querySelectorAll('.plan-card__remove-todo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const plan = planStore.getById(btn.dataset.id);
      if (plan) removePlanFromTodos(plan);
    });
  });

  // 归档
  document.querySelectorAll('.plan-card__archive').forEach((btn) => {
    btn.addEventListener('click', () => { planStore.update(btn.dataset.id, { status: 'archived' }); refresh(); });
  });

  // 激活
  document.querySelectorAll('.plan-card__unarchive').forEach((btn) => {
    btn.addEventListener('click', () => { planStore.update(btn.dataset.id, { status: 'active' }); refresh(); });
  });

  // 删除
  document.querySelectorAll('.plan-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('确认删除此计划？关联的待办事项不会自动删除。')) return;
      planStore.remove(btn.dataset.id);
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

/** 从收集箱条目转化为计划 */
export function convertToPlan(inboxItem) {
  const parsed = parse(inboxItem.content);
  planStore.add({
    title: parsed.title || inboxItem.content,
    sourceInboxId: inboxItem.id,
    deadline: parsed.recognizedDate || null,
  });
}
