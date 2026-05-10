/**
 * cliSync.js — 外部数据同步服务（浏览器端）
 *
 * 从本地 server.js 拉取由 CLI、OA-cli 等工具提交的待处理数据，分发到对应存储。
 *
 * 支持三种目标类型:
 *   - inbox        收集箱条目
 *   - requirement  需求
 *   - todo         待办事项
 *
 * 用法:
 *   import { syncAll } from '../services/cliSync.js';
 *   const result = await syncAll({ inboxStore, requirementStore, todoStore });
 */

const SYNC_URL = 'http://127.0.0.1:3456/api/pending';

/**
 * 从本地服务同步所有待处理条目到对应存储
 * @param {Object} stores - { inboxStore, requirementStore, todoStore }
 * @returns {Promise<{inbox:number, requirements:number, todos:number}>}
 */
export async function syncAll(stores) {
  const { inboxStore, requirementStore, todoStore } = stores;
  const result = { inbox: 0, requirements: 0, todos: 0 };

  let data;
  try {
    const resp = await fetch(SYNC_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();

    if (!data.ok) return result;
  } catch (err) {
    console.log('[cliSync]', getErrorMessage(err));
    return result;
  }

  // 分发到对应存储
  if (data.inbox && inboxStore) {
    for (const item of data.inbox) {
      inboxStore.add({ content: item.content, source: item.source || 'cli' });
      result.inbox++;
    }
  }

  if (data.requirements && requirementStore) {
    for (const item of data.requirements) {
      requirementStore.add({
        title: item.title,
        status: item.status || 'active',
      });
      result.requirements++;
    }
  }

  if (data.todos && todoStore) {
    for (const item of data.todos) {
      todoStore.add({
        title: item.title,
        dueDate: item.dueDate || null,
        isStarred: !!item.isStarred,
      });
      result.todos++;
    }
  }

  return result;
}

/** 保留旧接口兼容性 */
export { syncAll as syncFromCli };

function getErrorMessage(err) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return '同步超时';
  if (err.message.includes('Failed to fetch')) return '服务不可达，请先启动 node server.js';
  return err.message;
}
