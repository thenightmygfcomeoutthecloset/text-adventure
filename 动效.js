// 动效.js — GSAP 动画模块
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
    '.gsap-ready .title-actions button{transition:none!important}',
    '.gsap-ready .btn-primary{transition:none!important}',
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
    gsap.to(el, { opacity:0, scale:0.97, duration:0.28, ease:'power2.in',
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
    el.classList.remove('hidden');
    gsap.set(el, { opacity:0, scale:0.98 });
    el.classList.add('active');
    gsap.to(el, { opacity:1, scale:1, duration:0.42, ease:'power2.out',
      onComplete: function() { if (cb) cb(); }
    });
    // Stagger child cards
    gsap.from(el.querySelectorAll('.freq-card, .genre-card:not(.hidden)'), {
      opacity:0, y:20, duration:0.4, stagger:0.04, ease:'power2.out', delay:0.15
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
        gsap.to(overlay, { opacity:0, duration:0.2, ease:'power2.in',
          onComplete: function() { gsap.set(overlay, { clearProps:'all' }); }
        });
        if (panel) gsap.to(panel, { scale:0.94, duration:0.2, ease:'power2.in' });
      } else {
        gsap.set(overlay, { opacity:0 });
        gsap.to(overlay, { opacity:1, duration:0.25, ease:'power2.out' });
        if (panel) {
          gsap.fromTo(panel, { scale:0.9, opacity:0 }, { scale:1, opacity:1, duration:0.35, ease:'back.out(1.4)' });
        }
        // Stagger child items inside overlay panel
        gsap.from(overlay.querySelectorAll('.save-slot, .bond-card, .ach-card, .annals-chapter, .item-list li'), {
          opacity:0, y:12, duration:0.3, stagger:0.04, ease:'power2.out', delay:0.2
        });
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
          var diceEl = node.querySelector('.dice-roll');
          if (diceEl) {
            gsap.from(node, { opacity:0, duration:0.2, onComplete: function() {
              gsap.from(diceEl, { scale:0.8, rotationX:-90, duration:0.5, ease:'back.out(1.7)' });
            }});
          } else {
            gsap.from(node, { opacity:0, y:18, duration:0.4, ease:'power2.out' });
          }
        }
        if (node.classList && node.classList.contains('world-thinking')) {
          gsap.from(node, { opacity:0, duration:0.3 });
        }
        if (node.classList && node.classList.contains('narrative-error')) {
          gsap.from(node, { opacity:0, x:-20, duration:0.35, ease:'power2.out' });
        }
        if (node.classList && node.classList.contains('scene-title')) {
          gsap.from(node, { opacity:0, letterSpacing:'15px', duration:0.8, ease:'power2.out' });
        }
      });
    });
  });
  var na = document.getElementById('narrative-area');
  if (na) _narrativeObserver.observe(na, { childList:true });

  // ═══════════════════ SUGGESTION BUTTONS STAGGER ═══════════════════
  var _suggObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      var added = false;
      m.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('suggestion-btn')) {
          added = true;
        }
      });
      if (added) {
        var buttons = m.target.querySelectorAll('.suggestion-btn');
        gsap.from(buttons, { opacity:0, y:8, duration:0.3, stagger:0.05, ease:'power2.out' });
      }
    });
  });
  var sb = document.getElementById('suggestion-buttons');
  if (sb) _suggObserver.observe(sb, { childList:true });

  // ═══════════════════ ACHIEVEMENT POPUP ═══════════════════
  var _achObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      if (m.target.classList.contains('hidden')) {
        gsap.to(m.target, { x:'calc(100% + 30px)', duration:0.35, ease:'power2.in',
          onComplete: function() { gsap.set(m.target, { clearProps:'all' }); }
        });
      } else {
        gsap.fromTo(m.target, { x:'calc(100% + 30px)' }, { x:0, duration:0.5, ease:'back.out(1.3)' });
      }
    });
  });
  var ap = document.getElementById('achievement-popup');
  if (ap) _achObserver.observe(ap, { attributes:true, attributeFilter:['class'] });

  // ═══════════════════ LOGIN MODAL ANIMATION ═══════════════════
  var _loginObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      if (m.attributeName !== 'class') return;
      var modal = m.target;
      var panel = modal.querySelector('.login-modal-panel');
      var bg = modal.querySelector('.login-modal-bg');
      if (modal.classList.contains('hidden')) {
        if (panel) gsap.to(panel, { scale:0.9, opacity:0, duration:0.2, ease:'power2.in' });
        if (bg) gsap.to(bg, { opacity:0, duration:0.2, ease:'power2.in',
          onComplete: function() {
            if (panel) gsap.set(panel, { clearProps:'all' });
            if (bg) gsap.set(bg, { clearProps:'all' });
          }
        });
      } else {
        if (bg) { gsap.set(bg, { opacity:0 }); gsap.to(bg, { opacity:1, duration:0.2, ease:'power2.out' }); }
        if (panel) {
          gsap.set(panel, { scale:0.85, opacity:0 });
          gsap.to(panel, { scale:1, opacity:1, duration:0.35, ease:'back.out(1.5)', delay:0.05 });
        }
      }
    });
  });
  var lm = document.getElementById('login-modal');
  if (lm) _loginObserver.observe(lm, { attributes:true, attributeFilter:['class'] });

  // ═══════════════════ TOAST ANIMATION ═══════════════════
  var _originalToast = window.toast;
  window.toast = function(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(el._timeout);
    gsap.killTweensOf(el);
    el.textContent = msg;
    el.className = type === 'error' ? 'error show' : 'show';
    gsap.fromTo(el, { y:-16, opacity:0 }, { y:0, opacity:1, duration:0.35, ease:'back.out(1.5)' });
    el._timeout = setTimeout(function() {
      gsap.to(el, { y:-12, opacity:0, duration:0.25, ease:'power2.in',
        onComplete: function() { el.className = ''; gsap.set(el, { clearProps:'all' }); }
      });
    }, 2500);
  };

  // ═══════════════════ TITLE SCREEN FLOATING PARTICLES ═══════════════════
  function createTitleParticles() {
    var titleScreen = document.getElementById('title-screen');
    if (!titleScreen) return;
    titleScreen.querySelectorAll('.gsap-particle').forEach(function(p) { p.remove(); });

    var frag = document.createDocumentFragment();
    for (var i = 0; i < 30; i++) {
      var p = document.createElement('div');
      p.className = 'gsap-particle';
      var size = 1.5 + Math.random() * 3;
      p.style.cssText = [
        'position:absolute',
        'width:' + size + 'px;height:' + size + 'px',
        'background:radial-gradient(circle, rgba(212,175,55,' + (0.4 + Math.random() * 0.6) + ') 0%, transparent 100%)',
        'border-radius:50%',
        'pointer-events:none',
        'z-index:0',
        'left:' + (Math.random() * 100) + '%',
        'top:' + (Math.random() * 100) + '%'
      ].join(';');
      frag.appendChild(p);
    }
    titleScreen.appendChild(frag);

    titleScreen.querySelectorAll('.gsap-particle').forEach(function(p, i) {
      gsap.to(p, {
        y: -(30 + Math.random() * 80),
        x: (Math.random() - 0.5) * 40,
        opacity: 0,
        duration: 3 + Math.random() * 5,
        repeat: -1,
        delay: Math.random() * 5,
        ease: 'none',
        onRepeat: function() {
          gsap.set(p, { y:0, x:0, opacity:0.15 + Math.random() * 0.7 });
        }
      });
    });
  }

  // ═══════════════════ TITLE PAGE LOAD ENTRANCE ═══════════════════
  function titleEntrance() {
    var ts = document.getElementById('title-screen');
    if (!ts || !ts.classList.contains('active')) return;
    var h1 = ts.querySelector('.title-main h1');
    var subtitle = ts.querySelector('.title-main .subtitle');
    var version = ts.querySelector('.title-main .version-tag');
    var buttons = ts.querySelectorAll('.title-actions > *');
    var tl = gsap.timeline();

    if (h1) {
      gsap.set(h1, { opacity:0, y:-30 });
      tl.to(h1, { opacity:1, y:0, duration:0.8, ease:'power2.out' });
    }
    if (subtitle) {
      gsap.set(subtitle, { opacity:0 });
      tl.to(subtitle, { opacity:1, duration:0.5, ease:'power2.out' }, '-=0.3');
    }
    if (version) {
      gsap.set(version, { opacity:0 });
      tl.to(version, { opacity:1, duration:0.4, ease:'power2.out' }, '-=0.2');
    }
    if (buttons.length) {
      gsap.set(buttons, { opacity:0, y:16 });
      tl.to(buttons, { opacity:1, y:0, duration:0.4, stagger:0.08, ease:'power2.out' }, '-=0.1');
    }
  }

  // ═══════════════════ BUTTON MICRO-INTERACTIONS ═══════════════════
  document.addEventListener('mouseover', function(e) {
    var btn = e.target.closest('button:not(.ghost):not(.btn-back):not(.cc-random):not(.btn-random-all)');
    if (!btn || btn.disabled) return;
    if (btn.closest('.stats-actions')) return;
    if (btn._hovered) return;
    btn._hovered = true;
    gsap.to(btn, { scale:1.03, duration:0.2, ease:'power2.out', overwrite:'auto' });
  }, true);

  document.addEventListener('mouseout', function(e) {
    var btn = e.target.closest('button:not(.ghost):not(.btn-back)');
    if (!btn) return;
    // Only reset if mouse actually left the button
    if (btn.contains(e.relatedTarget)) return;
    btn._hovered = false;
    gsap.to(btn, { scale:1, duration:0.25, ease:'power2.out', overwrite:'auto' });
  }, true);

  document.addEventListener('mousedown', function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.closest('.stats-actions')) return;
    gsap.to(btn, { scale:0.96, duration:0.08, ease:'power2.in', overwrite:'auto' });
  }, true);

  document.addEventListener('mouseup', function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    gsap.to(btn, { scale:1, duration:0.2, ease:'power2.out', overwrite:'auto' });
  }, true);

  // ═══════════════════ CLICK EFFECTS (ripple + option select pop) ═══════════════════
  document.addEventListener('click', function(e) {
    // Character option select pop
    var opt = e.target.closest('.cc-option, .gender-option');
    if (opt && !opt.classList.contains('selected')) {
      setTimeout(function() {
        if (opt.classList.contains('selected')) {
          gsap.fromTo(opt, { scale:0.92 }, { scale:1, duration:0.35, ease:'back.out(1.6)' });
        }
      }, 0);
    }
    // Card click ripple
    var card = e.target.closest('.freq-card, .genre-card, .cc-option, .gender-option, .save-slot:not(.empty)');
    if (!card) return;
    var ripple = document.createElement('span');
    var rect = card.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    ripple.style.cssText = [
      'position:absolute',
      'width:' + size + 'px;height:' + size + 'px',
      'left:' + (e.clientX - rect.left - size/2) + 'px',
      'top:' + (e.clientY - rect.top - size/2) + 'px',
      'border-radius:50%',
      'background:radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)',
      'pointer-events:none',
      'z-index:1'
    ].join(';');
    card.appendChild(ripple);
    gsap.fromTo(ripple, { scale:0, opacity:1 }, { scale:1.5, opacity:0, duration:0.6, ease:'power2.out',
      onComplete: function() { ripple.remove(); }
    });
  });

  // ═══════════════════ COMMAND INPUT EFFECTS (focus glow + send button pulse) ═══════════════════
  var _cmdInput = document.getElementById('command-input');
  if (_cmdInput) {
    _cmdInput.addEventListener('focus', function() {
      gsap.to(_cmdInput, { boxShadow:'0 0 0 3px rgba(212,175,55,0.15)', duration:0.3, ease:'power2.out' });
    });
    _cmdInput.addEventListener('blur', function() {
      gsap.to(_cmdInput, { boxShadow:'0 0 0 0px rgba(212,175,55,0)', duration:0.3, ease:'power2.out' });
    });
    _cmdInput.addEventListener('input', function() {
      var btn = document.getElementById('btn-send');
      if (!btn) return;
      if (_cmdInput.value.trim().length > 0 && !btn._pulsed) {
        btn._pulsed = true;
        gsap.fromTo(btn, { boxShadow:'0 0 0px rgba(212,175,55,0)' }, { boxShadow:'0 0 16px rgba(212,175,55,0.25)', duration:0.4, ease:'power2.out' });
      } else if (_cmdInput.value.trim().length === 0 && btn._pulsed) {
        btn._pulsed = false;
        gsap.to(btn, { boxShadow:'0 0 0px rgba(212,175,55,0)', duration:0.3, ease:'power2.out' });
      }
    });
  }

  // ═══════════════════ NARRATIVE SMOOTH SCROLL ═══════════════════
  window.gsapScrollToBottom = function() {
    var area = document.getElementById('narrative-area');
    if (!area) return;
    var target = area.scrollHeight - area.clientHeight;
    gsap.to(area, { scrollTop:target, duration:0.5, ease:'power2.out', overwrite:'auto' });
  };

  // ═══════════════════ STATS BAR - VALUE CHANGE POP ═══════════════════
  window.gsapStatPop = function(el) {
    if (!el) return;
    gsap.fromTo(el, { scale:1.4, color:'#e8dfcc' }, { scale:1, color:'', duration:0.5, ease:'elastic.out(1, 0.5)' });
  };

  // ═══════════════════ INIT ═══════════════════
  createTitleParticles();
  titleEntrance();

  // Re-init particles and entrance when returning to title
  var _titleObserver = new MutationObserver(function(ms) {
    ms.forEach(function(m) {
      if (m.target.classList.contains('active')) {
        createTitleParticles();
        titleEntrance();
      }
    });
  });
  var ts = document.getElementById('title-screen');
  if (ts) _titleObserver.observe(ts, { attributes:true, attributeFilter:['class'] });

  console.log('GSAP 动效模块已就绪');
})();
