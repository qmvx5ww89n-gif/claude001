/**
 * main.js — 应用入口
 *
 * 启动流程:
 *   1. 加载全局样式
 *   2. 初始化 App 主框架（包含导航栏和视图切换）
 *
 * 后续步骤会在此文件中注册其他组件。
 */

import './styles/base.css';
import { init } from './components/App.js';

// 等待 DOM 就绪后启动应用
document.addEventListener('DOMContentLoaded', () => {
  init();
});
