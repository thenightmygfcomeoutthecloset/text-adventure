// 动效.js — GSAP 动画模块
// 调试模式：零动画 stub，验证基础功能
(function() {
  'use strict';

  if (typeof gsap === 'undefined') {
    console.warn('GSAP 未加载，动效模块跳过');
    return;
  }

  // 不加 gsap-ready 类，保留 CSS transition 正常工作
  // 这样当 gsapScreenIn/Out 函数存在时，showScreen 走 GSAP 路径
  // 但我们提供的 stub 只做 DOM 操作，不动 opacity

  // ═══════════════════ SCREEN TRANSITION (STUB) ═══════════════════
  window.gsapScreenOut = function(oldName, cb) {
    var el = document.getElementById(oldName + '-screen');
    if (!el) { if (cb) cb(); return; }
    el.classList.remove('active');
    el.classList.add('hidden');
    if (cb) cb();
  };

  window.gsapScreenIn = function(name, cb) {
    var el = document.getElementById(name + '-screen');
    if (!el) { if (cb) cb(); return; }
    el.classList.remove('hidden');
    // 不加 active 类 — 让 CSS transition 自然触发 opacity 过渡
    // 但 showScreen 原本就会加 active，这里我们依赖 showScreen 的 else 分支逻辑
    // 实际上 showScreen 调用 gsapScreenIn 时就不会再走 else 分支
    // 所以需要在这里手动加 active
    void el.offsetWidth;
    el.classList.add('active');
    if (cb) cb();
  };

  // ═══════════════════ NARRATIVE SCROLL (STUB) ═══════════════════
  window.gsapScrollToBottom = function() {
    var area = document.getElementById('narrative-area');
    if (!area) return;
    area.scrollTop = area.scrollHeight;
  };

  console.log('GSAP 动效模块已就绪（调试模式 - 零动画）');
})();
