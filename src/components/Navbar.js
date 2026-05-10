/**
 * Navbar.js — 底部导航栏
 *
 * 三个标签页: 收集箱 | 需求·任务 | 待办
 * 点击标签时派发自定义 "nav-change" 事件，携带 { view } 标识当前视图。
 * 键盘快捷键 Ctrl+1~3 也可切换。
 */

const TABS = [
  { key: 'inbox',              label: '收集箱',     icon: 'inbox' },
  { key: 'requirements-tasks', label: '需求·任务',   icon: 'requirements' },
  { key: 'todos',              label: '待办',       icon: 'todos' },
];

/* ---- 纯 SVG 图标（内联，不依赖外部资源） ---- */
const ICONS = {
  inbox: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>`,
  requirements: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>`,
  taskOrders: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>`,
  todos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>`,
};

export function init(container) {
  /* ---- 构建 DOM ---- */
  container.innerHTML = `
    <nav class="navbar">
      ${TABS.map((tab, i) => `
        <button class="navbar__tab" data-view="${tab.key}" data-index="${i + 1}" title="${tab.label} (Ctrl+${i + 1})">
          <span class="navbar__icon">${ICONS[tab.icon]}</span>
          <span class="navbar__label">${tab.label}</span>
        </button>
      `).join('')}
    </nav>
  `;

  /* ---- 元素引用 ---- */
  const tabs = container.querySelectorAll('.navbar__tab');

  /**
   * 激活指定视图的标签样式
   * @param {string} viewKey - 视图标识
   */
  function setActive(viewKey) {
    tabs.forEach((btn) => {
      const isActive = btn.dataset.view === viewKey;
      btn.classList.toggle('navbar__tab--active', isActive);
    });
  }

  /* ---- 事件监听 ---- */

  // 点击切换
  container.querySelector('.navbar').addEventListener('click', (e) => {
    const tab = e.target.closest('.navbar__tab');
    if (!tab) return;
    const view = tab.dataset.view;
    setActive(view);
    container.dispatchEvent(new CustomEvent('nav-change', { detail: { view }, bubbles: true }));
  });

  // 键盘快捷键 Ctrl+1~3
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '3') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const tab = tabs[idx];
      if (tab) tab.click();
    }
  });

  /* ---- 默认激活第一个标签 ---- */
  setActive('inbox');
}
