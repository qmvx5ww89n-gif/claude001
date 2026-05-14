/**
 * RequirementsTasks.js — 需求与任务（合并视图）
 *
 * 布局：顶部工具栏 + 左侧需求列表 + 右侧任务单面板
 * 全宽布局，工具栏置顶。
 *
 * v2: 新增工时、截止日期、添加到待办/从待办移除、已完成状态
 */

import { requirementStore, taskOrderStore, planStore, todoStore, getTodoCount } from '../services/storage.js';
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
  todoAdd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  todoRemove: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
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
  if (isoDate === today) return '今天';
  return `${isoDate.slice(5)} ${dayNames[d.getDay()]}`;
}

function isOverdue(item) {
  if (item.status !== 'active' || !item.deadline) return false;
  return item.deadline < new Date().toISOString().split('T')[0];
}

/* ================================================================== */
/*  渲染                                                               */
/* ================================================================== */

function render(container) {
  const allReqs = requirementStore.getAll();
  const activeReqs = allReqs.filter((r) => r.status === 'active');
  const archivedReqs = allReqs.filter((r) => r.status === 'archived');
  const completedReqs = allReqs.filter((r) => r.status === 'completed');
  const orders = taskOrderStore.getAll();
  const allPlans = planStore.getAll().filter((p) => p.status === 'active');

  container.innerHTML = `
    <div class="rt-view">

      <!-- ====== 置顶工具栏 ====== -->
      <div class="rt-toolbar">
        <div class="rt-toolbar__group">
          <input type="text" class="rt-toolbar__input" id="rt-req-input" placeholder="新建需求..." />
          <input type="number" class="rt-toolbar__input rt-toolbar__input--hours" id="rt-req-hours" placeholder="工时(h)" min="0" step="0.5" title="预估工时" />
          <input type="date" class="rt-toolbar__input rt-toolbar__input--date" id="rt-req-date" title="截止日期" />
          <button class="btn btn--primary btn--sm" id="rt-req-add">${ICONS.plus} 添加需求</button>
        </div>
        <div class="rt-toolbar__group">
          <input type="text" class="rt-toolbar__input" id="rt-to-input" placeholder="新建任务单..." />
          <input type="number" class="rt-toolbar__input rt-toolbar__input--hours" id="rt-to-hours" placeholder="工时(h)" min="0" step="0.5" title="预估工时" />
          <input type="date" class="rt-toolbar__input rt-toolbar__input--date" id="rt-to-date" title="截止日期" />
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
          ${completedReqs.length > 0 ? `
            <div class="rt-panel__subheader">已完成 (${completedReqs.length})</div>
            <div class="rt-panel__list" id="rt-req-list-completed">
              ${completedReqs.map((r) => renderReqCard(r)).join('')}
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
              : orders.map((o) => renderToCard(o, allPlans)).join('')}
          </div>
        </div>

      </div>
    </div>
  `;
}

/* ---- 需求卡片 ---- */
function renderReqCard(req) {
  const hasTodos = getTodoCount('requirement', req.id) > 0;
  const hoursDisplay = req.estimatedHours ? `${req.estimatedHours}h` : '';
  const deadlineDisplay = req.deadline ? formatDateLabel(req.deadline) : '';
  const overdue = isOverdue(req);

  return `
    <div class="rt-req-item ${req.status !== 'active' ? 'rt-req-item--inactive' : ''}" data-id="${req.id}">
      <div class="rt-req-item__main">
        <div class="rt-req-item__title" id="rt-req-title-${req.id}">${escapeHtml(req.title)}</div>
        <div class="rt-req-item__meta">
          ${hoursDisplay ? `<span class="rt-req-item__tag tag--hours">${ICONS.clock} ${hoursDisplay}</span>` : ''}
          ${deadlineDisplay ? `<span class="rt-req-item__tag tag--deadline ${overdue ? 'tag--overdue' : ''}">${ICONS.calendar} ${deadlineDisplay}</span>` : ''}
          ${hasTodos ? `<span class="rt-req-item__tag tag--has-todos">已关联待办</span>` : ''}
        </div>
      </div>
      <div class="rt-req-item__actions">
        <button class="btn-icon btn-icon--sm rt-req-item__breakdown" data-id="${req.id}" title="拆解为待办">${ICONS.plus}</button>
        <button class="btn-icon btn-icon--sm rt-req-item__add-todo" data-id="${req.id}" title="添加到待办">${ICONS.todoAdd}</button>
        ${hasTodos ? `<button class="btn-icon btn-icon--sm rt-req-item__remove-todo" data-id="${req.id}" title="从待办移除">${ICONS.todoRemove}</button>` : ''}
        <button class="btn-icon btn-icon--sm rt-req-item__edit" data-id="${req.id}" title="编辑">${ICONS.edit}</button>
        ${req.status === 'archived'
          ? `<button class="btn-icon btn-icon--sm rt-req-item__unarchive" data-id="${req.id}" title="激活">${ICONS.unarchive}</button>`
          : req.status !== 'completed'
            ? `<button class="btn-icon btn-icon--sm rt-req-item__archive" data-id="${req.id}" title="归档">${ICONS.archive}</button>`
            : ''
        }
        <button class="btn-icon btn-icon--sm rt-req-item__delete" data-id="${req.id}" title="删除">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

/* ---- 任务单卡片 ---- */
function renderToCard(order, allPlans) {
  const linkedReqs = order.requirementIds
    .map((id) => requirementStore.getById(id))
    .filter(Boolean);
  const linkedPlans = (order.planIds || [])
    .map((id) => planStore.getById(id))
    .filter(Boolean);
  const availableReqs = requirementStore
    .getAll()
    .filter((r) => r.status === 'active' && !order.requirementIds.includes(r.id));
  const availablePlans = allPlans.filter((p) => !(order.planIds || []).includes(p.id));
  const hasTodos = getTodoCount('taskOrder', order.id) > 0;
  const hoursDisplay = order.estimatedHours ? `${order.estimatedHours}h` : '';
  const deadlineDisplay = order.deadline ? formatDateLabel(order.deadline) : '';
  const overdue = isOverdue(order);

  return `
    <div class="rt-to-item ${order.status !== 'active' ? 'rt-to-item--inactive' : ''}" data-id="${order.id}">
      <div class="rt-to-item__header">
        <span class="rt-to-item__name" id="rt-to-name-${order.id}">${escapeHtml(order.name)}</span>
        <span class="rt-to-item__count">${linkedReqs.length + linkedPlans.length}</span>
        <div class="rt-to-item__actions">
          <button class="btn-icon btn-icon--sm rt-to-item__add-todo" data-id="${order.id}" title="添加到待办">${ICONS.todoAdd}</button>
          ${hasTodos ? `<button class="btn-icon btn-icon--sm rt-to-item__remove-todo" data-id="${order.id}" title="从待办移除">${ICONS.todoRemove}</button>` : ''}
          <button class="btn-icon btn-icon--sm rt-to-item__edit" data-id="${order.id}" title="编辑">${ICONS.edit}</button>
          <button class="btn-icon btn-icon--sm rt-to-item__toggle" data-id="${order.id}" title="展开">${ICONS.chevronDown}</button>
          <button class="btn-icon btn-icon--sm rt-to-item__delete" data-id="${order.id}" title="删除">${ICONS.trash}</button>
        </div>
      </div>
      ${hoursDisplay || deadlineDisplay ? `
        <div class="rt-to-item__meta">
          ${hoursDisplay ? `<span class="rt-to-item__tag tag--hours">${ICONS.clock} ${hoursDisplay}</span>` : ''}
          ${deadlineDisplay ? `<span class="rt-to-item__tag tag--deadline ${overdue ? 'tag--overdue' : ''}">${ICONS.calendar} ${deadlineDisplay}</span>` : ''}
        </div>
      ` : ''}
      <div class="rt-to-item__body" id="rt-to-body-${order.id}">
        ${linkedPlans.length > 0 || linkedReqs.length > 0 ? `
          <div class="rt-to-item__reqs" id="rt-to-reqs-${order.id}">
            ${linkedPlans.map((p) => `
              <div class="rt-to-item__req rt-to-item__req--plan">
                <span>[计划] ${escapeHtml(p.title)}</span>
                <button class="btn-icon btn-icon--sm rt-to-item__unlink-plan" data-id="${order.id}" data-plan-id="${p.id}" title="移除">${ICONS.unlink}</button>
              </div>
            `).join('')}
            ${linkedReqs.map((r) => `
              <div class="rt-to-item__req">
                <span>${escapeHtml(r.title)}</span>
                <button class="btn-icon btn-icon--sm rt-to-item__unlink" data-id="${order.id}" data-req-id="${r.id}" title="移除">${ICONS.unlink}</button>
              </div>
            `).join('')}
          </div>
        ` : '<div class="rt-to-item__empty-req">暂无关联需求或计划</div>'}
        <div class="rt-to-item__link-row">
          ${availableReqs.length > 0 ? `
            <select class="rt-to-item__select" id="rt-req-select-${order.id}">
              <option value="">关联需求...</option>
              ${availableReqs.map((r) => `<option value="req:${r.id}">${escapeHtml(r.title)}</option>`).join('')}
            </select>
          ` : ''}
          ${availablePlans.length > 0 ? `
            <select class="rt-to-item__select" id="rt-plan-select-${order.id}">
              <option value="">关联计划...</option>
              ${availablePlans.map((p) => `<option value="plan:${p.id}">[计划] ${escapeHtml(p.title)}</option>`).join('')}
            </select>
          ` : ''}
          <button class="btn btn--sm btn--primary rt-to-item__link-btn" data-id="${order.id}">${ICONS.link}</button>
        </div>
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

/** 添加待办关联 */
function addToTodos(sourceType, sourceId, title, dueDate) {
  todoStore.add({ title, sourceType, sourceId, dueDate: dueDate || null });
  refresh();
}

/** 移除待办关联 */
function removeFromTodos(sourceType, sourceId) {
  const todos = todoStore.getAll().filter(
    (t) => t.sourceType === sourceType && t.sourceId === sourceId
  );
  for (const t of todos) {
    todoStore.update(t.id, { sourceType: null, sourceId: null });
  }
  refresh();
}

/* ================================================================== */
/*  事件                                                               */
/* ================================================================== */

function bindEvents() {
  // ---- 新建需求 ----
  const reqInput = document.querySelector('#rt-req-input');
  const reqHours = document.querySelector('#rt-req-hours');
  const reqDate = document.querySelector('#rt-req-date');
  const reqAddBtn = document.querySelector('#rt-req-add');
  function addReq() {
    const v = reqInput.value.trim();
    if (!v) return;
    requirementStore.add({
      title: v,
      estimatedHours: reqHours.value ? parseFloat(reqHours.value) : null,
      deadline: reqDate.value || null,
    });
    reqInput.value = '';
    if (reqHours) reqHours.value = '';
    reqInput.focus();
    refresh();
  }
  reqAddBtn?.addEventListener('click', addReq);
  reqInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addReq(); }
  });

  // ---- 新建任务单 ----
  const toInput = document.querySelector('#rt-to-input');
  const toHours = document.querySelector('#rt-to-hours');
  const toDate = document.querySelector('#rt-to-date');
  const toAddBtn = document.querySelector('#rt-to-add');
  function addTo() {
    const v = toInput.value.trim();
    if (!v) return;
    taskOrderStore.add({
      name: v,
      estimatedHours: toHours?.value ? parseFloat(toHours.value) : null,
      deadline: toDate?.value || null,
    });
    toInput.value = '';
    if (toHours) toHours.value = '';
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

  // ---- 需求：添加到待办 ----
  document.querySelectorAll('.rt-req-item__add-todo').forEach((b) => {
    b.addEventListener('click', () => {
      const req = requirementStore.getById(b.dataset.id);
      if (req) addToTodos('requirement', req.id, req.title, req.deadline);
    });
  });

  // ---- 需求：从待办移除 ----
  document.querySelectorAll('.rt-req-item__remove-todo').forEach((b) => {
    b.addEventListener('click', () => {
      removeFromTodos('requirement', b.dataset.id);
    });
  });

  // ---- 任务单：添加到待办 ----
  document.querySelectorAll('.rt-to-item__add-todo').forEach((b) => {
    b.addEventListener('click', () => {
      const order = taskOrderStore.getById(b.dataset.id);
      if (order) addToTodos('taskOrder', order.id, order.name, order.deadline);
    });
  });

  // ---- 任务单：从待办移除 ----
  document.querySelectorAll('.rt-to-item__remove-todo').forEach((b) => {
    b.addEventListener('click', () => {
      removeFromTodos('taskOrder', b.dataset.id);
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

  // ---- 任务单：关联需求/计划 ----
  document.querySelectorAll('.rt-to-item__link-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const order = taskOrderStore.getById(id);
      if (!order) return;

      const reqSelect = document.querySelector(`#rt-req-select-${id}`);
      const planSelect = document.querySelector(`#rt-plan-select-${id}`);

      if (reqSelect && reqSelect.value && reqSelect.value.startsWith('req:')) {
        const reqId = reqSelect.value.slice(4);
        taskOrderStore.update(id, { requirementIds: [...order.requirementIds, reqId] });
      }
      if (planSelect && planSelect.value && planSelect.value.startsWith('plan:')) {
        const planId = planSelect.value.slice(5);
        taskOrderStore.update(id, { planIds: [...(order.planIds || []), planId] });
      }
      refresh();
    });
  });

  // ---- 任务单：移除关联需求 ----
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

  // ---- 任务单：移除关联计划 ----
  document.querySelectorAll('.rt-to-item__unlink-plan').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const planId = btn.dataset.planId;
      const order = taskOrderStore.getById(id);
      if (!order) return;
      taskOrderStore.update(id, { planIds: (order.planIds || []).filter((pid) => pid !== planId) });
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

export { breakdownRequirement } from './Todos.js';

export function convertFromInbox(inboxItem) {
  const parsed = parse(inboxItem.content);
  requirementStore.add({
    title: parsed.title || inboxItem.content,
    sourceInboxId: inboxItem.id,
    estimatedHours: null,
    deadline: parsed.recognizedDate || null,
  });
}
