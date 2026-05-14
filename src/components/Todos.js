/**
 * Todos.js — 待办事项（中央执行面板）
 *
 * 汇聚四种来源的事项：
 *   1. 独立待办 — 直接新建，不关联任何来源
 *   2. 计划待办 — 从计划页添加（sourceType='plan'）
 *   3. 需求待办 — 从需求·任务页拆解而来（sourceType='requirement'）
 *   4. 任务单待办 — 关联到任务单的待办（sourceType='taskOrder'）
 *
 * 布局：工具栏 + 日历视图 + 日期筛选 + 按日期分组列表
 */

import { todoStore, planStore, requirementStore, taskOrderStore, getDailyWorkload, checkAndCompleteSource } from '../services/storage.js';
import { parse } from '../services/parser.js';

/* ---- SVG ---- */
const ICONS = {
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  chevronLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  calendarToggle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

let currentFilter = 'all';
let showCalendar = true;
let calendarWeekStart = null; // 日历显示的第一天（周一），null 表示自动跟随本周
let selectedDate = null; // 从日历选中的日期筛选

/* ================================================================== */
/*  数据                                                               */
/* ================================================================== */

function getFilteredTodos() {
  let todos = todoStore.getAll();

  // 先按日历选中日期筛选
  if (selectedDate) {
    todos = todos.filter((t) => t.dueDate === selectedDate);
    // 也包括没有日期但被创建在当天的？
    return sortTodos(todos);
  }

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

  return sortTodos(todos);
}

function sortTodos(todos) {
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
  if (!todo.sourceType || !todo.sourceId) return null;

  if (todo.sourceType === 'plan') {
    const plan = planStore.getById(todo.sourceId);
    if (plan) return { label: '计划', title: plan.title, color: 'source--plan' };
  }
  if (todo.sourceType === 'requirement') {
    const req = requirementStore.getById(todo.sourceId);
    if (req) return { label: '需求', title: req.title, color: 'source--req' };
  }
  if (todo.sourceType === 'taskOrder') {
    const to = taskOrderStore.getById(todo.sourceId);
    if (to) return { label: '任务单', title: to.name, color: 'source--task' };
  }
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
/*  日历数据                                                           */
/* ================================================================== */

function getWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTwoWeekData() {
  const today = new Date();
  const startMonday = calendarWeekStart
    ? new Date(calendarWeekStart)
    : getWeekMonday(today);

  const todayStr = today.toISOString().split('T')[0];
  const weeks = [];

  for (let w = 0; w < 2; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startMonday);
      date.setDate(date.getDate() + w * 7 + d);
      const dateStr = date.toISOString().split('T')[0];
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const workload = getDailyWorkload(dateStr);

      week.push({ dateStr, day: date.getDate(), isToday, isSelected, workload });
    }
    weeks.push(week);
  }

  return { weeks, startMonday };
}

function formatDateRange(startMonday) {
  const endDate = new Date(startMonday);
  endDate.setDate(endDate.getDate() + 13);

  const sYear = startMonday.getFullYear();
  const sMonth = startMonday.getMonth() + 1;
  const sDay = startMonday.getDate();
  const eYear = endDate.getFullYear();
  const eMonth = endDate.getMonth() + 1;
  const eDay = endDate.getDate();

  if (sYear === eYear && sMonth === eMonth) {
    return `${sYear}年${sMonth}月${sDay}日 - ${eDay}日`;
  }
  return `${sYear}年${sMonth}月${sDay}日 - ${eYear}年${eMonth}月${eDay}日`;
}

function renderCalendar() {
  const { weeks, startMonday } = getTwoWeekData();
  const label = formatDateRange(startMonday);
  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];

  return `
    <div class="calendar ${showCalendar ? '' : 'calendar--collapsed'}">
      <div class="calendar__header">
        <button class="btn-icon btn-icon--sm calendar__nav" id="cal-prev">${ICONS.chevronLeft}</button>
        <span class="calendar__month-label">${label}</span>
        <button class="btn-icon btn-icon--sm calendar__nav" id="cal-next">${ICONS.chevronRight}</button>
        <button class="btn btn--sm btn--ghost calendar__today" id="cal-today">今天</button>
        ${selectedDate
          ? `<button class="btn btn--sm btn--ghost calendar__clear" id="cal-clear">清除筛选</button>`
          : ''}
      </div>
      ${showCalendar ? `
      <div class="calendar__grid">
        <div class="calendar__day-names">
          ${dayNames.map((n) => `<span class="calendar__day-name">${n}</span>`).join('')}
        </div>
        <div class="calendar__weeks">
          ${weeks.map((week) => `
            <div class="calendar__week">
              ${week.map((day) => renderDayCell(day)).join('')}
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function renderDayCell(day) {
  const wl = day.workload;
  let bgClass = '';
  if (wl) {
    if (wl.level === 'overload') bgClass = 'calendar__day--overload';
    else if (wl.level === 'busy') bgClass = 'calendar__day--busy';
  }

  let classes = 'calendar__day';
  if (day.isToday) classes += ' calendar__day--today';
  if (day.isSelected) classes += ' calendar__day--selected';
  if (bgClass) classes += ' ' + bgClass;

  let dotsHtml = '';
  if (wl) {
    const dotParts = [];
    if (wl.plans.length > 0) {
      dotParts.push(`<span class="calendar__dot calendar__dot--plan" title="计划: ${wl.plans.length}项"></span>`);
    }
    if (wl.requirements.length > 0) {
      dotParts.push(`<span class="calendar__dot calendar__dot--req" title="需求: ${wl.requirements.length}项"></span>`);
    }
    if (wl.taskOrders.length > 0) {
      dotParts.push(`<span class="calendar__dot calendar__dot--task" title="任务单: ${wl.taskOrders.length}项"></span>`);
    }
    const totalItems = wl.plans.length + wl.requirements.length + wl.taskOrders.length;
    const totalTypes = dotParts.length;
    if (totalItems > totalTypes && totalTypes > 0) {
      dotParts.push(`<span class="calendar__dot-label">+${totalItems - totalTypes}</span>`);
    }
    dotsHtml = dotParts.join('');
  }

  return `
    <div class="${classes}" data-date="${day.dateStr}">
      <span class="calendar__day-num">${day.day}</span>
      <span class="calendar__day-dots">${dotsHtml}</span>
    </div>
  `;
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const todos = getFilteredTodos();

  // 来源选择器：计划 / 需求 / 任务单
  const activePlans = planStore.getAll().filter((p) => p.status === 'active');
  const activeReqs = requirementStore.getAll().filter((r) => r.status === 'active');
  const activeOrders = taskOrderStore.getAll().filter((o) => o.status === 'active');

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'dated', label: '有日期' },
  ];

  container.innerHTML = `
    <div class="todo-view">

      <!-- ====== 工具栏 ====== -->
      <div class="todo-toolbar">
        <input type="text" class="todo-toolbar__title" id="todo-input-title" placeholder="添加待办事项..." />
        <input type="date" class="todo-toolbar__date" id="todo-input-date" />
        <select class="todo-toolbar__source" id="todo-input-source">
          <option value="">独立待办</option>
          ${activePlans.length > 0 ? `
            <optgroup label="计划">
              ${activePlans.map((p) => `<option value="plan:${p.id}">${escapeHtml(p.title)}</option>`).join('')}
            </optgroup>` : ''}
          ${activeReqs.length > 0 ? `
            <optgroup label="需求">
              ${activeReqs.map((r) => `<option value="requirement:${r.id}">${escapeHtml(r.title)}</option>`).join('')}
            </optgroup>` : ''}
          ${activeOrders.length > 0 ? `
            <optgroup label="任务单">
              ${activeOrders.map((o) => `<option value="taskOrder:${o.id}">${escapeHtml(o.name)}</option>`).join('')}
            </optgroup>` : ''}
        </select>
        <button class="btn btn--primary btn--sm" id="todo-btn-add">${ICONS.plus} 添加</button>
      </div>

      <!-- ====== 日历视图 ====== -->
      <div class="todo-calendar" id="todo-calendar">
        ${renderCalendar()}
      </div>

      <!-- ====== 日期筛选 + 快捷按钮 ====== -->
      <div class="todo-filters">
        <button class="btn-icon btn-icon--sm todo-filters__calendar-toggle" id="btn-calendar-toggle" title="${showCalendar ? '折叠日历' : '展开日历'}">
          ${ICONS.calendarToggle}
        </button>
        ${filters.map((f) => `
          <button class="todo-filter ${f.key === currentFilter && !selectedDate ? 'todo-filter--active' : ''}" data-filter="${f.key}">${f.label}</button>
        `).join('')}
        ${selectedDate
          ? `<button class="todo-filter todo-filter--active" id="btn-date-filter" title="点击清除日期筛选">📅 ${formatDateLabel(selectedDate)} ✕</button>`
          : ''}
        <span class="todo-filters__count">${todos.length} 项</span>
      </div>

      <!-- ====== 待办列表 ====== -->
      <div class="todo-list" id="todo-list">
        ${todos.length === 0
          ? '<div class="todo-list__empty">暂无待办事项</div>'
          : groupByDate(todos).map((g) => `
            <div class="todo-group">
              <div class="todo-group__label">
                ${g.label} (${g.items.length})
                ${g.workloadHours > 0 ? ` · <span class="todo-group__workload ${g.workloadLevel}">${ICONS.clock} ${g.workloadHours}h${g.workloadLevel === 'overload' ? ' ⚠' : g.workloadLevel === 'busy' ? ' ⚡' : ''}</span>` : ''}
              </div>
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

  // 计算每天的工时负荷
  const dateSet = new Set();
  for (const t of todos) {
    if (t.sourceType && t.sourceId && t.dueDate) dateSet.add(t.dueDate);
  }

  const result = [];
  for (const [key, items] of groups) {
    if (key === '__undated__') continue;

    let workloadHours = 0;
    let workloadLevel = '';
    if (key !== '__undated__') {
      const wl = getDailyWorkload(key);
      workloadHours = wl.totalHours;
      workloadLevel = wl.level;
    }

    result.push({ label: formatDateLabel(key), items, workloadHours, workloadLevel });
  }
  if (groups.has('__undated__')) {
    result.push({ label: '待安排', items: groups.get('__undated__'), workloadHours: 0, workloadLevel: '' });
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

function addTodo(title, dueDate, sourceType, sourceId) {
  const trimmed = title.trim();
  if (!trimmed) return;
  todoStore.add({
    title: trimmed,
    dueDate: dueDate || null,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
  });
  refresh();
}

/**
 * 从需求拆解为待办（供 RequirementsTasks.js 调用）
 * 将 parser 解析结果创建为待办，关联到对应需求
 */
export function breakdownRequirement(requirement) {
  const parsed = parse(requirement.title);
  todoStore.add({
    title: parsed.title || requirement.title,
    dueDate: parsed.recognizedDate || null,
    sourceType: 'requirement',
    sourceId: requirement.id,
  });
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  const titleInput = document.querySelector('#todo-input-title');
  const dateInput = document.querySelector('#todo-input-date');
  const sourceSelect = document.querySelector('#todo-input-source');
  const addBtn = document.querySelector('#todo-btn-add');

  // 新建待办
  function handleAdd() {
    const sourceVal = sourceSelect.value;
    let sourceType = null;
    let sourceId = null;
    if (sourceVal) {
      const idx = sourceVal.indexOf(':');
      sourceType = sourceVal.slice(0, idx);
      sourceId = sourceVal.slice(idx + 1);
    }
    addTodo(titleInput.value, dateInput.value || null, sourceType, sourceId);
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
      if (btn.id === 'btn-date-filter') {
        // 清除日历日期筛选
        selectedDate = null;
        refresh();
        return;
      }
      selectedDate = null;
      currentFilter = btn.dataset.filter;
      refresh();
    });
  });

  // 日历折叠/展开
  const calToggle = document.querySelector('#btn-calendar-toggle');
  calToggle?.addEventListener('click', () => {
    showCalendar = !showCalendar;
    // 只更新日历部分
    const calContainer = document.querySelector('#todo-calendar');
    if (calContainer) calContainer.innerHTML = renderCalendar();
    calToggle.title = showCalendar ? '折叠日历' : '展开日历';
    bindCalendarEvents();
  });

  // 日历事件
  bindCalendarEvents();

  // 完成/取消
  document.querySelectorAll('.todo-item__check').forEach((btn) => {
    btn.addEventListener('click', () => {
      const todo = todoStore.getById(btn.dataset.id);
      if (todo) {
        todoStore.update(todo.id, { isCompleted: !todo.isCompleted });
        // 标记完成时检查来源是否所有待办都已完成
        checkAndCompleteSource(todo.sourceType, todo.sourceId);
        refresh();
      }
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

function bindCalendarEvents() {
  // 前移一周
  document.querySelector('#cal-prev')?.addEventListener('click', () => {
    const { startMonday } = getTwoWeekData();
    const prev = new Date(startMonday);
    prev.setDate(prev.getDate() - 7);
    calendarWeekStart = prev;
    const calContainer = document.querySelector('#todo-calendar');
    if (calContainer) calContainer.innerHTML = renderCalendar();
    bindCalendarEvents();
  });

  // 后移一周
  document.querySelector('#cal-next')?.addEventListener('click', () => {
    const { startMonday } = getTwoWeekData();
    const next = new Date(startMonday);
    next.setDate(next.getDate() + 7);
    calendarWeekStart = next;
    const calContainer = document.querySelector('#todo-calendar');
    if (calContainer) calContainer.innerHTML = renderCalendar();
    bindCalendarEvents();
  });

  // 回到本周
  document.querySelector('#cal-today')?.addEventListener('click', () => {
    calendarWeekStart = null; // null = 自动跟随本周
    selectedDate = null;
    refresh();
  });

  // 清除日期筛选
  document.querySelector('#cal-clear')?.addEventListener('click', () => {
    selectedDate = null;
    refresh();
  });

  // 点击日期格子
  document.querySelectorAll('.calendar__day').forEach((cell) => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      if (!dateStr) return;
      // 将该日期所在周的周一设为日历起点
      const d = new Date(dateStr);
      calendarWeekStart = getWeekMonday(d);
      selectedDate = dateStr;
      showCalendar = false;
      currentFilter = 'all';
      refresh();
    });
  });
}

/* ================================================================== */
/*  初始化                                                             */
/* ================================================================== */

export function init(container) {
  const today = new Date().toISOString().split('T')[0];
  calendarWeekStart = null; // 自动从本周开始
  selectedDate = null;
  showCalendar = true;

  render(container);
  const dateInput = document.querySelector('#todo-input-date');
  if (dateInput) dateInput.value = today;
  bindEvents();
}
