/**
 * storage.js — localStorage 数据持久化层
 *
 * 核心数据模型:
 *   inbox[]        — 收集箱条目（多途径录入的原始内容）
 *   requirements[] — 需求（从收集箱条目转化而来）
 *   taskOrders[]   — 任务单（聚合多个需求）
 *   todos[]        — 待办事项（从需求拆解的具体行动）
 *
 * 每个集合提供: getAll / getById / add / update / remove
 * 所有操作自动同步到 localStorage，键名统一加 "mytask_" 前缀。
 */

const STORE_PREFIX = 'mytask_';

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
/*  对外 API — 四个领域各自暴露四个方法                                */
/* ------------------------------------------------------------------ */

// ---- inbox ----

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
      source: item.source || 'manual',   // manual | clipboard | cli
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

// ---- requirements ----

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
      status: 'active',                 // active | archived
      createdAt: new Date().toISOString(),
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

// ---- taskOrders ----

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
      createdAt: new Date().toISOString(),
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

// ---- todos ----

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
      requirementId: item.requirementId || null,
      dueDate: item.dueDate || null,     // ISO 日期字符串，如 "2024-05-10"
      isCompleted: false,
      isStarred: false,
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
    list[idx] = { ...list[idx], ...patch };
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
