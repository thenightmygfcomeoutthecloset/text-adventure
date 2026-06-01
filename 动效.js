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
    window.toast = function(msg, type) {
      var el = document.getElementById('toast');
      if (!el) return;
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

  // ═══════════════════ NARRATIVE ENTRY FADE-IN ═══════════════════
  (function() {
    var area = document.getElementById('narrative-area');
    if (!area) return;
    var observer = new MutationObserver(function(ms) {
      ms.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (node.classList.contains('narrative-entry')) {
            gsap.fromTo(node, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
          } else if (node.classList.contains('world-thinking')) {
            gsap.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.25 });
          } else if (node.classList.contains('narrative-error')) {
            gsap.fromTo(node, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
          } else if (node.classList.contains('scene-title')) {
            gsap.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
          }
        });
      });
    });
    observer.observe(area, { childList: true });
  })();

  // ═══════════════════ OVERLAY FADE IN/OUT ═══════════════════
  (function() {
    var overlay = document.getElementById('overlay');
    if (!overlay) return;
    var observer = new MutationObserver(function(ms) {
      ms.forEach(function(m) {
        if (m.attributeName !== 'class') return;
        var panel = overlay.querySelector('.overlay-panel');
        if (overlay.classList.contains('hidden')) {
          gsap.killTweensOf(overlay);
          if (panel) { gsap.killTweensOf(panel); gsap.set(panel, { clearProps: 'all' }); }
          gsap.set(overlay, { clearProps: 'all' });
        } else {
          gsap.killTweensOf(overlay);
          if (panel) { gsap.killTweensOf(panel); gsap.set(panel, { clearProps: 'all' }); }
          gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
          if (panel) {
            gsap.fromTo(panel, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
          }
        }
      });
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  })();

  // ═══════════════════ ACHIEVEMENT POPUP ═══════════════════
  (function() {
    var ap = document.getElementById('achievement-popup');
    if (!ap) return;
    var observer = new MutationObserver(function(ms) {
      ms.forEach(function(m) {
        if (m.target.classList.contains('hidden')) {
          gsap.to(m.target, { x: 'calc(100% + 30px)', duration: 0.35, ease: 'power2.in',
            onComplete: function() { gsap.set(m.target, { clearProps: 'all' }); }
          });
        } else {
          gsap.fromTo(m.target, { x: 'calc(100% + 30px)' }, { x: 0, duration: 0.5, ease: 'back.out(1.3)' });
        }
      });
    });
    observer.observe(ap, { attributes: true, attributeFilter: ['class'] });
  })();

  console.log('GSAP v2 — 屏幕 + Toast + 滚动 + 叙事 + Overlay + 成就');
})();
