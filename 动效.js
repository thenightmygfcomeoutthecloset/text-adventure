// 动效.js — GSAP 动画模块（精简版）
// 为异界卷 · 文字冒险添加丝滑动效
(function() {
  'use strict';

  if (typeof gsap === 'undefined') return;

  // ═══════════════════ DISABLE CONFLICTING CSS TRANSITIONS ═══════════════════
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.gsap-ready .screen{transition:none!important}',
    '.gsap-ready #toast{transition:none!important}',
    '.gsap-ready .overlay{transition:none!important}',
    '.gsap-ready .overlay-panel{transition:none!important}',
    '.gsap-ready .achievement-popup{transition:none!important}',
    '.gsap-ready .freq-card{transition:none!important}',
    '.gsap-ready .genre-card{transition:none!important}',
    '.gsap-ready .cc-option{transition:none!important}',
    '.gsap-ready .gender-option{transition:none!important}'
  ].join(';');
  document.head.appendChild(styleEl);
  document.body.classList.add('gsap-ready');

  // ═══════════════════ SCREEN TRANSITION ═══════════════════
  window.gsapScreenOut = function(oldName, cb) {
    var el = document.getElementById(oldName + '-screen');
    if (!el) { if (cb) cb(); return; }
    gsap.killTweensOf(el);
    gsap.to(el, { opacity:0, scale:0.97, duration:0.25, ease:'power2.in',
      onComplete: function() {
        el.classList.remove('active');
        el.classList.add('hidden');
        gsap.set(el, { clearProps:'all' });
        if (cb) cb();
      }
    });
  };

  window.gsapScreenIn = function(name, cb) {
    var el = document.getElementById(name + '-screen');
    if (!el) { if (cb) cb(); return; }
    gsap.killTweensOf(el);
    el.classList.remove('hidden');
    gsap.set(el, { opacity:0, scale:0.98 });
    el.classList.add('active');
    gsap.to(el, { opacity:1, scale:1, duration:0.35, ease:'power2.out',
      onComplete: function() { if (cb) cb(); }
    });
  };

  // ═══════════════════ OVERLAY ANIMATION ═══════════════════
  var _overlayObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      if (m.target.id !== 'overlay') return;
      if (m.attributeName !== 'class') return;
      var overlay = m.target;
      var panel = overlay.querySelector('.overlay-panel');
      if (overlay.classList.contains('hidden')) {
        gsap.killTweensOf(overlay);
        if (panel) { gsap.killTweensOf(panel); gsap.set(panel, { clearProps:'all' }); }
        gsap.set(overlay, { clearProps:'all' });
      } else {
        gsap.killTweensOf(overlay);
        if (panel) { gsap.killTweensOf(panel); gsap.set(panel, { clearProps:'all' }); }
        gsap.fromTo(overlay, { opacity:0 }, { opacity:1, duration:0.22, ease:'power2.out' });
        if (panel) {
          gsap.fromTo(panel, { scale:0.92, opacity:0 }, { scale:1, opacity:1, duration:0.3, ease:'power2.out' });
        }
      }
    });
  });
  var ov = document.getElementById('overlay');
  if (ov) _overlayObserver.observe(ov, { attributes:true, attributeFilter:['class'] });

  // ═══════════════════ NARRATIVE ENTRY ANIMATION ═══════════════════
  var _narrativeObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (!node.nodeType || node.nodeType !== 1) return;
        if (node.classList.contains('narrative-entry')) {
          gsap.fromTo(node, { opacity:0, y:14 }, { opacity:1, y:0, duration:0.35, ease:'power2.out' });
        }
        if (node.classList && node.classList.contains('world-thinking')) {
          gsap.fromTo(node, { opacity:0 }, { opacity:1, duration:0.25 });
        }
        if (node.classList && node.classList.contains('narrative-error')) {
          gsap.fromTo(node, { opacity:0, x:-16 }, { opacity:1, x:0, duration:0.3, ease:'power2.out' });
        }
        if (node.classList && node.classList.contains('scene-title')) {
          gsap.fromTo(node, { opacity:0 }, { opacity:1, duration:0.6, ease:'power2.out' });
        }
      });
    });
  });
  var na = document.getElementById('narrative-area');
  if (na) _narrativeObserver.observe(na, { childList:true });

  // ═══════════════════ TOAST ANIMATION ═══════════════════
  window.toast = function(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(el._timeout);
    gsap.killTweensOf(el);
    el.textContent = msg;
    el.className = type === 'error' ? 'error show' : 'show';
    gsap.fromTo(el, { y:-16, opacity:0 }, { y:0, opacity:1, duration:0.3, ease:'back.out(1.4)' });
    el._timeout = setTimeout(function() {
      gsap.to(el, { y:-12, opacity:0, duration:0.22, ease:'power2.in',
        onComplete: function() { el.className = ''; gsap.set(el, { clearProps:'all' }); }
      });
    }, 2500);
  };

  // ═══════════════════ NARRATIVE SMOOTH SCROLL ═══════════════════
  window.gsapScrollToBottom = function() {
    var area = document.getElementById('narrative-area');
    if (!area) return;
    gsap.to(area, { scrollTop:area.scrollHeight - area.clientHeight, duration:0.4, ease:'power2.out', overwrite:'auto' });
  };

  console.log('GSAP 动效模块已就绪');
})();
