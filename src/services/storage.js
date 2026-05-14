/**
 * storage.js — localStorage 数据持久化层（v2）
 *
 * 核心数据模型:
 *   inbox[]        — 收集箱条目（多途径录入的原始内容）
 *   plans[]        — 计划
 *   requirements[] — 需求（从收集箱条目转化而来）
 *   taskOrders[]   — 任务单（聚合多个需求和计划）
 *   todos[]        — 待办事项（统一跟进面板，关联计划/需求/任务单）
 *
 * 每个集合提供: getAll / getById / add / update / remove
 * 所有操作自动同步到 localStorage，键名统一加 "mytask_" 前缀。
 */

const STORE_PREFIX = 'mytask_';
const DATA_VERSION = 2;

/* ------------------------------------------------------------------ */
/*  通用工具                                                          */
/* ------------------------------------------------------------------ */

/** 读取一个集合（返回数组，不存在则返回 []） */
function load(collection) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + collection);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 将数组写回 localStorage */
function save(collection, data) {
  localStorage.setItem(STORE_PREFIX + collection, JSON.stringify(data));
}

/* ------------------------------------------------------------------ */
/*  数据迁移 v1 → v2                                                  */
/* ------------------------------------------------------------------ */

export function migrateIfNeeded() {
  const currentVersion = parseInt(localStorage.getItem('mytask_data_version') || '1', 10);
  if (currentVersion >= DATA_VERSION) return;

  // 备份
  try {
    const backup = {};
    for (const key of ['inbox', 'requirements', 'taskOrders', 'todos']) {
      const raw = localStorage.getItem(STORE_PREFIX + key);
      if (raw) backup[key] = raw;
    }
    localStorage.setItem('mytask_backup_v1', JSON.stringify(backup));
  } catch { /* 忽略备份失败 */ }

  // 1. 迁移 todos: requirementId → sourceType + sourceId
  const todos = load('todos');
  const migratedTodos = todos.map((t) => {
    const { requirementId, ...rest } = t;
    return {
      ...rest,
      sourceType: requirementId ? 'requirement' : null,
      sourceId: requirementId || null,
      completedAt: t.isCompleted ? (t.createdAt || new Date().toISOString()) : null,
    };
  });
  save('todos', migratedTodos);

  // 2. 为已有 requirements 补充新字段
  const reqs = load('requirements');
  save('requirements', reqs.map((r) => ({
    ...r,
    estimatedHours: r.estimatedHours || null,
    deadline: r.deadline || null,
    completedAt: null,
  })));

  // 3. 为已有 taskOrders 补充新字段
  const orders = load('taskOrders');
  save('taskOrders', orders.map((o) => ({
    ...o,
    planIds: o.planIds || [],
    estimatedHours: o.estimatedHours || null,
    deadline: o.deadline || null,
    status: 'active',
    completedAt: null,
  })));

  // 4. 初始化空的 plans 存储
  if (!localStorage.getItem(STORE_PREFIX + 'plans')) {
    save('plans', []);
  }

  localStorage.setItem('mytask_data_version', String(DATA_VERSION));
  console.log('[storage] 数据迁移 v1→v2 完成');
}

/* ------------------------------------------------------------------ */
/*  对外 API — 五个领域各自暴露四个方法                                */
/* ------------------------------------------------------------------ */

// ---- inbox (不变) ----

export const inboxStore = {
  getAll() {
    return load('inbox');
  },

  getById(id) {
    return load('inbox').find((item) => item.id === id) || null;
  },

  add(item) {
    const list = load('inbox');
    const entry = {
      id: crypto.randomUUID(),
      content: item.content || '',
      source: item.source || 'manual',
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    save('inbox', list);
    return entry;
  },

  update(id, patch) {
    const list = load('inbox');
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    save('inbox', list);
    return list[idx];
  },

  remove(id) {
    const list = load('inbox');
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    save('inbox', filtered);
    return true;
  },
};

// ---- plans (新增) ----

export const planStore = {
  getAll() {
    return load('plans');
  },

  getById(id) {
    return load('plans').find((item) => item.id === id) || null;
  },

  add(item) {
    const list = load('plans');
    const entry = {
      id: crypto.randomUUID(),
      title: item.title || '',
      estimatedHours: item.estimatedHours || null,
      deadline: item.deadline || null,
      status: 'active',
      sourceInboxId: item.sourceInboxId || null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    list.push(entry);
    save('plans', list);
    return entry;
  },

  update(id, patch) {
    const list = load('plans');
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    save('plans', list);
    return list[idx];
  },

  remove(id) {
    const list = load('plans');
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    save('plans', filtered);
    return true;
  },
};

// ---- requirements (增强) ----

export const requirementStore = {
  getAll() {
    return load('requirements');
  },

  getById(id) {
    return load('requirements').find((item) => item.id === id) || null;
  },

  add(item) {
    const list = load('requirements');
    const entry = {
      id: crypto.randomUUID(),
      title: item.title || '',
      sourceInboxId: item.sourceInboxId || null,
      status: 'active',
      estimatedHours: item.estimatedHours || null,
      deadline: item.deadline || null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    list.push(entry);
    save('requirements', list);
    return entry;
  },

  update(id, patch) {
    const list = load('requirements');
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    save('requirements', list);
    return list[idx];
  },

  remove(id) {
    const list = load('requirements');
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    save('requirements', filtered);
    return true;
  },
};

// ---- taskOrders (增强) ----

export const taskOrderStore = {
  getAll() {
    return load('taskOrders');
  },

  getById(id) {
    return load('taskOrders').find((item) => item.id === id) || null;
  },

  add(item) {
    const list = load('taskOrders');
    const entry = {
      id: crypto.randomUUID(),
      name: item.name || '',
      requirementIds: item.requirementIds || [],
      planIds: item.planIds || [],
      estimatedHours: item.estimatedHours || null,
      deadline: item.deadline || null,
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    list.push(entry);
    save('taskOrders', list);
    return entry;
  },

  update(id, patch) {
    const list = load('taskOrders');
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    save('taskOrders', list);
    return list[idx];
  },

  remove(id) {
    const list = load('taskOrders');
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    save('taskOrders', filtered);
    return true;
  },
};

// ---- todos (改用 sourceType/sourceId) ----

export const todoStore = {
  getAll() {
    return load('todos');
  },

  getById(id) {
    return load('todos').find((item) => item.id === id) || null;
  },

  add(item) {
    const list = load('todos');
    const entry = {
      id: crypto.randomUUID(),
      title: item.title || '',
      sourceType: item.sourceType || null,
      sourceId: item.sourceId || null,
      dueDate: item.dueDate || null,
      isCompleted: false,
      isStarred: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    save('todos', list);
    return entry;
  },

  update(id, patch) {
    const list = load('todos');
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    // 完成状态变化时自动设置 completedAt
    const patched = { ...list[idx], ...patch };
    if ('isCompleted' in patch) {
      patched.completedAt = patch.isCompleted ? new Date().toISOString() : null;
    }

    list[idx] = patched;
    save('todos', list);
    return list[idx];
  },

  remove(id) {
    const list = load('todos');
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    save('todos', filtered);
    return true;
  },
};

/* ------------------------------------------------------------------ */
/*  工时负荷工具                                                      */
/* ------------------------------------------------------------------ */

/**
 * 获取某一天的工作负荷
 * @param {string} dateStr - ISO 日期 "YYYY-MM-DD"
 * @returns {{ date, totalHours, plans[], requirements[], taskOrders[], level }}
 */
export function getDailyWorkload(dateStr) {
  const plans = load('plans').filter((p) => p.deadline === dateStr && p.status === 'active');
  const reqs = load('requirements').filter((r) => r.deadline === dateStr && r.status === 'active');
  const orders = load('taskOrders').filter((o) => o.deadline === dateStr && o.status === 'active');

  let totalHours = 0;
  for (const p of plans) totalHours += p.estimatedHours || 0;
  for (const r of reqs) totalHours += r.estimatedHours || 0;
  for (const o of orders) totalHours += o.estimatedHours || 0;

  let level = 'normal';
  if (totalHours > 8) level = 'overload';
  else if (totalHours > 4) level = 'busy';

  return { date: dateStr, totalHours, plans, requirements: reqs, taskOrders: orders, level };
}

/* ------------------------------------------------------------------ */
/*  来源自动完成检测                                                  */
/* ------------------------------------------------------------------ */

/**
 * 检查来源（计划/需求/任务单）的所有关联待办是否都已完成，
 * 若是则自动将来源状态更新为 completed。
 */
export function checkAndCompleteSource(sourceType, sourceId) {
  if (!sourceType || !sourceId) return;

  const allTodos = load('todos');
  const sourceTodos = allTodos.filter(
    (t) => t.sourceType === sourceType && t.sourceId === sourceId
  );
  if (sourceTodos.length === 0) return;
  if (!sourceTodos.every((t) => t.isCompleted)) return;

  const now = new Date().toISOString();
  const patch = { status: 'completed', completedAt: now };

  if (sourceType === 'plan') {
    const list = load('plans');
    save('plans', list.map((p) => (p.id === sourceId ? { ...p, ...patch } : p)));
  } else if (sourceType === 'requirement') {
    const list = load('requirements');
    save('requirements', list.map((r) => (r.id === sourceId ? { ...r, ...patch } : r)));
  } else if (sourceType === 'taskOrder') {
    const list = load('taskOrders');
    save('taskOrders', list.map((o) => (o.id === sourceId ? { ...o, ...patch } : o)));
  }
}

/**
 * 获取关联到某个来源的待办数量
 */
export function getTodoCount(sourceType, sourceId) {
  if (!sourceType || !sourceId) return 0;
  return load('todos').filter((t) => t.sourceType === sourceType && t.sourceId === sourceId).length;
}
