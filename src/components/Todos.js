/**
 * Todos.js — 待办事项（中央执行面板）
 *
 * 汇聚三种来源的事项：
 *   1. 独立待办 — 直接新建，不关联任何需求/任务单
 *   2. 需求待办 — 从"需求·任务"页拆解而来（requirementId 有值）
 *   3. 任务单待办 — 关联到任务单的待办
 *
 * 布局：顶部工具栏置顶 + 日期筛选 + 按日期分组列表，全宽。
 */

import { todoStore, requirementStore, taskOrderStore } from '../services/storage.js';
import { parse } from '../services/parser.js';

/* ---- SVG ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

let currentFilter = 'all';

/* ================================================================== */
/*  数据                                                               */
/* ================================================================== */

function getFilteredTodos() {
  let todos = todoStore.getAll();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  switch (currentFilter) {
    case 'today':
      todos = todos.filter((t) => t.dueDate === todayStr);
      break;
    case 'week':
      todos = todos.filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr);
      break;
    case 'dated':
      todos = todos.filter((t) => !!t.dueDate);
      break;
  }

  // 排序：未完成在前 → 星标在前 → 按截止日期 → 创建时间
  todos.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return todos;
}

/** 获取待办来源标签信息 */
function getSourceInfo(todo) {
  // 检查是否关联需求
  if (todo.requirementId) {
    const req = requirementStore.getById(todo.requirementId);
    if (req) return { label: '需求', title: req.title, color: 'source--req' };
  }
  // 独立待办
  return null;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  if (isoDate === todayStr) return '今天';
  if (isoDate === tomorrowStr) return '明天';
  const d = new Date(isoDate);
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${isoDate.slice(5)} ${dayNames[d.getDay()]}`;
}

function isOverdue(todo) {
  if (todo.isCompleted || !todo.dueDate) return false;
  return todo.dueDate < new Date().toISOString().split('T')[0];
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const todos = getFilteredTodos();
  const reqs = requirementStore.getAll().filter((r) => r.status !== 'archived');
  const filters = [
    { key: 'all', label: '全部' },
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'dated', label: '有日期' },
  ];

  container.innerHTML = `
    <div class="todo-view">

      <!-- ====== 置顶工具栏 ====== -->
      <div class="todo-toolbar">
        <input type="text" class="todo-toolbar__title" id="todo-input-title" placeholder="添加待办事项..." />
        <input type="date" class="todo-toolbar__date" id="todo-input-date" />
        <select class="todo-toolbar__source" id="todo-input-req">
          <option value="">独立待办</option>
          <optgroup label="关联需求">
            ${reqs.map((r) => `<option value="req:${r.id}">${escapeHtml(r.title)}</option>`).join('')}
          </optgroup>
        </select>
        <button class="btn btn--primary btn--sm" id="todo-btn-add">${ICONS.plus} 添加</button>
      </div>

      <!-- ====== 日期筛选 ====== -->
      <div class="todo-filters">
        ${filters.map((f) => `
          <button class="todo-filter ${f.key === currentFilter ? 'todo-filter--active' : ''}" data-filter="${f.key}">${f.label}</button>
        `).join('')}
        <span class="todo-filters__count">${todos.length} 项</span>
      </div>

      <!-- ====== 待办列表 ====== -->
      <div class="todo-list" id="todo-list">
        ${todos.length === 0
          ? '<div class="todo-list__empty">暂无待办事项</div>'
          : groupByDate(todos).map((g) => `
            <div class="todo-group">
              <div class="todo-group__label">${g.label} (${g.items.length})</div>
              ${g.items.map((t) => renderItem(t)).join('')}
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

function groupByDate(todos) {
  const groups = new Map();
  for (const t of todos) {
    const key = t.dueDate || '__undated__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const result = [];
  for (const [key, items] of groups) {
    if (key === '__undated__') continue;
    result.push({ label: formatDateLabel(key), items });
  }
  if (groups.has('__undated__')) {
    result.push({ label: '待安排', items: groups.get('__undated__') });
  }
  return result;
}

function renderItem(todo) {
  const source = getSourceInfo(todo);
  const dateLabel = formatDateLabel(todo.dueDate);

  return `
    <div class="todo-item ${todo.isCompleted ? 'todo-item--completed' : ''}" data-id="${todo.id}">
      <!-- 完成勾选 -->
      <button class="todo-item__check ${todo.isCompleted ? 'todo-item__check--done' : ''}" data-id="${todo.id}" title="${todo.isCompleted ? '取消完成' : '标记完成'}">
        ${todo.isCompleted
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/></svg>`
        }
      </button>

      <!-- 内容 -->
      <div class="todo-item__content">
        <span class="todo-item__title">${escapeHtml(todo.title)}</span>
        <div class="todo-item__meta">
          ${source ? `<span class="todo-item__source ${source.color}">${escapeHtml(source.label)}: ${escapeHtml(source.title)}</span>` : ''}
          ${dateLabel ? `<span class="todo-item__date ${isOverdue(todo) ? 'todo-item__date--overdue' : ''}">${ICONS.calendar} ${dateLabel}</span>` : ''}
        </div>
      </div>

      <!-- 操作 -->
      <div class="todo-item__actions">
        <button class="btn-icon btn-icon--sm todo-item__star ${todo.isStarred ? 'todo-item__star--active' : ''}" data-id="${todo.id}">
          ${todo.isStarred ? ICONS.starFilled : ICONS.star}
        </button>
        <button class="btn-icon btn-icon--sm todo-item__delete" data-id="${todo.id}" title="删除">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

/* ================================================================== */
/*  逻辑                                                               */
/* ================================================================== */

function refresh() {
  const container = document.querySelector('.todo-view');
  if (container) { render(container); bindEvents(); }
}

function addTodo(title, dueDate, requirementId) {
  const trimmed = title.trim();
  if (!trimmed) return;
  todoStore.add({ title: trimmed, dueDate: dueDate || null, requirementId: requirementId || null });
  refresh();
}

export function breakdownRequirement(requirement) {
  const parsed = parse(requirement.title);
  todoStore.add({
    title: parsed.title || requirement.title,
    dueDate: parsed.recognizedDate || null,
    requirementId: requirement.id,
  });
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  const titleInput = document.querySelector('#todo-input-title');
  const dateInput = document.querySelector('#todo-input-date');
  const sourceSelect = document.querySelector('#todo-input-req');
  const addBtn = document.querySelector('#todo-btn-add');

  // 新建
  function handleAdd() {
    const sourceVal = sourceSelect.value;
    let requirementId = null;
    if (sourceVal && sourceVal.startsWith('req:')) {
      requirementId = sourceVal.slice(4);
    }
    addTodo(titleInput.value, dateInput.value || null, requirementId);
    titleInput.value = '';
    titleInput.focus();
  }

  addBtn?.addEventListener('click', handleAdd);
  titleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  });

  // 日期筛选
  document.querySelectorAll('.todo-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      refresh();
    });
  });

  // 完成/取消
  document.querySelectorAll('.todo-item__check').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todo = todoStore.getById(btn.dataset.id);
      if (todo) { todoStore.update(todo.id, { isCompleted: !todo.isCompleted }); refresh(); }
    });
  });

  // 星标
  document.querySelectorAll('.todo-item__star').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todo = todoStore.getById(btn.dataset.id);
      if (todo) { todoStore.update(todo.id, { isStarred: !todo.isStarred }); refresh(); }
    });
  });

  // 删除
  document.querySelectorAll('.todo-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('确认删除？')) return;
      todoStore.remove(btn.dataset.id);
      refresh();
    });
  });
}

/* ================================================================== */
/*  初始化                                                             */
/* ================================================================== */

export function init(container) {
  const today = new Date().toISOString().split('T')[0];
  render(container);
  const dateInput = document.querySelector('#todo-input-date');
  if (dateInput) dateInput.value = today;
  bindEvents();
}
