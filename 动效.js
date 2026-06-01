// 动效.js — GSAP 动画模块
(function() {
  'use strict';

  if (typeof gsap === 'undefined') return;

  // ═══════════════════ 禁用冲突的 CSS transition ═══════════════════
  (function() {
    var s = document.createElement('style');
    s.textContent = '.gsap-ready .screen,.gsap-ready #toast,.gsap-ready .overlay,.gsap-ready .overlay-panel,.gsap-ready .achievement-popup,.gsap-ready .freq-card,.gsap-ready .genre-card,.gsap-ready .cc-option,.gsap-ready .gender-option{transition:none!important}';
    document.head.appendChild(s);
    document.body.classList.add('gsap-ready');
  })();

  // ═══════════════════ SCREEN TRANSITION ═══════════════════
  window.gsapScreenOut = function(oldName, cb) {
    var el = document.getElementById(oldName + '-screen');
    if (!el) { if (cb) cb(); return; }
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0, duration: 0.25, ease: 'power2.in',
      onComplete: function() {
        el.classList.remove('active');
        el.classList.add('hidden');
        gsap.set(el, { clearProps: 'all' });
        if (cb) cb();
      }
    });
  };

  window.gsapScreenIn = function(name, cb) {
    var el = document.getElementById(name + '-screen');
    if (!el) { if (cb) cb(); return; }
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: 'all' });
    el.classList.remove('hidden');
    // 确保浏览器在添加 active 前完成布局
    void el.offsetWidth;
    el.classList.add('active');
    gsap.fromTo(el,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: 'power2.out',
        onComplete: function() { if (cb) cb(); }
      }
    );
  };

  // ═══════════════════ TOAST ═══════════════════
  (function() {
    var _orig = window.toast;
    window.toast = function(msg, type) {
      var el = document.getElementById('toast');
      if (!el) { if (_orig) _orig(msg, type); return; }
      clearTimeout(el._timeout);
      gsap.killTweensOf(el);
      el.textContent = msg;
      el.className = type === 'error' ? 'error show' : 'show';
      gsap.fromTo(el, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.4)' });
      el._timeout = setTimeout(function() {
        gsap.to(el, { y: -12, opacity: 0, duration: 0.22, ease: 'power2.in',
          onComplete: function() { el.className = ''; gsap.set(el, { clearProps: 'all' }); }
        });
      }, 2500);
    };
  })();

  // ═══════════════════ SMOOTH SCROLL ═══════════════════
  window.gsapScrollToBottom = function() {
    var area = document.getElementById('narrative-area');
    if (!area) return;
    gsap.killTweensOf(area, 'scrollTop');
    gsap.to(area, {
      scrollTop: area.scrollHeight - area.clientHeight,
      duration: 0.35, ease: 'power2.out'
    });
  };

  console.log('GSAP v1 — 屏幕切换 + Toast + 滚动');
})();
