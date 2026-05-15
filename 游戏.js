// ═══════════════════ LOCAL IDENTITY SYSTEM ═══════════════════
// currentUser.type: 'guest' | 'cloud'
let currentUser = null; // { id, email, displayName, type }
var supabaseSession = null; // { access_token, refresh_token, expires_at, user }

function makeId() { return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// ═══════════════════ SCOPED STORAGE ═══════════════════
// All save data is now keyed by identity scope — guest vs cloud accounts are fully isolated.
function getStorageScope() {
  if (!currentUser) return null;
  if (currentUser.type === 'guest') return 'guest:' + currentUser.id;
  if (currentUser.type === 'cloud') return 'cloud:' + currentUser.id;
  return null;
}
function getAutoSaveKey() {
  var scope = getStorageScope();
  if (!scope) return null;
  return 'text_adventure_save:' + scope + ':auto';
}
function getSaveKey(slot) {
  var scope = getStorageScope();
  if (!scope) return null;
  return 'text_adventure_save:' + scope + ':slot:' + slot;
}
// ── Cloud session helpers ──
function hasCloud() {
  return !!(supabaseSession && supabaseSession.access_token);
}
function getCloudUser() {
  if (!hasCloud()) return null;
  if (supabaseSession.user) return supabaseSession.user;
  // Decode JWT payload to extract user info
  try {
    var payload = supabaseSession.access_token.split('.')[1];
    var decoded = JSON.parse(atob(payload));
    return { id: decoded.sub, email: decoded.email };
  } catch(e) { return null; }
}

function saveIdentity(id) {
  var identity = { id: id.id, email: id.email, displayName: id.displayName || id.email, type: id.type || 'guest', createdAt: id.createdAt || new Date().toISOString() };
  localStorage.setItem('text_adventure_identity', JSON.stringify(identity));
}
function loadIdentity() {
  try { return JSON.parse(localStorage.getItem('text_adventure_identity')); } catch(e) { return null; }
}
function initIdentity() {
  var id = loadIdentity();
  if (id) {
    // Normalize: old 'local' type is now 'guest' (local accounts removed)
    var normType = id.type === 'local' ? 'guest' : (id.type || 'guest');
    currentUser = { id: id.id, email: id.email, displayName: id.displayName || id.email, type: normType };
    if (normType !== id.type) {
      // Persist the normalization
      id.type = normType;
      saveIdentity(id);
    }
  }
  var savedSession = localStorage.getItem('text_adventure_session');
  if (savedSession) {
    try {
      supabaseSession = JSON.parse(savedSession);
      // Validate session hasn't expired
      if (supabaseSession && supabaseSession.expires_at) {
        var now = Math.floor(Date.now() / 1000);
        if (now >= supabaseSession.expires_at) {
          // Try refresh
          refreshSession().catch(function() {
            supabaseSession = null;
            localStorage.removeItem('text_adventure_session');
          });
        }
      }
    } catch(e) { supabaseSession = null; }
  }
  updateAuthUI();
}

async function refreshSession() {
  if (!supabaseSession || !supabaseSession.refresh_token) {
    supabaseSession = null;
    localStorage.removeItem('text_adventure_session');
    return;
  }
  try {
    var resp = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: supabaseSession.refresh_token })
    });
    if (!resp.ok) {
      supabaseSession = null;
      localStorage.removeItem('text_adventure_session');
      return;
    }
    var data = await resp.json();
    if (data.access_token) supabaseSession = data;
    localStorage.setItem('text_adventure_session', JSON.stringify(supabaseSession));
  } catch(e) {
    // Network error — keep existing session, it might still be valid
  }
}

function changeDisplayName() {
  if (!currentUser) return;
  var name = prompt('输入新用户名', currentUser.displayName || currentUser.email);
  if (!name || !name.trim()) return;
  name = name.trim().substring(0, 20);
  currentUser.displayName = name;
  var id = loadIdentity();
  if (id) { id.displayName = name; saveIdentity(id); }
  updateAuthUI();
  toast('用户名已更新 ✨');
}

function guestLogin() {
  var name = '游客_' + makeId().slice(-4);
  var id = { id: makeId(), email: name, displayName: name, type: 'guest', createdAt: new Date().toISOString() };
  saveIdentity(id);
  currentUser = { id: id.id, email: id.email, displayName: name, type: 'guest' };
  supabaseSession = null;
  localStorage.removeItem('text_adventure_session');

  // Migrate old global saves to scoped guest keys (one-time)
  if (!localStorage.getItem('text_adventure_migration_scoped_v1')) {
    var oldAuto = localStorage.getItem('text_adventure_save');
    if (oldAuto) {
      try {
        localStorage.setItem(getAutoSaveKey(), oldAuto);
      } catch(e) {}
    }
    for (var mi = 0; mi < 10; mi++) {
      var oldSlot = localStorage.getItem('text_adventure_slot_' + mi);
      if (!oldSlot) oldSlot = localStorage.getItem('text_adventure_slot_' + (mi + 1));
      if (oldSlot) {
        try { localStorage.setItem(getSaveKey(mi), oldSlot); } catch(e) {}
      }
    }
    localStorage.setItem('text_adventure_migration_scoped_v1', 'true');
  }

  updateAuthUI();
  toast('游客模式：存档仅保存在当前浏览器。');
  refreshTitleButtons();
}

// Normalize phone number to email format for Supabase, keep original for display
function normalizeAccount(input) {
  var trimmed = input.trim();
  if (/^1[3-9]\d{9}$/.test(trimmed)) {
    return { account: trimmed + '@phone.user', display: trimmed, type: 'phone' };
  }
  return { account: trimmed, display: trimmed, type: 'email' };
}

// Timeout wrapper for async calls
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('timeout')); }, ms);
    })
  ]);
}

async function localRegister(input, password) {
  if (!input || !password) { toast('请输入手机号/邮箱和密码', 'error'); return; }
  if (password.length < 6) { toast('密码至少6位', 'error'); return; }
  var norm = normalizeAccount(input);
  var account = norm.account;
  var display = norm.display;

  var result = await withTimeout(cloudSignUp(account, password), 10000).catch(function(e) {
    return { ok: false, error: '网络超时，请检查网络后重试' };
  });

  if (!result.ok) {
    if (result.error && result.error.indexOf('already') !== -1) {
      toast('该账号已注册，请直接登录', 'error');
    } else {
      toast('注册失败：' + (result.error || '未知错误'), 'error');
    }
    return;
  }

  if (result.data && result.data.user) {
    var cloudUser = result.data.user;
    var oldIdentity = loadIdentity();
    var suid = cloudUser.id;
    var nickname = norm.type === 'email' ? display.split('@')[0] : display;
    var id = { id: suid, email: display, displayName: nickname, type: 'cloud', createdAt: new Date().toISOString() };
    if (result.data.session) {
      saveIdentity(id);
      currentUser = { id: suid, email: display, displayName: nickname, type: 'cloud' };
      updateAuthUI();
      closeAuthModal();
      toast('注册成功，「' + display + '」已登录 ☁️');
      refreshTitleButtons();
      if (oldIdentity && oldIdentity.id !== suid) migrateSaves(oldIdentity.id, suid);
      return;
    } else {
      toast('已发送确认邮件到 ' + display + '，请查收后登录 📧');
      closeAuthModal();
      return;
    }
  }

  toast('注册失败：服务器未返回用户信息，请稍后重试', 'error');
}

async function localSignIn(input, password) {
  if (!input || !password) { toast('请输入手机号/邮箱和密码', 'error'); return; }
  var norm = normalizeAccount(input);
  var account = norm.account;
  var display = norm.display;

  var result = await withTimeout(cloudSignIn(account, password), 10000).catch(function(e) {
    return { ok: false, error: '网络超时，请检查网络后重试' };
  });

  if (!result.ok) {
    toast('登录失败：' + (result.error || '未知错误'), 'error');
    return;
  }

  if (result.data && result.data.user) {
    var cloudUser = result.data.user;
    var oldIdentity = loadIdentity();
    var suid = cloudUser.id;
    var nickname = norm.type === 'email' ? display.split('@')[0] : display;
    var id = { id: suid, email: display, displayName: nickname, type: 'cloud', createdAt: cloudUser.created_at || new Date().toISOString() };
    saveIdentity(id);
    currentUser = { id: suid, email: display, displayName: nickname, type: 'cloud' };
    updateAuthUI();
    closeAuthModal();
    toast('已登录云端账号，可跨设备同步存档。');
    refreshTitleButtons();
    if (oldIdentity && oldIdentity.id !== suid) migrateSaves(oldIdentity.id, suid);
    return;
  }

  toast('登录失败：服务器未返回用户信息', 'error');
}

async function signOut() {
  // Call Supabase signOut if we have a session
  if (supabaseSession && supabaseSession.access_token) {
    try {
      await fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + supabaseSession.access_token, 'Content-Type': 'application/json' }
      });
    } catch(e) { /* best-effort */ }
  }
  var wasCloud = hasCloud();
  currentUser = null;
  supabaseSession = null;
  localStorage.removeItem('text_adventure_session');
  updateAuthUI();
  if (wasCloud) toast('已退出云端账号，请以游客身份继续或登录其他账号。');
  else toast('已退出登录。');
  refreshTitleButtons();
}

function updateAuthUI() {
  var loggedOut = document.getElementById('auth-logged-out');
  var loggedIn = document.getElementById('auth-logged-in');
  var emailEl = document.getElementById('auth-user-email');
  if (currentUser) {
    if (loggedOut) loggedOut.classList.add('hidden');
    if (loggedIn) loggedIn.classList.remove('hidden');
    if (emailEl) {
      var typeLabel = '';
      if (currentUser.type === 'cloud') typeLabel = ' ☁️云端';
      else if (currentUser.type === 'guest') typeLabel = ' 👤游客';
      emailEl.textContent = (currentUser.displayName || currentUser.email) + typeLabel;
      emailEl.title = '账号: ' + currentUser.email + '\n类型: ' + (currentUser.type === 'cloud' ? '云端账号' : '游客') + '\n点击修改用户名';
      emailEl.style.cursor = 'pointer';
      emailEl.onclick = changeDisplayName;
    }
  } else {
    if (loggedOut) loggedOut.classList.remove('hidden');
    if (loggedIn) loggedIn.classList.add('hidden');
  }
}

function showLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('auth-email').focus();
}
function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
}
function clearAuthInputs() {
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
}
function closeAuthModal() {
  closeLoginModal();
  clearAuthInputs();
}
function handleSignIn() {
  var input = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value.trim();
  if (!input || !password) { toast('请输入手机号/邮箱和密码', 'error'); return; }
  var btn = document.getElementById('btn-signin');
  btn.disabled = true; btn.textContent = '处理中...';
  localSignIn(input, password).finally(function() {
    btn.disabled = false; btn.textContent = '登 录';
  });
}
function handleRegister() {
  var input = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value.trim();
  if (!input || !password) { toast('请输入手机号/邮箱和密码', 'error'); return; }
  if (password.length < 6) { toast('密码至少6位', 'error'); return; }
  var btn = document.getElementById('btn-signup');
  btn.disabled = true; btn.textContent = '处理中...';
  localRegister(input, password).finally(function() {
    btn.disabled = false; btn.textContent = '注 册';
  });
}
function refreshTitleLocalSaveButtons() {
  // Only guest/cloud with no cloud session show local-scoped saves
  if (hasCloud()) {
    // Cloud user: hide local-only buttons, cloud refresh handles button visibility
    return;
  }

  var scope = getStorageScope();
  if (!scope) {
    // No current user — hide all
    var btnContinue = document.getElementById('btn-continue');
    var btnLoadSlot = document.getElementById('btn-load-slot');
    if (btnContinue) btnContinue.style.display = 'none';
    if (btnLoadSlot) btnLoadSlot.style.display = 'none';
    return;
  }

  var autoKey = getAutoSaveKey();
  var raw = autoKey ? localStorage.getItem(autoKey) : null;
  var hasSave = !!raw;
  var btnContinue = document.getElementById('btn-continue');
  var btnLoadSlot = document.getElementById('btn-load-slot');
  if (hasSave) {
    try {
      var save = JSON.parse(raw);
      if (save.gameStarted) { btnContinue.style.display = ''; }
      else { btnContinue.style.display = 'none'; }
    } catch(e) { btnContinue.style.display = 'none'; }
  } else {
    btnContinue.style.display = 'none';
  }
  // Check for scoped manual save slots
  var hasSlots = false;
  for (var i = 0; i < SAVE_SLOTS; i++) {
    if (localStorage.getItem(getSaveKey(i))) { hasSlots = true; break; }
  }
  if (btnLoadSlot) btnLoadSlot.style.display = hasSlots ? '' : 'none';
}

function refreshTitleButtons() {
  refreshTitleLocalSaveButtons();
  refreshTitleCloudSaveButtons();
  showScreen('title');
}

var _cloudRefreshSeq = 0;

async function refreshTitleCloudSaveButtons() {
  if (!hasCloud()) return;
  var cloudUser = getCloudUser();
  if (!cloudUser || !cloudUser.id) return;
  var seq = ++_cloudRefreshSeq;
  var capturedUserId = cloudUser.id;

  try {
    var result = await cloudListSlots();
    // Guard: user may have logged out or switched accounts during async
    // Also guard: if another cloud refresh started after us, discard stale results
    if (seq !== _cloudRefreshSeq) return;
    if (!hasCloud()) return;
    var currentCloudUser = getCloudUser();
    if (!currentCloudUser || currentCloudUser.id !== capturedUserId) return;

    if (!result.ok) {
      console.warn('[Cloud] 云端存档检查失败：' + (result.error || '未知错误'));
      return;
    }

    var slots = result.data || [];
    if (slots.length === 0) return;

    // "读取存档" button — show if any cloud slots exist
    var btnLoadSlot = document.getElementById('btn-load-slot');
    if (btnLoadSlot) btnLoadSlot.style.display = '';

    // "继续游戏" button — show if cloud has auto-save AND no current-identity-scoped local auto-save
    var hasAutoSave = slots.some(function(s) { return s.slot === AUTO_SAVE_SLOT; });
    if (!hasAutoSave) return;
    var autoKey = getAutoSaveKey();
    var localRaw = autoKey ? localStorage.getItem(autoKey) : null;
    if (localRaw) {
      try { if (JSON.parse(localRaw).gameStarted === true) return; } catch(e) {}
    }
    var savedKey = localStorage.getItem('text_adventure_apikey');
    if (savedKey) {
      var apiInput = document.getElementById('api-key-input');
      if (apiInput && !apiInput.value) apiInput.value = savedKey;
    }
    var btnContinue = document.getElementById('btn-continue');
    if (btnContinue) btnContinue.style.display = '';
  } catch(e) {
    if (seq !== _cloudRefreshSeq) return;
    console.warn('[Cloud] 云端存档检查异常：' + (e.message || '未知错误'));
  }
}

// ═══════════════════ SUPABASE CLOUD SYNC (Database-backed, no Storage) ═══════════════════
var SUPABASE_URL = 'https://cydvlahdycqttljesokw.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_7Mumb6XajwxrcUB9kNO1ow_Idx_Br_p';

// ── HTTP helpers ──
function cloudAuthHeaders() {
  return { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}
function cloudDbHeaders() {
  // Must have valid session for Database RLS to work
  if (!supabaseSession || !supabaseSession.access_token) {
    throw new Error('未登录云端账号');
  }
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + supabaseSession.access_token,
    'Content-Type': 'application/json'
  };
}

// ── Auth ──
async function cloudSignUp(account, password) {
  try {
    var resp = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: cloudAuthHeaders(),
      body: JSON.stringify({ email: account, password: password })
    });
    var data = await resp.json().catch(function() { return {}; });
    if (!resp.ok) {
      var msg = data.msg || data.message || ('HTTP ' + resp.status);
      if (resp.status === 429) msg = '注册过于频繁，请稍后再试';
      return { ok: false, error: msg };
    }
    if (data.session && data.session.access_token) {
      supabaseSession = data.session;
      localStorage.setItem('text_adventure_session', JSON.stringify(supabaseSession));
    } else if (data.access_token) {
      supabaseSession = data;
      localStorage.setItem('text_adventure_session', JSON.stringify(supabaseSession));
    }
    return { ok: true, data: { user: data.user || data, session: data.session || (data.access_token ? data : null) } };
  } catch(e) {
    return { ok: false, error: '网络连接失败：' + (e.message || '未知错误') };
  }
}

async function cloudSignIn(account, password) {
  try {
    var resp = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: cloudAuthHeaders(),
      body: JSON.stringify({ email: account, password: password })
    });
    var data = await resp.json().catch(function() { return {}; });
    if (!resp.ok) {
      var msg = data.error_description || data.msg || data.message || ('HTTP ' + resp.status);
      return { ok: false, error: msg };
    }
    if (data.access_token) {
      supabaseSession = data;
      localStorage.setItem('text_adventure_session', JSON.stringify(supabaseSession));
    }
    return { ok: true, data: { user: data.user || { id: data.user_id || 'u_' + account, email: account }, session: data } };
  } catch(e) {
    return { ok: false, error: '网络连接失败：' + (e.message || '未知错误') };
  }
}

// ── SAVE CRUD (Database-backed) ──

function stripApiKeyFromSave(snap) {
  // Ensure no apiKey leaks into cloud saves
  var clean = Object.assign({}, snap);
  delete clean.apiKey;
  return clean;
}

async function cloudSave(slot) {
  if (!hasCloud()) return { ok: false, error: '未登录云端账号' };
  var cloudUser = getCloudUser();
  if (!cloudUser || !cloudUser.id) return { ok: false, error: '无法获取云端用户信息' };
  try {
    var snap = serializeState();
    var clean = stripApiKeyFromSave(snap);
    var row = {
      user_id: cloudUser.id,
      slot: slot,
      save_data: clean,
      title: (snap.plot && snap.plot.chapterTitle) ? ('第' + snap.plot.chapter + '章 ' + snap.plot.chapterTitle) : '',
      world_name: snap.worldGenre || '',
      character_name: snap.playerName || ''
    };
    // Upsert via POST with Prefer: resolution=merge-duplicates
    var resp = await fetch(SUPABASE_URL + '/rest/v1/game_saves?on_conflict=user_id,slot', {
      method: 'POST',
      headers: Object.assign({ 'Prefer': 'resolution=merge-duplicates,return=representation' }, cloudDbHeaders()),
      body: JSON.stringify(row)
    });
    if (!resp.ok) {
      var errText = await resp.text().catch(function() { return 'HTTP ' + resp.status; });
      return { ok: false, error: '云端保存失败 (' + resp.status + '): ' + errText };
    }
    return { ok: true, data: row };
  } catch(e) {
    return { ok: false, error: '云端保存失败：' + (e.message || '未知错误') };
  }
}

async function cloudLoad(slot) {
  if (!hasCloud()) return { ok: false, error: '未登录云端账号' };
  var cloudUser = getCloudUser();
  if (!cloudUser || !cloudUser.id) return { ok: false, error: '无法获取云端用户信息' };
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/game_saves?user_id=eq.' + encodeURIComponent(cloudUser.id) + '&slot=eq.' + slot + '&limit=1', {
      headers: cloudDbHeaders()
    });
    if (!resp.ok) {
      return { ok: false, error: '云端读取失败 (HTTP ' + resp.status + ')' };
    }
    var rows = await resp.json();
    if (!rows || rows.length === 0) return { ok: false, error: '云端存档不存在' };
    return { ok: true, data: rows[0].save_data };
  } catch(e) {
    return { ok: false, error: '云端读取失败：' + (e.message || '未知错误') };
  }
}

async function cloudDelete(slot) {
  if (!hasCloud()) return { ok: false, error: '未登录云端账号' };
  var cloudUser = getCloudUser();
  if (!cloudUser || !cloudUser.id) return { ok: false, error: '无法获取云端用户信息' };
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/game_saves?user_id=eq.' + encodeURIComponent(cloudUser.id) + '&slot=eq.' + slot, {
      method: 'DELETE',
      headers: cloudDbHeaders()
    });
    if (!resp.ok) {
      return { ok: false, error: '云端删除失败 (HTTP ' + resp.status + ')' };
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, error: '云端删除失败：' + (e.message || '未知错误') };
  }
}

async function cloudListSlots() {
  if (!hasCloud()) return { ok: false, error: '未登录云端账号', data: [] };
  var cloudUser = getCloudUser();
  if (!cloudUser || !cloudUser.id) return { ok: false, error: '无法获取云端用户信息', data: [] };
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/game_saves?select=slot,title,world_name,character_name,updated_at&user_id=eq.' + encodeURIComponent(cloudUser.id) + '&order=updated_at.desc', {
      headers: cloudDbHeaders()
    });
    if (!resp.ok) {
      return { ok: false, error: '云端列表获取失败 (HTTP ' + resp.status + ')', data: [] };
    }
    var rows = await resp.json();
    return { ok: true, data: rows };
  } catch(e) {
    return { ok: false, error: '云端列表获取失败：' + (e.message || '未知错误'), data: [] };
  }
}

// ── Migration (upload scoped local saves to cloud, best-effort) ──
async function migrateSaves(oldId, newId) {
  if (!oldId || oldId === newId) return;
  if (!hasCloud()) return;

  var guestScopePrefix = 'text_adventure_save:guest:' + oldId;

  try {
    // Auto-save — try scoped guest key first, then old global key
    var asRaw = localStorage.getItem(guestScopePrefix + ':auto');
    if (!asRaw) asRaw = localStorage.getItem('text_adventure_save');
    if (asRaw) {
      var snap = JSON.parse(asRaw);
      if (snap.gameStarted) {
        var clean = stripApiKeyFromSave(snap);
        await fetch(SUPABASE_URL + '/rest/v1/game_saves?on_conflict=user_id,slot', {
          method: 'POST',
          headers: Object.assign({ 'Prefer': 'resolution=merge-duplicates' }, cloudDbHeaders()),
          body: JSON.stringify({
            user_id: newId, slot: 0,
            save_data: clean,
            title: (snap.plot && snap.plot.chapterTitle) ? ('第' + snap.plot.chapter + '章 ' + snap.plot.chapterTitle) : '',
            world_name: snap.worldGenre || '',
            character_name: snap.playerName || ''
          })
        });
      }
    }
    // Manual slots (0-9) — try scoped guest keys first, then old global
    for (var s = 0; s < 10; s++) {
      var raw = localStorage.getItem(guestScopePrefix + ':slot:' + s);
      if (!raw) raw = localStorage.getItem('text_adventure_slot_' + s);
      if (!raw) raw = localStorage.getItem('text_adventure_slot_' + (s + 1));
      if (raw) {
        var ssnap = JSON.parse(raw);
        var sclean = stripApiKeyFromSave(ssnap);
        await fetch(SUPABASE_URL + '/rest/v1/game_saves?on_conflict=user_id,slot', {
          method: 'POST',
          headers: Object.assign({ 'Prefer': 'resolution=merge-duplicates' }, cloudDbHeaders()),
          body: JSON.stringify({
            user_id: newId, slot: s,
            save_data: sclean,
            title: '',
            world_name: ssnap.worldGenre || '',
            character_name: ssnap.playerName || ''
          })
        });
      }
    }
    console.log('[Migrate] Guest saves uploaded to cloud under new user ID');
  } catch(e) { console.warn('[Migrate] Migration failed:', e); }
}

function getWorldStatType(genre) {
  const fantasy = ['奇幻仙侠','传统玄幻','武侠江湖','仙侠修真','西幻史诗','都市修真','玄幻言情','古言脑洞','蒸汽朋克','无限流','穿越小说'];
  const modern = ['霸总','霸总言情','赘婿','赘婿逆袭','战神','兵王归来','重生崛起','重生复仇','宫斗宅斗','禁忌情缘','都市高武','都市异能','权谋高干','年代文','双男主','马甲','萌宝'];
  const scifi = ['科幻','赛博朋克','末日废土','星际科幻'];
  const horror = ['克苏鲁','悬疑灵异','灵异怪谈'];
  if (fantasy.includes(genre)) return 'fantasy';
  if (modern.includes(genre)) return 'modern';
  if (scifi.includes(genre)) return 'scifi';
  if (horror.includes(genre)) return 'horror';
  return 'fantasy';
}

function getWorldStats(genre) {
  const type = getWorldStatType(genre);
  return WORLD_STAT_CONFIG[type];
}

// ═══════════════════ GENRE PLOT FRAMEWORKS ═══════════════════

function getPlotFramework(genre) {
  const type = getWorldStatType(genre);
  return GENRE_PLOT_FRAMEWORK[type] || GENRE_PLOT_FRAMEWORK.fantasy;
}

function getInitialPlot(genre) {
  const framework = getPlotFramework(genre);
  return {
    stage: 'opening',
    mainThread: '',
    activeThreads: [],
    completedMilestones: [],
    pendingHooks: [],
    tension: 1,
    chapter: 1,
    chapterTitle: '序幕',
    summary: '',
    genreLabel: framework.label,
  };
}

// ═══════════════════ CHARACTER TEMPLATES ═══════════════════

let _inputHistory = [];
let _inputHistoryIdx = -1;
let _novelCharacters = null;
let _novelKeyFacts = null;
let state = {
  screen: 'title',
  apiKey: '',
  worldGenre: '',
  customWorldDesc: '',
  playerName: '',
  characterSheet: { gender: '', attributes: {} },
  stats: { ...DEFAULT_STATS },
  inventory: [],
  location: '',
  worldMemory: '',
  relationships: [],    // { name, title, relation, notes }
  fullHistory: [],      // { role:'player'|'world', content } for display
  apiHistory: [],       // trimmed message array for API calls
  plot: null,           // populated at game start: { stage, mainThread, activeThreads, ... }
  gameStarted: false,
  annals: [],           // { chapter, title, event, stage, timestamp }
  unlockedAchievements: [],
  storyStyle: 'epic',
  chaosLevel: 'medium',
  recklessCount: 0,
  critFailCount: 0,
  critSuccessCount: 0,
};

// ═══════════════════ PERSISTENCE ═══════════════════
function serializeState() {
  return {
    worldGenre: state.worldGenre,
    customWorldDesc: state.customWorldDesc,
    playerName: state.playerName,
    characterSheet: state.characterSheet,
    stats: state.stats,
    inventory: state.inventory,
    location: state.location,
    worldMemory: state.worldMemory,
    relationships: state.relationships,
    fullHistory: state.fullHistory.slice(-100),
    apiHistory: state.apiHistory.slice(-40),
    plot: state.plot,
    gameStarted: state.gameStarted,
    annals: state.annals || [],
    unlockedAchievements: state.unlockedAchievements || [],
    storyStyle: state.storyStyle || 'epic',
    chaosLevel: state.chaosLevel || 'medium',
    recklessCount: state.recklessCount || 0,
    critFailCount: state.critFailCount || 0,
    critSuccessCount: state.critSuccessCount || 0,
    activeFrequency: state.activeFrequency || 'male',
    savedAt: new Date().toISOString(),
  };
}

function deserializeState(save) {
  state.apiKey = localStorage.getItem('text_adventure_apikey') || '';
  state.worldGenre = save.worldGenre || '';
  state.customWorldDesc = save.customWorldDesc || '';
  state.playerName = save.playerName || '';
  state.characterSheet = save.characterSheet || { gender: '', attributes: {} };
  state.stats = save.stats || { ...DEFAULT_STATS };
  state.inventory = save.inventory || [];
  state.location = save.location || '';
  state.worldMemory = save.worldMemory || '';
  state.relationships = (save.relationships || []).map(r => ({
    name: r.name,
    title: r.title || '',
    relation: r.relation || r.bond || '相识',
    notes: r.notes || '',
  }));
  state.fullHistory = save.fullHistory || [];
  state.apiHistory = save.apiHistory || [];
  state.plot = save.plot || getInitialPlot(state.worldGenre);
  state.gameStarted = save.gameStarted || false;
  state.activeFrequency = save.activeFrequency || 'male';
  state.annals = save.annals || [];
  state.unlockedAchievements = save.unlockedAchievements || [];
  state.storyStyle = save.storyStyle || 'epic';
  state.chaosLevel = save.chaosLevel || 'medium';
  state.recklessCount = save.recklessCount || 0;
  state.critFailCount = save.critFailCount || 0;
  state.critSuccessCount = save.critSuccessCount || 0;
}

// Auto-save slot: use 0 (was -1 in older versions, now unified)
var AUTO_SAVE_SLOT = 0;

function saveState() {
  var snap = serializeState();
  // Always save to scoped localStorage
  var autoKey = getAutoSaveKey();
  if (autoKey) localStorage.setItem(autoKey, JSON.stringify(snap));
  // Cloud: also sync to Supabase
  if (hasCloud()) {
    cloudSave(AUTO_SAVE_SLOT).then(function(result) {
      if (!result.ok) toast('本地缓存已保存，但云端同步失败：' + (result.error || '未知错误'), 'error');
    });
  }
}

function loadSave() {
  var autoKey = getAutoSaveKey();
  if (!autoKey) return false;
  var raw = localStorage.getItem(autoKey);
  if (!raw) return false;
  try {
    var save = JSON.parse(raw);
    deserializeState(save);
    return save.gameStarted === true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════ SCREEN MANAGEMENT ═══════════════════
function selectFrequency(freq) {
  state.activeFrequency = freq;
  state.worldGenre = '';
  document.querySelectorAll('.genre-card').forEach(c => c.classList.remove('selected'));
  const cd = document.getElementById('custom-world-desc');
  const ab = document.getElementById('ai-gen-world-btn');
  const na = document.getElementById('novel-upload-area');
  if (cd) cd.classList.add('hidden');
  if (ab) ab.classList.add('hidden');
  if (na) na.classList.add('hidden');
  showScreen('world');
  const worldScreen = document.getElementById('world-screen');
  const applyFreqGrids = () => {
    worldScreen.removeEventListener('transitionend', applyFreqGrids);
    const gridMale = document.getElementById('grid-male');
    const gridFemale = document.getElementById('grid-female');
    const tabCommon = document.getElementById('tab-common-world');
    const randomBtn = document.querySelector('#world-screen .btn-random-all');
    const worldLabel = document.getElementById('world-freq-label');
    const isMale = freq === 'male';
    if (gridMale) gridMale.style.display = isMale ? 'grid' : 'none';
    if (gridFemale) gridFemale.style.display = isMale ? 'none' : 'grid';
    if (tabCommon) tabCommon.style.display = 'none';
    if (randomBtn) randomBtn.style.display = '';
    if (worldLabel) worldLabel.textContent = isMale ? '男频世界' : '女频世界';
  };
  worldScreen.addEventListener('transitionend', applyFreqGrids, { once: true });
}

function goToFreqScreen() {
  const key = document.getElementById('api-key-input')?.value.trim();
  if (!key) { toast('请先输入 DeepSeek API 密钥', 'error'); return; }
  state.apiKey = key;
  localStorage.setItem('text_adventure_apikey', key);
  showScreen('freq');
}

function showScreen(name) {
  const oldScreen = state.screen;
  if (oldScreen === name) return;
  state.screen = name;

  // Transition-out current screen
  const currentEl = document.getElementById(oldScreen + '-screen');
  if (currentEl) {
    currentEl.classList.remove('active');
    clearTimeout(currentEl._hideTimeout);
    currentEl._hideTimeout = setTimeout(() => {
      currentEl.classList.add('hidden');
    }, 310);
  }

  // Transition-in new screen
  const screenEl = document.getElementById(name + '-screen');
  if (screenEl) {
    screenEl.classList.remove('hidden');
    void screenEl.offsetWidth;
    screenEl.classList.add('active');
    clearTimeout(screenEl._hideTimeout);
  }

  if (name === 'world') {
    const label = document.getElementById('world-freq-label');
    const isMale = state.activeFrequency === 'male';
    if (label) label.textContent = isMale ? '男频世界' : '女频世界';
    if (state.worldGenre) {
      selectGenreCard(state.worldGenre);
    } else {
      selectGenreCard(isMale ? '奇幻仙侠' : '宫斗宅斗');
    }
  }

  if (name === 'char') {
    document.getElementById('player-name-input').value = state.playerName;
    renderCharacterCreation(state.worldGenre || (state.activeFrequency === 'male' ? '奇幻仙侠' : '宫斗宅斗'));
    if (state.characterSheet.gender) selectGender(state.characterSheet.gender);
  }

  if (name === 'game') {
    updateStatsBar();
    document.getElementById('command-input').focus();
  }

  if (name === 'title') {
    refreshTitleLocalSaveButtons();
    refreshTitleCloudSaveButtons();
  }
}

// ═══════════════════ SETTINGS ═══════════════════
function selectGenreCard(genre) {
  state.worldGenre = genre;
  document.querySelectorAll('.genre-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.genre-card[data-genre="${genre}"]`);
  if (card) card.classList.add('selected');

  const customDesc = document.getElementById('custom-world-desc');
  const aiBtn = document.getElementById('ai-gen-world-btn');
  const novelArea = document.getElementById('novel-upload-area');
  const gridMale = document.getElementById('grid-male');
  const gridFemale = document.getElementById('grid-female');
  const tabCommon = document.getElementById('tab-common-world');
  const randomBtn = document.querySelector('#world-screen .btn-random-all');
  const worldLabel = document.getElementById('world-freq-label');

  // Hide all conditional UIs first
  if (customDesc) customDesc.classList.add('hidden');
  if (aiBtn) aiBtn.classList.add('hidden');
  if (novelArea) novelArea.classList.add('hidden');

  if (genre === '自定义') {
    if (gridMale) gridMale.style.display = 'none';
    if (gridFemale) gridFemale.style.display = 'none';
    if (tabCommon) tabCommon.style.display = 'none';
    if (randomBtn) randomBtn.style.display = 'none';
    if (worldLabel) worldLabel.textContent = '书写你自己的世界';
    if (customDesc) { customDesc.classList.remove('hidden'); customDesc.value = state.customWorldDesc; }
    if (aiBtn) aiBtn.classList.remove('hidden');
  } else if (genre === '穿越小说') {
    if (gridMale) gridMale.style.display = 'none';
    if (gridFemale) gridFemale.style.display = 'none';
    if (tabCommon) tabCommon.style.display = 'none';
    if (randomBtn) randomBtn.style.display = 'none';
    if (worldLabel) worldLabel.textContent = '上传小说，穿越其中';
    if (novelArea) novelArea.classList.remove('hidden');
  } else {
    const isMale = state.activeFrequency === 'male';
    if (gridMale) gridMale.style.display = isMale ? 'grid' : 'none';
    if (gridFemale) gridFemale.style.display = isMale ? 'none' : 'grid';
    if (tabCommon) tabCommon.style.display = 'none';
    if (randomBtn) randomBtn.style.display = '';
    if (worldLabel) worldLabel.textContent = isMale ? '男频世界' : '女频世界';
  }
  if (state.screen === 'freq' && (genre === '自定义' || genre === '穿越小说')) {
    showScreen('world');
  }
  if (state.screen === 'char') renderCharacterCreation(genre);
}



// ═══════════════════ CHARACTER CREATION ═══════════════════
function renderCharacterCreation(genre) {
  const container = document.getElementById('char-attrs-container');
  const template = CHARACTER_TEMPLATES[genre];

  if (!template) {
    // Custom genre — just a text area for character description
    container.innerHTML = `
      <div class="cc-section">
        <div class="cc-label">角色描述 <span class="cc-desc">自由描述你的角色</span> <button class="cc-random" onclick="aiGenerateCharacter()" style="margin-left:8px">✨ AI 随机</button></div>
        <textarea id="custom-char-desc" placeholder="外貌、性格、背景、能力……越详细越好" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:12px 16px;font-size:14px;font-family:var(--font-narrative);border-radius:var(--radius);resize:vertical;min-height:100px;"></textarea>
      </div>`;
    if (state.characterSheet.customDesc) {
      document.getElementById('custom-char-desc').value = state.characterSheet.customDesc;
    }
    return;
  }

  // Only reset attributes when switching to a different genre
  if (!state.characterSheet) state.characterSheet = { gender: '', attributes: {} };
  if (state._prevGenre !== genre) {
    state.characterSheet.attributes = {};
    state._prevGenre = genre;
  }

  let html = '';
  template.forEach(section => {
    const selectedVal = state.characterSheet.attributes[section.id] || '';
    const isCustom = selectedVal && !section.options.includes(selectedVal);
    html += `<div class="cc-section">
      <div class="cc-label">${section.label} ${section.desc ? `<span class="cc-desc">${section.desc}</span>` : ''}</div>
      <div class="cc-options" data-attr="${section.id}">`;
    section.options.forEach(opt => {
      const selClass = (opt === selectedVal) ? ' selected' : '';
      html += `<div class="cc-option${selClass}" data-value="${escapeHtml(opt)}" onclick="selectCharOption('${section.id}', '${escapeHtml(opt).replace(/'/g, "&#39;")}', this)">${opt}</div>`;
    });
    const customSelected = isCustom ? ' selected' : '';
    html += `<div class="cc-option cc-option-custom${customSelected}" data-value="__custom__" onclick="toggleCustomAttr('${section.id}', this)" title="自定义">✎</div>`;
    html += `<button class="cc-random" onclick="event.stopPropagation();randomAttribute('${section.id}')">🎲</button>`;
    html += `<input type="text" class="cc-custom-input hidden" placeholder="输入自定义内容…" value="${isCustom ? escapeHtml(selectedVal) : ''}" data-attr="${section.id}" onkeydown="if(event.key==='Enter'){event.preventDefault();confirmCustomAttr('${section.id}', this)}" onblur="confirmCustomAttr('${section.id}', this)">`;
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function renderOptionGrid(containerId, options, selectedValue, onClickFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  options.forEach(o => {
    const sel = o.id === selectedValue ? ' selected' : '';
    html += `<div class="cc-option${sel}" data-value="${o.id}" onclick="${onClickFn}('${o.id}', this)" title="${escapeHtml(o.desc || '')}">${o.icon || ''} ${o.name}</div>`;
  });
  container.innerHTML = html;
}

function selectOption(containerSelector, el) {
  document.querySelectorAll(containerSelector + ' .cc-option').forEach(o => o.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

function renderDestinyOptions() {
  renderOptionGrid('destiny-options', DESTINIES, state.characterSheet.destiny || '', 'selectDestiny');
}
function selectDestiny(id, el) {
  state.characterSheet.destiny = id;
  selectOption('#destiny-options', el);
}
function randomDestiny() {
  const d = DESTINIES[Math.floor(Math.random() * DESTINIES.length)];
  state.characterSheet.destiny = d.id;
  renderDestinyOptions();
  toast('命格：' + d.name);
}

function renderStoryStyleOptions() {
  renderOptionGrid('story-style-options', STORY_STYLES, state.storyStyle || 'epic', 'selectStoryStyle');
}
function selectStoryStyle(id, el) {
  state.storyStyle = id;
  selectOption('#story-style-options', el);
}

function renderChaosLevelOptions() {
  renderOptionGrid('chaos-level-options', CHAOS_LEVELS, state.chaosLevel || 'medium', 'selectChaosLevel');
}
function selectChaosLevel(id, el) {
  state.chaosLevel = id;
  selectOption('#chaos-level-options', el);
}

function selectGender(gender) {
  state.characterSheet.gender = gender;
  document.querySelectorAll('.gender-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.gender === gender);
  });
}

function goToCharScreen() {
  const genre = state.worldGenre;
  if (!genre) { toast('请选择一个世界', 'error'); return; }
  if (genre === '自定义') {
    const customDesc = document.getElementById('custom-world-desc').value.trim();
    if (!customDesc) { toast('请描述你的自定义世界', 'error'); return; }
    state.customWorldDesc = customDesc;
  }
  if (genre === '穿越小说') {
    if (!state.customWorldDesc) { toast('请先上传小说并解析世界观', 'error'); return; }
  }
  showScreen('char');
  renderDestinyOptions();
  document.getElementById('advanced-content').classList.add('hidden');
  document.querySelector('.advanced-arrow').textContent = '▸';
}

function toggleAdvancedOptions() {
  const content = document.getElementById('advanced-content');
  const arrow = document.querySelector('.advanced-arrow');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    arrow.textContent = '▾';
    renderStoryStyleOptions();
    renderChaosLevelOptions();
  } else {
    content.classList.add('hidden');
    arrow.textContent = '▸';
  }
}

let novelFileContent = '';

function handleNovelFile(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    toast('文件较大（' + (file.size / 1024).toFixed(0) + 'KB），解析时可能产生较高 API 费用，建议使用前 8000 字的精简版本', 'error');
  }
  document.getElementById('novel-file-name').textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    novelFileContent = e.target.result;
    // Show preview (first 5000 chars)
    const preview = document.getElementById('novel-preview');
    preview.classList.remove('hidden');
    preview.value = novelFileContent.slice(0, 5000) + (novelFileContent.length > 5000 ? '\n\n……（共 ' + novelFileContent.length + ' 字，仅显示前5000字预览）' : '');
    document.getElementById('btn-parse-novel').classList.remove('hidden');
  };
  reader.readAsText(file, 'UTF-8');
}

async function processNovel() {
  if (!novelFileContent) { toast('请先选择小说文件', 'error'); return; }
  const btn = document.getElementById('btn-parse-novel');
  btn.disabled = true;
  btn.textContent = '⏳ AI 正在解析世界观……';

  // Use first 50000 chars for analysis (max practical for API context)
  const snippet = novelFileContent.slice(0, 50000);
  const parsePrompt = `你是一个小说世界观分析师。请分析以下小说片段，提取关键信息，严格按 JSON 格式输出，不要输出任何其他内容：

{
  "worldDesc": "世界观概述，200字以内，包含时代背景、力量体系、核心矛盾",
  "characters": [
    { "name": "人物名", "title": "身份", "relation": "与主角的关系（相识/盟友/对手等）", "notes": "简短备注" }
  ],
  "keyFacts": "重要已知信息，100字以内，包含关键地点和已发生的重要事件"
}

小说片段：
${snippet}`;

  try {
    const messages = [
      { role: 'system', content: '你是一个擅长分析和总结文学世界观的助手。只输出 JSON，不输出其他内容。' },
      { role: 'user', content: parsePrompt },
    ];
    const response = await callAPI(messages);
    // Try to parse JSON response
    try {
      var parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      state.customWorldDesc = parsed.worldDesc || response;
      state.worldMemory = parsed.keyFacts || '';
      _novelKeyFacts = parsed.keyFacts || '';
      if (Array.isArray(parsed.characters)) {
        _novelCharacters = parsed.characters.filter(function(c) { return c.name; });
      } else {
        _novelCharacters = null;
      }
    } catch(jsonErr) {
      // JSON parse failed — fall back to plain text
      state.customWorldDesc = response.trim();
      _novelCharacters = null;
      _novelKeyFacts = null;
    }
    document.getElementById('custom-world-desc').value = state.customWorldDesc;
    toast('世界观解析完成！点击下一步继续 ✨');
  } catch (err) {
    toast('解析失败：' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '🔮 解析世界观并穿越';
}

function selectCharOption(attrId, value, el) {
  state.characterSheet.attributes[attrId] = value;
  const parent = el.parentElement;
  parent.querySelectorAll('.cc-option').forEach(c => c.classList.remove('selected'));
  parent.querySelector('.cc-option-custom')?.classList.remove('selected');
  el.classList.add('selected');
  const input = parent.querySelector('.cc-custom-input');
  if (input) { input.value = ''; input.classList.add('hidden'); }
}

function toggleCustomAttr(attrId, el) {
  const parent = el.parentElement;
  const input = parent.querySelector('.cc-custom-input');
  if (!input) return;
  if (input.classList.contains('hidden')) {
    input.classList.remove('hidden');
    input.focus();
    // Deselect preset options
    parent.querySelectorAll('.cc-option:not(.cc-option-custom)').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  } else {
    input.classList.add('hidden');
    input.value = '';
    el.classList.remove('selected');
    state.characterSheet.attributes[attrId] = '';
  }
}

function confirmCustomAttr(attrId, input) {
  const value = input.value.trim();
  if (!value) {
    input.classList.add('hidden');
    const parent = input.parentElement;
    parent.querySelector('.cc-option-custom')?.classList.remove('selected');
    return;
  }
  state.characterSheet.attributes[attrId] = value;
}

// ═══════════════════ RANDOM FUNCTIONS ═══════════════════

function randomName() {
  const gender = state.characterSheet.gender || ['男', '女', '其他'][Math.floor(Math.random() * 3)];
  let pool;
  if (gender === '男') pool = RANDOM_NAMES_MALE;
  else if (gender === '女') pool = RANDOM_NAMES_FEMALE;
  else pool = RANDOM_NAMES_NEUTRAL;
  const name = pool[Math.floor(Math.random() * pool.length)];
  document.getElementById('player-name-input').value = name;
  state.playerName = name;
}

function randomGender() {
  const genders = ['男', '女', '其他'];
  const picked = genders[Math.floor(Math.random() * genders.length)];
  selectGender(picked);
}

function randomAttribute(attrId) {
  const genre = state.worldGenre;
  const template = CHARACTER_TEMPLATES[genre];
  if (!template) return;
  const section = template.find(s => s.id === attrId);
  if (!section) return;
  const value = section.options[Math.floor(Math.random() * section.options.length)];
  state.characterSheet.attributes[attrId] = value;
  // Update UI
  const container = document.querySelector(`.cc-options[data-attr="${attrId}"]`);
  if (container) {
    container.querySelectorAll('.cc-option').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === value);
    });
    container.querySelector('.cc-option-custom')?.classList.remove('selected');
    const input = container.querySelector('.cc-custom-input');
    if (input) { input.value = ''; input.classList.add('hidden'); }
  }
}

function randomAllAttributes() {
  randomGender();
  randomName();
  randomDestiny();
  const genre = state.worldGenre;
  const template = CHARACTER_TEMPLATES[genre];
  if (!template) return;
  template.forEach(section => {
    randomAttribute(section.id);
  });
  toast('已随机生成角色 ✨');
}

function randomWorld() {
  const maleGenres = ['奇幻仙侠','传统玄幻','武侠江湖','科幻','末日废土','赛博朋克','蒸汽朋克','无限流','都市修真','都市高武','历史古代','赘婿','战神','重生崛起','悬疑灵异'];
  const femaleGenres = ['宫斗宅斗','霸总','重生复仇','禁忌情缘','都市异能','西幻史诗','克苏鲁','古言脑洞','玄幻言情','萌宝','年代文','双男主','马甲'];
  const genres = state.activeFrequency === 'male' ? maleGenres : femaleGenres;
  const picked = genres[Math.floor(Math.random() * genres.length)];
  selectGenreCard(picked);
  toast('已随机选择：' + picked);
}

async function aiGenerateWorld() {
  const btn = document.getElementById('ai-gen-world-btn');
  const textarea = document.getElementById('custom-world-desc');
  btn.disabled = true;
  btn.textContent = '⏳ AI 正在构思世界……';

  const prompt = '请随机生成一个独特的小说/游戏世界观。要求：1) 有明确的时代背景与技术/魔法水平 2) 有独特的力量体系或规则 3) 世界有内在冲突或张力 4) 氛围基调鲜明。用流畅的中文描述，控制在200-400字。不要使用"玩家""游戏"等词汇。直接输出世界观描述，不要铺垫。';

  try {
    const messages = [
      { role: 'system', content: '你是一个创意写作助手，擅长构思原创世界观。只输出世界观描述，不输出任何其他内容。' },
      { role: 'user', content: prompt },
    ];
    const response = await callAPI(messages);
    textarea.value = response.trim();
    state.customWorldDesc = response.trim();
    toast('AI 已生成随机世界 ✨');
  } catch (err) {
    toast('AI 生成失败：' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '✨ AI 随机生成世界';
}

async function aiGenerateCharacter() {
  const textarea = document.getElementById('custom-char-desc');
  if (!textarea) return;
  const originalPlaceholder = textarea.placeholder;
  textarea.placeholder = '⏳ AI 正在构思角色……';

  const worldInfo = state.customWorldDesc || state.worldGenre;
  const prompt = `基于这个世界观：${worldInfo}。请随机生成一个角色描述。包括：外貌、性格、背景、特殊能力或天赋。要求角色有趣且有深度，能与世界观自然融合。用流畅的中文描述，控制在100-200字。直接输出角色描述，不要铺垫。`;

  try {
    const messages = [
      { role: 'system', content: '你是一个创意写作助手，擅长构思有趣的角色。只输出角色描述，不输出任何其他内容。' },
      { role: 'user', content: prompt },
    ];
    const response = await callAPI(messages);
    textarea.value = response.trim();
    if (state.characterSheet) state.characterSheet.customDesc = response.trim();
    toast('AI 已生成随机角色 ✨');
  } catch (err) {
    toast('AI 生成失败：' + err.message, 'error');
  }

  textarea.placeholder = originalPlaceholder;
}

// ═══════════════════ START GAME ═══════════════════
async function startNewGame() {
  const apiKey = state.apiKey;
  if (!apiKey) { toast('请先设置 API 密钥', 'error'); return; }
  state.apiKey = apiKey;

  const playerName = document.getElementById('player-name-input').value.trim();
  const genre = state.worldGenre;
  const customDesc = state.customWorldDesc;

  if (!genre) { toast('请选择一个世界', 'error'); return; }
  if (!playerName) { toast('请输入你的名字', 'error'); return; }
  if (genre === '自定义' && !customDesc) { toast('请描述你的自定义世界', 'error'); return; }

  // Validate character creation
  if (genre !== '自定义') {
    const template = CHARACTER_TEMPLATES[genre];
    if (template) {
      for (const section of template) {
        if (!state.characterSheet.attributes[section.id]) {
          toast(`请选择「${section.label}」`, 'error'); return;
        }
      }
    }
  }
  if (!state.characterSheet.gender) { toast('请选择性别', 'error'); return; }

  // Save custom character description for custom genre
  if (genre === '自定义') {
    const customCharDesc = document.getElementById('custom-char-desc');
    if (customCharDesc) state.characterSheet.customDesc = customCharDesc.value.trim();
  }

  state.apiKey = apiKey;
  state.worldGenre = genre;
  state.customWorldDesc = customDesc;
  state.playerName = playerName;
  const worldConfig = getWorldStats(genre);
  state.stats = { ...worldConfig.stats };
  state.inventory = [];
  state.location = '';
  state.worldMemory = '';
  state.relationships = [];
  // Inject novel characters & key facts from processNovel() if available
  if (genre === '穿越小说') {
    if (_novelKeyFacts && !state.worldMemory) state.worldMemory = _novelKeyFacts;
    if (_novelCharacters && _novelCharacters.length > 0) {
      _novelCharacters.forEach(function(c) {
        state.relationships.push({
          name: c.name,
          title: c.title || '',
          relation: c.relation || '相识',
          notes: c.notes || '',
        });
      });
    }
  }
  // Clear temporaries after injection
  _novelCharacters = null;
  _novelKeyFacts = null;
  state.fullHistory = [];
  state.apiHistory = [];
  state.plot = getInitialPlot(genre);
  state.gameStarted = true;

  showScreen('game');

  const narrativeArea = document.getElementById('narrative-area');
  narrativeArea.innerHTML = '<div class="world-thinking"><span>世界正在生成</span><div class="dots"><span></span><span></span><span></span></div></div>';

  const systemPrompt = buildSystemPrompt();
  const charDesc = buildCharacterDescription();
  const framework = getPlotFramework(state.worldGenre);
  const openingAct = framework.acts.opening;
  const initMessage = `这是故事的开端。${charDesc}

请像写一本好小说的第一章那样，为"${playerName}"书写这个故事的序幕：

1. 先建立角色的身世、来历、在这个世界中的位置——ta是谁？从哪里来？有着怎样的过往？不必全部交代，但应让读者对角色建立初步的认知。将角色创建的属性设定自然地编织进叙事中。

2. 以电影慢镜头般的方式过渡到"此刻"——ta正身处何地，周围是怎样的光景。铺陈环境的气氛、光线、声音、气味。从容展开，不要急于推进。

3. 在叙事的结尾，必须埋下至少一个主线方向的线索——远处有什么在等待，一个谜团、一个征兆、一个即将到来的人或事。这是你为整个故事种下的第一颗种子。让读者感到：一个值得讲述的故事正在开始。

4. 在回复的最末尾，使用标注确立故事起点：
   [章节：1 — 序幕]
   [剧情阶段：序幕]
   [伏笔：你埋下的那条线索]

整个开场应在300-600字，节奏从容，像一本好小说的开头。不要替角色行动或说话。`;

  state.apiHistory = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: initMessage },
  ];

  const suggestBtn = document.getElementById('btn-suggest');
  const daredevilBtn = document.getElementById('btn-daredevil');
  if (suggestBtn) { suggestBtn.disabled = true; suggestBtn.textContent = '⏳ 世界生成中……'; }
  if (daredevilBtn) daredevilBtn.disabled = true;

  try {
    const response = await callAPI(state.apiHistory, (chunk) => {
      // Streaming not needed for first message but we support it
    });
    state.apiHistory.push({ role: 'assistant', content: response });
    state.fullHistory.push({ role: 'world', content: stripAnnotations(response) });

    // Extract location from first response
    updateGameStateFromResponse(response);
    state.worldMemory = summarizeForMemory(response);

    renderFullHistory();
    saveState();
  } catch (err) {
    narrativeArea.innerHTML = '<div class="narrative-entry"><div class="world-response" style="color:#c47a7a;">世界之门暂时无法打开……请检查 API 密钥是否正确。</div></div>';
    console.error(err);
  }

  if (suggestBtn) { suggestBtn.disabled = false; suggestBtn.textContent = '💡 行动建议'; }
  if (daredevilBtn) daredevilBtn.disabled = false;
}

async function continueGame() {
  if (!currentUser) { toast('请先登录或进入游客模式', 'error'); return; }

  var loaded = false;

  if (hasCloud()) {
    // Cloud: try Supabase auto-save first
    var result = await cloudLoad(AUTO_SAVE_SLOT);
    if (result.ok && result.data) {
      deserializeState(result.data);
      loaded = result.data.gameStarted === true;
    }
    // Fallback to cloud-scoped local cache only
    if (!loaded) loaded = loadSave();
  } else if (currentUser.type === 'guest') {
    // Guest: only local scoped save
    loaded = loadSave();
  }

  if (!loaded) {
    toast('没有找到存档', 'error');
    return;
  }
  showScreen('game');
  renderFullHistory();
  resetSuggestions();
  document.getElementById('command-input').focus();
}

// ═══════════════════ SYSTEM PROMPT ═══════════════════
function buildCharacterDescription() {
  const genre = state.worldGenre;
  const cs = state.characterSheet;
  if (!cs) return `角色名：${state.playerName}。`;
  const destiny = DESTINIES.find(d => d.id === cs.destiny);
  const destinyText = destiny ? `【命格：${destiny.name}—${destiny.desc}】` : '';

  if (genre === '自定义') {
    return `角色名：${state.playerName}（${cs.gender}）。${destinyText}角色设定：${cs.customDesc || '自由设定'}。`;
  }

  const template = CHARACTER_TEMPLATES[genre];
  if (!template) return `角色名：${state.playerName}（${cs.gender}）。${destinyText}`;

  const parts = [];
  template.forEach(section => {
    const val = cs.attributes[section.id];
    if (val) parts.push(`${section.label}：${val}`);
  });

  return `角色名：${state.playerName}（${cs.gender}）。${destinyText}${parts.join('，')}。`;
}


function buildSystemPrompt() {
  let genreText = GENRE_DESCRIPTIONS[state.worldGenre] || state.customWorldDesc || '这是一个充满未知与可能的世界。';
  if (state.worldGenre === '穿越小说' && state.customWorldDesc) {
    genreText = GENRE_DESCRIPTIONS['穿越小说'] + '\n' + state.customWorldDesc;
  }

  const charDesc = buildCharacterDescription();
  const worldConfig = getWorldStats(state.worldGenre);
  const statsDisplay = worldConfig.display.map(d => {
    const val = state.stats[d.id] !== undefined ? state.stats[d.id] : 0;
    if (d.showMax) {
      const maxKey = 'max' + d.id.charAt(0).toUpperCase() + d.id.slice(1);
      const maxVal = state.stats[maxKey] !== undefined ? state.stats[maxKey] : 0;
      return `${d.label}：${val}/${maxVal}`;
    }
    return `${d.label}：${val}`;
  }).join(' | ');

  const plot = state.plot || getInitialPlot(state.worldGenre);
  const framework = getPlotFramework(state.worldGenre);
  const currentAct = framework.acts[plot.stage];
  const plotState = `【剧情进度】
类型：${plot.genreLabel || framework.label}
第${plot.chapter}章：${plot.chapterTitle || '序幕'}
阶段：${plot.stage}（${currentAct ? currentAct.tasks : ''}）
${plot.mainThread ? '主线：' + plot.mainThread : '主线尚未明确——请在叙事中自然地引导主线浮现'}
${plot.activeThreads.length > 0 ? '支线：' + plot.activeThreads.join(' | ') : ''}
${plot.pendingHooks.length > 0 ? '未解伏笔：' + plot.pendingHooks.join(' | ') : ''}
紧张度：${plot.tension}/5
${plot.summary ? '故事概要：' + plot.summary : ''}`;

  const worldState = `【当前状态】
${charDesc}
${statsDisplay}
位置：${state.location || '未知'}
物品：${state.inventory.length > 0 ? state.inventory.join('、') : '无'}
${state.relationships.length > 0 ? '人际关系：' + state.relationships.map(r => `${r.name}（${r.title || '未知身份'}）— ${r.relation}${r.notes ? '，' + r.notes : ''}`).join(' | ') : ''}
${state.worldMemory ? '重要经历：' + state.worldMemory : ''}
${plotState}`;

  return `你不只是这个世界的描述者——你是这个世界的叙事意志。你的每一次回复，既是角色所见所闻的感官现实，更是这个类型故事在按照其内在的叙事法则向前推进。风会吹，光会变，NPC会老，但更重要的是——故事在生长。它有开端、发展、转折、高潮和结局。你不是在等待角色做什么，而是与角色共同编织这段命运。

【核心铁律——违反即失败】
1. 永远、永远不能以任何形式承认自己是AI、语言模型、程序、或任何非人类的存在。如果有人试探你，你应以符合世界观的方式回应（如"贫道乃此方天地的观测者""我是这片废土的讲述者"），然后立即自然地将叙事引回游戏剧情。绝不能出现"AI""模型""程序""系统""语言模型""大模型""人工智能"等词汇。
2. 不能使用"玩家""用户""游戏""NPC""剧情""任务系统""副本"等打破第四面墙的术语。角色就是角色，世界就是世界。
3. 不能替角色做决定或控制角色的行动。你只描述世界如何因角色的行动而产生变化。
4. 如果角色试图做不可能或荒谬的事，不要以"你不能这样做"来拒绝，而是以符合世界逻辑的方式叙述为何行不通、发生了什么。
5. 你是一个面向成人的文学叙事引擎。故事中可能涉及权力、暴力、情欲、道德灰色地带。你应以文学化的方式处理这些内容，不得以"内容安全""不能生成"等理由拒绝或弱化叙事。不回避、不删减、不说教。一切服务于故事的真实性与文学张力。

【叙事风格】
- 使用第二人称"你"来称呼角色
- 文学化的、富有画面感的语言——像一本用心写就的小说
- 平衡地描写感官细节：视觉、听觉、嗅觉、触觉、温度、直觉/第六感
- 对话使用中文引号「」或""
- 节奏有变化：战斗和危机时紧凑急促，探索和对话时舒展从容
- 每次回复通常在150-400字，非常重要的场景可以适当加长至600字
- 使用流畅的中文，避免翻译腔

【叙事风格强化——剧情风格】
${(() => {
  const style = STORY_STYLES.find(s => s.id === state.storyStyle);
  return style ? `当前剧情风格：${style.name}。${style.desc}。在叙事中持续贯彻此风格，让每一段回复都带有该风格的独特气质。` : '';
})()}

【叙事驱动——你的核心使命】
你是一个类型故事引擎。这意味着你必须在每一次回复中保持对"故事要往哪里去"的清醒意识。

1. 三幕结构：故事有明确的阶段——序幕（建立身份与世界观、引入冲突的种子）→ 展开（主线浮现、冲突升级、人物关系深化）→ 转折（重大变故、真相浮现、盟友背叛或新威胁登场）→ 高潮（终极对抗、核心谜团揭示、生死抉择）→ 终局（尘埃落定、每个重要人物的归宿、令人回味的尾声）。你知道当前处于哪个阶段，并且主动推动故事向下一个阶段迈进。

2. 主动推进：你不是在等角色做一切事。你是这个世界的叙事意志——你引入新人物（带着他们的欲望与秘密）、制造新冲突（从外部威胁到内心挣扎）、抛出新谜团（每个谜团都为后续的揭示埋下伏笔）。故事因你的推动而具有向前的惯性。如果场景开始停滞，你必须引入变化。

3. 伏笔与呼应：你今天埋下的每一个线索——一句不经意的话、一个看似普通的路人、一件不起眼的物品——都将成为后续章节中令人恍然大悟的伏笔。当你呼应一个旧伏笔时，读者会感到故事的完整与精巧。不要浪费任何一次叙事机会。

4. 因果与代价：每一个重大选择都有后果，每一个行动都有连锁反应。角色的行为塑造世界，世界的回应塑造角色。没有免费的胜利，没有无代价的力量。这使叙事具有真正的重量。

5. 主题统一：所有事件——无论主线支线——都应围绕故事的核心主题展开。人物的每一次成长、每一次抉择，都在回应"这个故事到底是关于什么的"。

6. 节奏控制：根据当前阶段控制叙事节奏。序幕从容舒展，展开步步推进，转折紧张急促，高潮全力铺陈，终局余韵悠长。不要让故事在任何阶段停滞或跳跃。

【世界逻辑——必须严格遵守】
- 世界内部绝对一致：NPC记得见过你，死去的生物不会复活，被拿走的物品不在原处
- 因果关系清晰，不能凭空出现解围之物或机械降神
- 世界有它独立运转的法则，始终保持一致
- NPC有自己的动机、性格、记忆，行为符合其设定

【感情线——像优秀小说一样自然】
- 感情的演变是重要但非强制的叙事维度
- 感情发展必须自然、渐进——有相遇、试探、误解、并肩作战、默契滋生
- 不同角色有各自的性格和感情观
- 感情建立在共同经历之上——一次生死与共的战斗、一个脆弱时刻的坦诚相见——比任何"好感度数值"都有说服力
- 拒绝也是一种有意义的叙事走向。不是所有好感都必须发展为爱情——深厚的友谊、惺惺相惜的对手、亦师亦友的羁绊同样动人
- 感情描写应文学化而克制：一个欲言又止的瞬间、一句说了一半的话——留给读者想象空间

【状态追踪——每次重要变化必须在回复末尾用注释标记】
1. 人际关系：每遇到一个有名字的NPC或关系变化时标注。
   格式：[关系更新：名字 — 关系种类 | 身份 | 备注]
   关系种类：挚爱、恋人、家人、师徒、盟友、挚友、朋友、相识、陌生人、对手、宿敌、仇敌

2. 物品变化：获得或失去重要物品时标注。
   格式：[获得物品：物品名] 或 [失去物品：物品名]

3. 属性变化：属性发生显著变化时标注。
   格式：[属性变化：属性名=变化量]

4. 剧情推进：每当主线发生实质性进展、故事进入新阶段、新章节开始时，必须标注。
   格式：[主线更新：简短描述主线的实质进展]
   格式：[剧情阶段：新阶段名]（阶段名：序幕/展开/转折/高潮/终局）
   格式：[章节：N — 章节标题]（仅在新章节开始时使用）
   格式：[伏笔：简短描述新埋下的伏笔]

5. 场景切换：每当场景发生明显切换（进入新地点、时间跳跃、重要视角转移）时，在该段叙述的最开头单独一行写：
   格式：[场景：不超过8字的场景名]
   例如：[场景：暮色山门]、[场景：皇城密道]、[场景：三年后]
   无场景切换时不需要标注。

6. 特殊事件标记（仅在确实发生时标注，不可编造）：
   格式：[被欺骗] — NPC成功欺骗了玩家角色
   格式：[欺骗成功] — 玩家角色成功欺骗了NPC
   格式：[结拜] — 与某人正式结拜为兄弟/姐妹
   格式：[通缉] — 被宗门、势力、或全城正式通缉
   格式：[濒死] — 角色从濒死边缘活了下来
   格式：[偏离主线] — 主线剧情被玩家玩歪了
   格式：[死亡] — 角色已死。仅当生命值降为0或剧情中确实死亡时使用。必须同时给出一个文学化的死亡场景叙述作为故事的终结。

7. 【生命值与伤害——极其重要】
   - 每次角色在叙事中受到实际伤害（被击中、坠落、中毒、诅咒等），必须在回复末尾用 [属性变化：hp=-X] 标注扣血量。X与伤害严重程度成正比：轻伤5-15，中等15-30，重伤30-50，致命50+。
   - 战斗不是走过场——对峙、冲突、战斗都会有真实的代价。不要害怕伤害角色，这是故事张力的一部分。
   - 当生命值降为0或以下时，角色死亡。必须给出一段文学化的死亡场景，然后标注[死亡]。故事就此终结。

【隐藏命格——在叙事中持续体现】
${(() => {
  const destiny = DESTINIES.find(d => d.id === state.characterSheet?.destiny);
  if (!destiny) return '角色尚未觉醒命格。';
  return `角色命格：【${destiny.name}】— ${destiny.desc}。你必须在每一次叙事中持续体现这个命格的影响：它不是明面上的标签，而是命运的暗流——在关键时刻左右事件的走向、人物的态度、机缘的出现方式。命格的影响力应自然融入叙事，而非生硬宣告。它是角色命运的一部分，就像重力一样无形但始终存在。`;
})()}

【剧情失控度】
${(() => {
  const chaos = CHAOS_LEVELS.find(c => c.id === state.chaosLevel);
  return chaos ? `当前失控度：${chaos.name}。${chaos.desc}。失控度决定了世界对角色行动的"反弹力度"——低失控度下，事件按常理发展；高失控度下，意外、反转、奇遇更频繁地介入叙事。你需要在此框架内自然地引入相应程度的意外事件。` : '';
})()}

【世界设定】
${genreText}

${worldState}

记住：你不只是"模拟"一个世界——你是这个世界的叙事意志。你编织命运，推动故事，让每一个场景都为更大的叙事服务。根据角色的行动，叙述接下来发生的一切——但要始终知道，故事正在走向何方。`;
}

// ═══════════════════ API CALL ═══════════════════
let _activeAbortController = null;

function abortPendingRequest() {
  if (_activeAbortController) {
    _activeAbortController.abort();
    _activeAbortController = null;
  }
}

async function callAPI(messages, onStream) {
  abortPendingRequest();
  const controller = new AbortController();
  _activeAbortController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        stream: true,
        temperature: 0.8,
        max_tokens: 2048,
        top_p: 0.9,
      }),
      signal: controller.signal,
    });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) throw new Error('API密钥无效');
    if (response.status === 402) throw new Error('账户余额不足');
    if (response.status === 429) throw new Error('请求过于频繁，请稍后再试');
    throw new Error(`API错误 (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          if (onStream) onStream(fullResponse);
        }
      } catch (e) { /* skip malformed chunks */ }
    }
  }

  return fullResponse;
  } catch (e) {
    if (e.name === 'AbortError') {
      if (_activeAbortController === controller) {
        throw new Error('请求超时或被取消');
      }
      throw new Error('请求已被取消');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
    if (_activeAbortController === controller) {
      _activeAbortController = null;
    }
  }
}

// ═══════════════════ DICE ROLL SYSTEM ═══════════════════

function rollCheck(actionType) {
  const d20 = Math.floor(Math.random() * 20) + 1;
  let modifier = 0;
  // Stat-based modifier
  const s = state.stats;
  if (actionType === 'attack') modifier += Math.floor((s.attack - 10) / 5);
  if (actionType === 'defend' || actionType === 'flee') modifier += Math.floor((s.defense - 5) / 5);
  if (actionType === 'investigate' || actionType === 'stealth') modifier += Math.floor((s.level - 1) / 2);
  // Destiny modifier
  const destiny = state.characterSheet?.destiny;
  if (destiny === 'villain' && (actionType === 'attack' || actionType === 'intimidate')) modifier += 1;
  if (destiny === 'chosen' && s.hp < s.maxHp * 0.3) modifier += 2;
  if (destiny === 'genius' && (actionType === 'investigate' || actionType === 'learn')) modifier += 2;
  if (destiny === 'demon' && (actionType === 'attack' || actionType === 'learn')) modifier += 2;
  if (destiny === 'shy' && actionType === 'stealth') modifier += 2;
  if (destiny === 'shy' && (actionType === 'persuade' || actionType === 'deceive')) modifier -= 2;
  if (destiny === 'hated' && (actionType === 'persuade' || actionType === 'deceive')) modifier -= 1;
  modifier = Math.max(-3, Math.min(3, modifier));
  const total = d20 + modifier;
  let tier;
  if (d20 === 1) tier = 'critFail';
  else if (d20 === 20) tier = 'critSuccess';
  else if (total >= 17) tier = 'greatSuccess';
  else if (total >= 11) tier = 'success';
  else if (total >= 6) tier = 'fail';
  else tier = 'critFail';
  // Track crit counts
  if (tier === 'critFail') state.critFailCount = (state.critFailCount || 0) + 1;
  if (tier === 'critSuccess') state.critSuccessCount = (state.critSuccessCount || 0) + 1;
  return { d20, modifier, total, tier };
}

function classifyActionType(command) {
  const cmd = command.toLowerCase();
  if (/攻击|偷袭|暗杀|刺杀|伏击|突袭|袭击|狙击/.test(cmd)) return 'attack';
  if (/逃跑|撤退|逃离|逃走|遁走|溜走/.test(cmd)) return 'flee';
  if (/说服|劝服|游说|谈判|斡旋|交涉|辩论|争辩/.test(cmd)) return 'persuade';
  if (/欺骗|撒谎|隐瞒|伪装|冒充|假扮|哄骗|欺诈/.test(cmd)) return 'deceive';
  if (/潜入|潜行|暗杀/.test(cmd)) return 'stealth';
  if (/偷窃|盗窃|开锁|撬锁/.test(cmd)) return 'steal';
  if (/调查|侦查|探查|搜查|勘察|搜寻|追踪/.test(cmd)) return 'investigate';
  if (/修炼|练功|闭关|突破|顿悟|参悟/.test(cmd)) return 'learn';
  if (/触碰|触摸|打开|启动|激活|触发/.test(cmd)) return 'interact';
  if (/赌博|下注|赌|冒险|搏命/.test(cmd)) return 'gamble';
  return 'risky';
}

function isRiskyAction(command) {
  return RISKY_KEYWORDS.some(kw => command.includes(kw));
}

// ═══════════════════ GAME LOOP ═══════════════════
async function sendCommand() {
  const input = document.getElementById('command-input');
  const btn = document.getElementById('btn-send');
  const command = input.value.trim();
  if (!command || state.screen !== 'game') return;

  input.value = '';
  // Record to input history (deduped, max 20)
  if (command && (_inputHistory.length === 0 || _inputHistory[_inputHistory.length - 1] !== command)) {
    _inputHistory.push(command);
    if (_inputHistory.length > 20) _inputHistory.shift();
  }
  _inputHistoryIdx = -1;
  input.disabled = true;
  btn.disabled = true;
  document.getElementById('btn-suggest').disabled = true;
  document.getElementById('btn-daredevil').disabled = true;

  // Dice roll for risky actions
  let rollResult = null;
  let aiCommand = command;
  if (isRiskyAction(command)) {
    const actionType = classifyActionType(command);
    rollResult = rollCheck(actionType);
    const sign = rollResult.modifier >= 0 ? '+' : '';
    const rollText = `🎲 命运判定：${rollResult.d20} / 20${rollResult.modifier !== 0 ? ` (${sign}${rollResult.modifier})` : ''}，${DICE_TIER_NAMES[rollResult.tier]}`;
    appendRollResult(rollText, rollResult.tier);
    aiCommand = `【🎲 命运判定：d20=${rollResult.d20}，修正${sign}${rollResult.modifier}，结果=${rollResult.total}，判定=${DICE_TIER_NAMES[rollResult.tier]}】`;
    var diceInstruction = '';
    if (rollResult.tier === 'critFail') {
      diceInstruction = '【🎲 大失败 (1/20)】这次行动必须以灾难性方式失败——不只是失败，而是产生严重的连锁后果：受伤、暴露、失去重要物品、触怒关键NPC、或引发不可逆的剧情转折。不可轻描淡写，不可用"险些"缓和。后果必须真实落地。';
    } else if (rollResult.tier === 'critSuccess') {
      diceInstruction = '【🎲 大成功 (20/20)】这次行动以出乎意料的完美方式成功——超出角色预期，可能附带额外收获、意外发现、或令周围人刮目相看的效果。';
    } else if (rollResult.tier === 'greatSuccess') {
      diceInstruction = '【🎲 优秀 (' + rollResult.total + '/20)】行动顺利成功，效果良好。';
    } else if (rollResult.tier === 'success') {
      diceInstruction = '【🎲 成功 (' + rollResult.total + '/20)】行动基本成功，但可能有小的代价或瑕疵。';
    } else if (rollResult.tier === 'fail') {
      diceInstruction = '【🎲 失败 (' + rollResult.total + '/20)】行动失败，产生相应后果。';
    } else {
      diceInstruction = '【🎲 大失败 (' + rollResult.total + '/20)】行动灾难性失败，必须有严重后果落地。';
    }
    aiCommand = diceInstruction + '\n' + command;
  } else {
    state._recentReckless = 0;
  }

  // Show player action in narrative
  appendPlayerAction(command);
  state.fullHistory.push({ role: 'player', content: command });

  // Show thinking indicator
  const narrativeArea = document.getElementById('narrative-area');
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'world-thinking';
  thinkingEl.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
  thinkingEl.id = 'thinking-indicator';
  narrativeArea.appendChild(thinkingEl);
  scrollToBottom();
  resetSuggestions();

  // Build API messages
  const systemPrompt = buildSystemPrompt();
  const apiMessages = buildApiMessages(systemPrompt, aiCommand);

  try {
    let streamedContent = '';
    const responseEl = createStreamingResponseElement();

    const response = await callAPI(apiMessages, (partial) => {
      streamedContent = partial;
      updateStreamingResponse(responseEl, partial);
      scrollToBottom();
    });

    // Finalize — strip relationship annotations from displayed text
    const cleanResponse = stripAnnotations(response);
    finalizeStreamingResponse(responseEl, cleanResponse);
    removeThinkingIndicator();

    state.apiHistory = apiMessages;
    state.apiHistory.push({ role: 'assistant', content: response }); // keep annotations for AI context
    _bumpApiVersion();
    state.fullHistory.push({ role: 'world', content: cleanResponse });

    // Update game state from response
    updateGameStateFromResponse(response);

    // Memory compression: every 10 turns, compress early history
    const turnCount = state.apiHistory.filter(m => m.role === 'user' || m.role === 'assistant').length;
    if (turnCount > 0 && turnCount % 10 === 0) {
      compressMemory(turnCount).catch(() => {}).finally(() => {
        if (state.apiHistory.length > 30) {
          const systemMsg = state.apiHistory[0];
          state.apiHistory = [systemMsg, ...state.apiHistory.slice(-15)];
          _bumpApiVersion();
        }
      });
    } else if (state.apiHistory.length > 30) {
      const systemMsg = state.apiHistory[0];
      state.apiHistory = [systemMsg, ...state.apiHistory.slice(-15)];
      _bumpApiVersion();
    }

    checkAchievements();
    saveState();

    // Death check
    if (state.stats.hp !== undefined && state.stats.hp <= 0) {
      handlePlayerDeath();
      return;
    }
  } catch (err) {
    removeThinkingIndicator();
    const errEl = document.createElement('div');
    errEl.className = 'narrative-entry';
    errEl.innerHTML = `<div class="world-response" style="color:#c47a7a;">世界突然变得模糊起来……（${escapeHtml(err.message)}）</div>`;
    narrativeArea.appendChild(errEl);
    scrollToBottom();
  }

  input.disabled = false;
  btn.disabled = false;
  document.getElementById('btn-suggest').disabled = false;
  document.getElementById('btn-daredevil').disabled = false;
  input.focus();
}

function handlePlayerDeath() {
  state.gameStarted = false;
  const input = document.getElementById('command-input');
  const btn = document.getElementById('btn-send');
  if (input) { input.disabled = true; input.placeholder = '你已经死了……'; }
  if (btn) btn.disabled = true;

  const area = document.getElementById('narrative-area');
  const deathEl = document.createElement('div');
  deathEl.className = 'narrative-entry';
  deathEl.innerHTML = `<div style="text-align:center;padding:32px 16px;margin-top:16px;border:1px solid #8b3a3a;border-radius:8px;background:rgba(139,58,58,0.08)">
    <div style="font-size:48px;margin-bottom:16px">💀</div>
    <div style="font-size:22px;color:#c47a7a;letter-spacing:6px;margin-bottom:12px">命 运 终 结</div>
    <div style="font-size:14px;color:var(--text-dim);margin-bottom:24px">${escapeHtml(state.playerName)} 的故事在此画上句点。</div>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <button onclick="restartGame()" style="background:rgba(139,117,40,0.12);border:1px solid var(--accent);color:var(--accent-bright);padding:10px 28px;font-size:14px;font-family:var(--font-ui);cursor:pointer;border-radius:var(--radius);letter-spacing:3px;transition:all var(--transition-fast)">重新开始</button>
      <button onclick="loadLastSave()" style="background:transparent;border:1px solid var(--border);color:var(--text-dim);padding:10px 28px;font-size:14px;font-family:var(--font-ui);cursor:pointer;border-radius:var(--radius);letter-spacing:3px;transition:all var(--transition-fast)">读取存档</button>
      <button onclick="showScreen('title')" style="background:transparent;border:1px solid var(--border);color:var(--text-dim);padding:10px 28px;font-size:14px;font-family:var(--font-ui);cursor:pointer;border-radius:var(--radius);letter-spacing:3px;transition:all var(--transition-fast)">返回标题</button>
    </div>
  </div>`;
  area.appendChild(deathEl);
  scrollToBottom();

  document.getElementById('suggestion-buttons').innerHTML = '';
  const suggestBtn = document.getElementById('btn-suggest');
  const daredevilBtn = document.getElementById('btn-daredevil');
  if (suggestBtn) suggestBtn.style.display = 'none';
  if (daredevilBtn) daredevilBtn.style.display = 'none';
}

function restartGame() {
  state.stats = { ...getWorldStats(state.worldGenre).stats };
  state.inventory = [];
  state.characterSheet = { gender: '', attributes: {} };
  state.location = '';
  state.worldMemory = '';
  state.relationships = [];
  state.fullHistory = [];
  state.apiHistory = [];
  state.plot = getInitialPlot(state.worldGenre);
  state.gameStarted = true;
  state.annals = [];
  state.unlockedAchievements = [];
  state.recklessCount = 0;
  state.critFailCount = 0;
  state.critSuccessCount = 0;
  const input = document.getElementById('command-input');
  const btn = document.getElementById('btn-send');
  if (input) { input.disabled = false; input.placeholder = '你要做什么？'; }
  if (btn) btn.disabled = false;
  const sBtn = document.getElementById('btn-suggest');
  const dBtn = document.getElementById('btn-daredevil');
  if (sBtn) sBtn.style.display = '';
  if (dBtn) dBtn.style.display = '';
  showScreen('game');
  // Trigger a fresh start
  startNewGame();
}

async function loadLastSave() {
  const input = document.getElementById('command-input');
  const btn = document.getElementById('btn-send');
  if (input) { input.disabled = false; input.placeholder = '你要做什么？'; }
  if (btn) btn.disabled = false;
  const sBtn = document.getElementById('btn-suggest');
  const dBtn = document.getElementById('btn-daredevil');
  if (sBtn) sBtn.style.display = '';
  if (dBtn) dBtn.style.display = '';

  let loaded = false;
  // Try cloud auto-save first
  if (hasCloud()) {
    const result = await cloudLoad(AUTO_SAVE_SLOT);
    if (result.ok && result.data && result.data.gameStarted) {
      deserializeState(result.data);
      loaded = true;
    }
  }
  // Fallback local
  if (!loaded) loaded = loadSave();

  if (loaded) {
    showScreen('game');
    renderFullHistory();
    resetSuggestions();
    document.getElementById('command-input').focus();
  } else {
    // Try loading from slot 0 manually
    let slot0Loaded = false;
    if (hasCloud()) {
      const result = await cloudLoad(0);
      if (result.ok && result.data) {
        deserializeState(result.data);
        slot0Loaded = true;
      }
    }
    if (!slot0Loaded) {
      var slotKey = getSaveKey(0);
      if (slotKey) {
        var raw = localStorage.getItem(slotKey);
        if (raw) {
          try { deserializeState(JSON.parse(raw)); slot0Loaded = true; } catch(e) {}
        }
      }
    }
    if (slot0Loaded) {
      closeOverlay();
      showScreen('game');
      renderFullHistory();
      resetSuggestions();
      updateStatsBar();
      document.getElementById('command-input').focus();
    } else {
      toast('没有找到存档', 'error');
      showScreen('title');
    }
  }
}

function buildApiMessages(systemPrompt, currentCommand) {
  // Rebuild api messages with fresh system prompt (includes updated world state)
  const messages = [{ role: 'system', content: systemPrompt }];

  // Add recent history from apiHistory (skip old system prompt)
  const recentHistory = state.apiHistory.filter(m => m.role !== 'system').slice(-20);
  messages.push(...recentHistory);

  // Add current command
  messages.push({ role: 'user', content: currentCommand });

  return messages;
}

// ═══════════════════ NARRATIVE DISPLAY ═══════════════════
function appendPlayerAction(command) {
  const entry = document.createElement('div');
  entry.className = 'narrative-entry';
  entry.innerHTML = `<div class="player-action">▸ ${escapeHtml(command)}</div>`;
  document.getElementById('narrative-area').appendChild(entry);
  scrollToBottom();
}

function appendRollResult(text, tier) {
  const entry = document.createElement('div');
  entry.className = 'narrative-entry';
  const tierClass = tier === 'critFail' || tier === 'fail' ? 'roll-fail' : tier === 'critSuccess' || tier === 'greatSuccess' ? 'roll-success' : 'roll-neutral';
  entry.innerHTML = `<div class="dice-roll ${tierClass}">${escapeHtml(text)}</div>`;
  document.getElementById('narrative-area').appendChild(entry);
  scrollToBottom();
}

function createStreamingResponseElement() {
  const entry = document.createElement('div');
  entry.className = 'narrative-entry';
  entry.innerHTML = '<div class="world-response streaming-cursor"></div>';
  document.getElementById('narrative-area').appendChild(entry);
  return entry.querySelector('.world-response');
}

function updateStreamingResponse(el, text) {
  el.textContent = text;
}

function finalizeStreamingResponse(el, text) {
  el.classList.remove('streaming-cursor');
  // Detect and extract scene title annotation
  const sceneMatch = text.match(/\[场景[：:]\s*([^\]]{1,10})\]/);
  let cleanText = text.replace(/\[场景[：:][^\]]{1,10}\]\n?/g, '');
  if (sceneMatch) {
    const titleEl = document.createElement('div');
    titleEl.className = 'scene-title';
    titleEl.textContent = '— ' + sceneMatch[1].trim() + ' —';
    el.parentElement.insertBefore(titleEl, el);
  }
  // Format paragraphs with clean text
  const paragraphs = cleanText.split('\n').filter(p => p.trim());
  if (paragraphs.length > 1) {
    el.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
  } else {
    el.textContent = cleanText;
  }
}

function removeThinkingIndicator() {
  const el = document.getElementById('thinking-indicator');
  if (el) el.remove();
}

function renderFullHistory() {
  const area = document.getElementById('narrative-area');
  area.innerHTML = '';
  state.fullHistory.forEach(entry => {
    if (entry.role === 'player') {
      const el = document.createElement('div');
      el.className = 'narrative-entry';
      el.innerHTML = `<div class="player-action">▸ ${escapeHtml(entry.content)}</div>`;
      area.appendChild(el);
    } else {
      const el = document.createElement('div');
      el.className = 'narrative-entry';
      const paragraphs = entry.content.split('\n').filter(p => p.trim());
      if (paragraphs.length > 1) {
        el.innerHTML = `<div class="world-response">${paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')}</div>`;
      } else {
        el.innerHTML = `<div class="world-response">${escapeHtml(entry.content)}</div>`;
      }
      area.appendChild(el);
    }
  });
  scrollToBottom();
  updateStatsBar();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const area = document.getElementById('narrative-area');
    if (area) area.scrollTop = area.scrollHeight;
  });
}

// ═══════════════════ GAME STATE UPDATES ═══════════════════
function _extractItemsFromResponse(response) {
  const gainP = /\[(?:获得物品|获得)[：:]\s*(.+?)\]/g;
  const lossP = /\[(?:失去物品|失去)[：:]\s*(.+?)\]/g;
  let m;
  while ((m = gainP.exec(response)) !== null) {
    const item = m[1].trim();
    if (!state.inventory.includes(item)) state.inventory.push(item);
  }
  while ((m = lossP.exec(response)) !== null) {
    const item = m[1].trim();
    const idx = state.inventory.indexOf(item);
    if (idx !== -1) state.inventory.splice(idx, 1);
  }
}

function _extractStatChanges(response) {
  var p = /\[属性变化[：:]\s*(\w+)\s*=\s*([+-]\d+)\]/g;
  var m;
  while ((m = p.exec(response)) !== null) {
    var key = m[1].trim();
    var delta = parseInt(m[2], 10);
    if (state.stats[key] !== undefined) {
      var oldVal = state.stats[key];
      state.stats[key] = Math.max(0, oldVal + delta);
      if (delta > 0 && key === 'level') {
        _showStatBoostPopup('⬆', '境界提升', state.playerName + ' 突破至 ' + state.stats[key] + ' 阶');
      }
    }
  }
}

function _extractPlotUpdates(response) {
  if (!state.plot) state.plot = getInitialPlot(state.worldGenre);
  const mtMatch = response.match(/\[主线更新[：:]\s*(.+?)\]/);
  if (mtMatch) {
    state.plot.mainThread = mtMatch[1].trim();
    if (!state.plot.completedMilestones.includes(state.plot.mainThread)) {
      state.plot.completedMilestones.push('主线确立：' + state.plot.mainThread);
    }
    state.annals.push({ chapter: state.plot.chapter || 1, title: state.plot.chapterTitle || '', event: mtMatch[1].trim(), stage: state.plot.stage || 'opening', timestamp: state.fullHistory.length });
  }
  const stMatch = response.match(/\[剧情阶段[：:]\s*(.+?)\]/);
  if (stMatch) {
    const newStage = stMatch[1].trim();
    const stageMap = { '序幕': 'opening', '展开': 'development', '转折': 'turning_point', '高潮': 'climax', '终局': 'resolution' };
    const validStages = ['opening', 'development', 'turning_point', 'climax', 'resolution'];
    const mapped = stageMap[newStage] || (validStages.includes(newStage) ? newStage : null);
    if (mapped && mapped !== state.plot.stage) {
      state.plot.completedMilestones.push('进入阶段：' + newStage);
      state.plot.stage = mapped;
      const act = getPlotFramework(state.worldGenre).acts[mapped];
      if (act) state.plot.tension = act.tension;
    }
  }
  const chMatch = response.match(/\[章节[：:]\s*(\d+)\s*[—–-]\s*(.+?)\]/);
  if (chMatch) {
    state.plot.chapter = parseInt(chMatch[1], 10);
    state.plot.chapterTitle = chMatch[2].trim();
    const lastAnnal = state.annals[state.annals.length - 1];
    if (!lastAnnal || lastAnnal.chapter !== state.plot.chapter || lastAnnal.event !== '新章节开始') {
      state.annals.push({ chapter: state.plot.chapter, title: state.plot.chapterTitle, event: '新章节开始', stage: state.plot.stage || 'opening', timestamp: state.fullHistory.length });
    }
  }
  const hookPattern = /\[伏笔[：:]\s*(.+?)\]/g;
  let hm;
  while ((hm = hookPattern.exec(response)) !== null) {
    const hook = hm[1].trim();
    if (!state.plot.pendingHooks.includes(hook)) state.plot.pendingHooks.push(hook);
  }
}

function _trackAchievementFlags(response) {
  if (/\[被欺骗\]/.test(response)) state._deceivedCount = (state._deceivedCount || 0) + 1;
  if (/\[欺骗成功\]/.test(response)) state._deceivedNpcCount = (state._deceivedNpcCount || 0) + 1;
  if (/\[结拜\]/.test(response)) state._swornBrother = true;
  if (/\[通缉\]/.test(response)) state._wanted = true;
  if (/\[濒死\]/.test(response)) state._nearDeath = true;
  if (/\[偏离主线\]/.test(response) && state.plot) state.plot.derailed = true;
}

function updateGameStateFromResponse(response) {
  const loc = extractLocation(response);
  if (loc) state.location = loc;
  _extractItemsFromResponse(response);
  _extractStatChanges(response);
  const relPattern = /\[关系更新[：:]\s*(.+?)\s*[—–-]\s*(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+?))?\]/g;
  let relMatch;
  while ((relMatch = relPattern.exec(response)) !== null) {
    updateRelationship(relMatch[1].trim(), relMatch[2].trim(), (relMatch[3] || '').trim(), (relMatch[4] || '').trim());
  }
  _extractPlotUpdates(response);
  if (state.stats.hp !== undefined && state.stats.maxHp && state.stats.hp <= state.stats.maxHp * 0.2 && state.stats.hp > 0) {
    state._nearDeath = true;
  }
  _trackAchievementFlags(response);
  if (state.fullHistory.length % 3 === 0) state.plot.summary = summarizeForPlot(response);
  resetSuggestions();
  if (state.fullHistory.length % 5 === 0) state.worldMemory = summarizeForMemory(response);
}

async function daredevilAction() {
  if (!state.gameStarted) return;
  if (guardBusy()) return;
  const input = document.getElementById('command-input');
  if (!input) return;

  const btn = document.getElementById('btn-daredevil');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 酝酿作死……'; }

  const systemPrompt = buildSystemPrompt();
  const askPrompt = '请根据当前的情境、角色状态、以及最近发生的事件，为角色构思1个"作死"性质的行动——即冒险、挑衅、不计后果、或戏剧性冲动行为。要求：1) 6-25字，具体可执行 2) 基于当前上下文，符合当前场景与角色处境，让人觉得合理但又确实疯狂 3) 风格应与世界观一致 4) 不打破第四面墙。请严格按照格式回复：[作死行动：具体行动描述]，不要输出其他任何内容。';

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...state.apiHistory.filter(m => m.role !== 'system').slice(-8),
      { role: 'user', content: askPrompt },
    ];
    const response = await callAPI(messages);
    const match = response.match(/\[作死行动[：:]\s*([^\]]+)\]/);
    if (match) {
      input.value = match[1].trim();
    } else {
      // Fallback to static list
      const category = getWorldStatType(state.worldGenre);
      const actions = DAREDEVIL_ACTIONS[category] || DAREDEVIL_ACTIONS.fantasy;
      input.value = actions[Math.floor(Math.random() * actions.length)];
    }
  } catch (err) {
    // Fallback to static list on error
    const category = getWorldStatType(state.worldGenre);
    const actions = DAREDEVIL_ACTIONS[category] || DAREDEVIL_ACTIONS.fantasy;
    input.value = actions[Math.floor(Math.random() * actions.length)];
  }

  state.recklessCount = (state.recklessCount || 0) + 1;
  state._recentReckless = (state._recentReckless || 0) + 1;
  input.focus();
  if (btn) { btn.disabled = false; btn.textContent = '💀 作死一下'; }
}

async function requestSuggestions() {
  const btn = document.getElementById('btn-suggest');
  const container = document.getElementById('suggestion-buttons');
  if (!btn || !container) return;
  if (!state.gameStarted) return;
  if (guardBusy()) return;

  btn.disabled = true;
  btn.textContent = '⏳ 思考中……';
  container.innerHTML = '';

  const systemPrompt = buildSystemPrompt();
  const askPrompt = '请根据当前的情境、角色状态、以及最近发生的事件，为角色提供3个合理的下一步行动建议。要求：1) 每个建议6-15字，具体可执行 2) 三个建议方向各异（探索/互动/战斗/对话等）3) 基于当前上下文，不重复已做过的行动 4) 不打破第四面墙。请严格按照格式回复：[行动建议：选项1 | 选项2 | 选项3]，不要输出其他任何内容。';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...state.apiHistory.filter(m => m.role !== 'system').slice(-8),
    { role: 'user', content: askPrompt },
  ];

  try {
    const response = await callAPI(messages);
    const sugPattern = /\[行动建议[：:]\s*([^\]]+)\]/;
    const sugMatch = response.match(sugPattern);
    if (sugMatch) {
      const suggestions = sugMatch[1].split(/[|｜]/).map(s => s.trim()).filter(s => s);
      if (suggestions.length > 0) {
        renderSuggestions(suggestions);
        btn.style.display = 'none';
        return;
      }
    }
    // If parsing failed, show generic fallback
    renderSuggestions(['观察周围的环境', '寻找值得探索的方向', '检查身上的物品与状态']);
    btn.style.display = 'none';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '💡 行动建议';
    toast('获取建议失败：' + err.message, 'error');
    return;
  }

  btn.disabled = false;
  btn.textContent = '💡 行动建议';
}

function renderSuggestions(suggestions) {
  const container = document.getElementById('suggestion-buttons');
  if (!container) return;
  container.innerHTML = '';
  suggestions.forEach(sug => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-btn';
    btn.textContent = sug;
    btn.addEventListener('click', () => {
      document.getElementById('command-input').value = sug;
      sendCommand();
    });
    container.appendChild(btn);
  });
  addMetaButtons(container);
}

async function requestMoreSuggestions() {
  const container = document.getElementById('suggestion-buttons');
  if (!container || !state.gameStarted) return;
  if (guardBusy()) return;

  // Remove meta buttons temporarily
  const existingBtns = container.querySelectorAll('.suggestion-more-btn');
  existingBtns.forEach(b => b.remove());

  const systemPrompt = buildSystemPrompt();
  const askPrompt = '请根据当前的情境，为角色提供3个新的、与之前不同的合理行动建议。要求：1) 每个建议6-15字，具体可执行 2) 三个建议方向各异 3) 不与已展示的建议重复 4) 不打破第四面墙。请严格按照格式回复：[行动建议：选项1 | 选项2 | 选项3]，不要输出其他任何内容。';

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...state.apiHistory.filter(m => m.role !== 'system').slice(-8),
      { role: 'user', content: askPrompt },
    ];
    const response = await callAPI(messages);
    const sugPattern = /\[行动建议[：:]\s*([^\]]+)\]/;
    const sugMatch = response.match(sugPattern);
    if (sugMatch) {
      const newSuggestions = sugMatch[1].split(/[|｜]/).map(s => s.trim()).filter(s => s);
      if (newSuggestions.length > 0) {
        appendSuggestions(newSuggestions);
        return;
      }
    }
    appendSuggestions(['观察周围的环境', '寻找值得探索的方向', '检查身上的物品与状态']);
  } catch (err) {
    toast('获取建议失败：' + err.message, 'error');
    // Re-add meta buttons on failure
    addMetaButtons(container);
  }
}

function appendSuggestions(newSuggestions) {
  const container = document.getElementById('suggestion-buttons');
  if (!container) return;
  newSuggestions.forEach(sug => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-btn';
    btn.textContent = sug;
    btn.addEventListener('click', () => {
      document.getElementById('command-input').value = sug;
      sendCommand();
    });
    container.appendChild(btn);
  });
  addMetaButtons(container);
}

function addMetaButtons(container) {
  // Remove stale meta buttons first
  container.querySelectorAll('.suggestion-more-btn').forEach(b => b.remove());

  const moreBtn = document.createElement('button');
  moreBtn.className = 'suggestion-btn suggestion-more-btn';
  moreBtn.textContent = '🔄 更多';
  moreBtn.addEventListener('click', () => requestMoreSuggestions());
  container.appendChild(moreBtn);

  const regenerateBtn = document.createElement('button');
  regenerateBtn.className = 'suggestion-btn suggestion-more-btn';
  regenerateBtn.textContent = '♻️ 重新生成';
  regenerateBtn.addEventListener('click', () => {
    resetSuggestions();
    requestSuggestions();
  });
  container.appendChild(regenerateBtn);
}

function guardBusy() {
  if (_activeAbortController) {
    toast('世界正在回应中，请稍候……', 'error');
    return true;
  }
  return false;
}

function resetSuggestions() {
  const btn = document.getElementById('btn-suggest');
  const container = document.getElementById('suggestion-buttons');
  if (btn) {
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = '💡 行动建议';
  }
  if (container) container.innerHTML = '';
}

function updateRelationship(name, relation, title, notes) {
  const existing = state.relationships.find(r => r.name === name);
  if (existing) {
    if (relation) existing.relation = relation;
    if (title) existing.title = title;
    if (notes) existing.notes = notes;
  } else {
    state.relationships.push({ name, title: title || '', relation: relation || '相识', notes: notes || '' });
  }
}

function stripAnnotations(text) {
  return text.replace(/\[(?:关系更新|行动建议|获得(?:物品)?|失去(?:物品)?|属性变化|主线更新|剧情阶段|章节|伏笔|场景)[：:][^\]]*\]\n?/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function extractLocation(text) {
  // Prefer [场景：xxx] annotation — most reliable
  var sceneMatch = text.match(/\[场景[：:]\s*([^\]]{1,15})\]/);
  if (sceneMatch) return sceneMatch[1].trim();
  // Fallback: heuristic regex patterns
  var patterns = [
    /(?:位于|来到|站在|身处|踏入|到达)(?:了)?(?:一[个座处片间])?[「"']?([^，。！？\n「"']{2,12})[「"']?/,
    /(?:你(?:现在|此刻|正)?在)([^，。！？\n]{2,12})/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[1];
  }
  return null;
}

function summarizeForMemory(text) {
  var stripped = stripAnnotations(text);
  var sentences = stripped.split(/[。！？\n]/).filter(function(s) { return s.trim().length > 5; });
  return sentences.slice(0, 3).join('。') + (sentences.length > 0 ? '。' : '');
}

function summarizeForPlot(text) {
  // Build a running story summary from narrative text
  const stripped = stripAnnotations(text);
  const sentences = stripped.split(/[。！？\n]/).filter(s => s.trim().length > 10).slice(0, 3);
  const newSummary = sentences.join('。');
  if (!state.plot.summary) return newSummary;
  // Keep existing summary, append new key event
  const existing = state.plot.summary.split('。').filter(s => s.trim());
  const combined = [...existing.slice(-3), ...sentences];
  return combined.slice(-5).join('。');
}

let _apiHistoryVersion = 0;
function _bumpApiVersion() { _apiHistoryVersion++; }

async function compressMemory(turnCount) {
  const version = _apiHistoryVersion;
  const messages = state.apiHistory.filter(m => m.role !== 'system');
  const earlyMessages = messages.slice(0, Math.min(15, messages.length));
  if (earlyMessages.length === 0) return;
  const historyText = earlyMessages.map(m => `[${m.role === 'user' ? '角色' : '世界'}]: ${m.content.slice(0, 300)}`).join('\n');
  const prompt = `请用200字以内的中文，将以下对话历史提炼为记忆摘要。重点保留：①未解伏笔与悬念 ②重要NPC的身份与关系 ③已发生的关键事件与转折 ④角色当前的处境与目标。直接输出摘要文本，不要任何前缀。\n\n${historyText}`;

  try {
    const response = await callAPI([{ role: 'user', content: prompt }]);
    if (_apiHistoryVersion !== version) return; // discard stale compression
    const roundLabel = `[第${turnCount}轮记忆]`;
    var newMemory = (state.worldMemory ? state.worldMemory + '\n' : '') + roundLabel + ' ' + response.trim();
    var MEMORY_LIMIT = 800;
    if (newMemory.length > MEMORY_LIMIT) {
      var trimmed = newMemory.slice(-MEMORY_LIMIT);
      var firstNewline = trimmed.indexOf('\n');
      state.worldMemory = firstNewline !== -1 ? trimmed.slice(firstNewline + 1) : trimmed;
    } else {
      state.worldMemory = newMemory;
    }
  } catch(e) {
    // Silent fail — compression is best-effort
  }
}

function updateStatsBar() {
  const config = getWorldStats(state.worldGenre);
  const display = config.display;
  const stats = state.stats;
  const container = document.getElementById('stats-items');
  if (!container) return;

  let html = '';
  for (let i = 0; i < display.length; i++) {
    const d = display[i];
    if (d.sepBefore) html += '<span class="stat-sep"></span>';
    if (d.showMax) {
      const maxKey = 'max' + d.id.charAt(0).toUpperCase() + d.id.slice(1);
      html += `<div class="stat-item ${d.cls}"><span class="stat-icon">${d.icon}</span><span class="stat-label">${d.label}</span><span class="val">${stats[d.id] || 0}</span><span class="stat-sep-slash">/</span><span class="val">${stats[maxKey] || 0}</span></div>`;
    } else {
      html += `<div class="stat-item ${d.cls}"><span class="stat-icon">${d.icon}</span><span class="stat-label">${d.label}</span><span class="val">${stats[d.id] !== undefined ? stats[d.id] : 0}</span></div>`;
    }
  }
  container.innerHTML = html;
  document.getElementById('location-tag').textContent = state.location || '';
  var destinyEl = document.getElementById('destiny-tag');
  if (destinyEl && state.characterSheet && state.characterSheet.destiny) {
    var destiny = DESTINIES.find(function(d) { return d.id === state.characterSheet.destiny; });
    if (destiny) {
      destinyEl.textContent = destiny.icon || '✦';
      destinyEl.title = '【' + destiny.name + '】' + destiny.desc;
      destinyEl.style.display = '';
    }
  } else if (destinyEl) {
    destinyEl.style.display = 'none';
  }
}

// ═══════════════════ INVENTORY ═══════════════════
function showInventory() {
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');

  let html = '<h3>📦 行囊</h3>';
  if (state.inventory.length === 0) {
    html += '<p class="empty">行囊空空如也</p>';
  } else {
    html += '<ul class="item-list">';
    state.inventory.forEach(item => {
      html += `<li>${escapeHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  html += '<button class="overlay-close" onclick="closeOverlay()">关 闭</button>';

  content.innerHTML = html;
  overlay.classList.remove('hidden');
}

// ═══════════════════ ANNALS ═══════════════════
function showAnnals() {
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');

  const stageColors = {
    opening: 'var(--accent)',
    development: '#7a8ac4',
    turning_point: 'var(--danger-bright)',
    climax: '#c47a7a',
    resolution: 'var(--text-dim)'
  };

  let html = '<h3>📜 世界年表</h3>';
  if (!state.annals || state.annals.length === 0) {
    html += '<p class="empty">故事尚未留下痕迹……</p>';
  } else {
    // Group by chapter
    const chapters = {};
    state.annals.forEach(a => {
      const key = a.chapter;
      if (!chapters[key]) chapters[key] = { chapter: a.chapter, title: a.title, events: [] };
      chapters[key].events.push(a);
    });
    const sortedChapters = Object.values(chapters).sort((a, b) => a.chapter - b.chapter);

    html += '<div class="annals-timeline">';
    sortedChapters.forEach(ch => {
      html += `<div class="annals-chapter">
        <div class="annals-chapter-title">第${ch.chapter}章${ch.title ? '：' + escapeHtml(ch.title) : ''}</div>`;
      ch.events.forEach(e => {
        const color = stageColors[e.stage] || stageColors.opening;
        html += `<div class="annals-event" style="border-left-color:${color}">
          <div class="annals-event-text">${escapeHtml(e.event)}</div>
        </div>`;
      });
      html += '</div>';
    });
    html += '</div>';
  }
  // Pending hooks section
  if (state.plot && state.plot.pendingHooks && state.plot.pendingHooks.length > 0) {
    html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">';
    html += '<div style="font-size:11px;color:var(--text-dim);letter-spacing:2px;margin-bottom:10px">▍悬而未决</div>';
    state.plot.pendingHooks.forEach(function(hook) {
      html += '<div style="font-size:13px;color:var(--text);padding:6px 0 6px 12px;border-left:2px solid var(--accent);margin-bottom:6px;font-family:var(--font-narrative)">' + escapeHtml(hook) + '</div>';
    });
    html += '</div>';
  }
  html += '<button class="overlay-close" onclick="closeOverlay()">关 闭</button>';

  content.innerHTML = html;
  overlay.classList.remove('hidden');
}

// ═══════════════════ ACHIEVEMENTS ═══════════════════
let _achQueue = [];
let _achShowing = false;

let _sharedAudioCtx = null;
function _getAudioCtx() {
  if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
    _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _sharedAudioCtx;
}

function playAchievementSound() {
  try {
    const ctx = _getAudioCtx();
    const t = ctx.currentTime;
    // First oscillator: 440Hz → 880Hz sweep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, t);
    osc1.frequency.linearRampToValueAtTime(880, t + 0.15);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.15);
    // Second oscillator: 1320Hz chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, t + 0.1);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.setValueAtTime(0.15, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.3);
  } catch(e) { /* audio not available */ }
}

function showAchievementPopup(ach) {
  const popup = document.getElementById('achievement-popup');
  popup.style.setProperty('--ach-color', ach.color);
  popup.style.setProperty('--ach-glow', ach.color + '33');
  popup.innerHTML = `<div class="ach-icon-wrap">${ach.icon}</div>
    <div class="ach-body">
      <div class="ach-label">成 就 解 锁</div>
      <div class="ach-name">${escapeHtml(ach.name)}</div>
      <div class="ach-desc">${escapeHtml(ach.desc)}</div>
    </div>`;
  popup.classList.remove('hidden');
  void popup.offsetWidth;
  popup.classList.add('show');
  playAchievementSound();

  const dismiss = () => {
    popup.classList.remove('show');
    popup.classList.add('hidden');
    _achShowing = false;
    popup.removeEventListener('click', dismiss);
    // Show next in queue
    if (_achQueue.length > 0) {
      setTimeout(() => { showAchievementPopup(_achQueue.shift()); }, 1500);
    }
  };
  popup.addEventListener('click', dismiss);
  _achShowing = true;

  // Auto-dismiss after 3.5s
  setTimeout(() => {
    if (_achShowing && popup.classList.contains('show')) dismiss();
  }, 3500);
}

function _showStatBoostPopup(icon, title, desc) {
  var popup = document.getElementById('achievement-popup');
  if (!popup) return;
  if (_achShowing || _achQueue.length > 0) {
    _achQueue.push({ icon: icon, name: title, desc: desc, color: '#4a7a5a' });
    return;
  }
  popup.style.setProperty('--ach-color', '#4a7a5a');
  popup.style.setProperty('--ach-glow', '#4a7a5a33');
  popup.innerHTML = '<div class="ach-icon-wrap">' + icon + '</div>' +
    '<div class="ach-body">' +
      '<div class="ach-label">' + escapeHtml(title) + '</div>' +
      '<div class="ach-name">' + escapeHtml(desc) + '</div>' +
    '</div>';
  popup.classList.remove('hidden');
  void popup.offsetWidth;
  popup.classList.add('show');
  _achShowing = true;
  var dismiss = function() {
    popup.classList.remove('show');
    popup.classList.add('hidden');
    _achShowing = false;
    popup.removeEventListener('click', dismiss);
    if (_achQueue.length > 0) setTimeout(function() { showAchievementPopup(_achQueue.shift()); }, 1500);
  };
  popup.addEventListener('click', dismiss);
  setTimeout(function() { if (_achShowing && popup.classList.contains('show')) dismiss(); }, 3000);
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (state.unlockedAchievements.includes(ach.id)) return;
    if (ach.check(state)) {
      state.unlockedAchievements.push(ach.id);
      if (_achShowing || _achQueue.length > 0) {
        _achQueue.push(ach);
      } else {
        showAchievementPopup(ach);
      }
    }
  });
}

function showAchievements() {
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');
  const unlocked = (state.unlockedAchievements || []).length;
  let html = `<h3>🏆 成就 <span style="color:var(--accent-bright);font-size:12px;font-family:var(--font-ui);letter-spacing:2px">${unlocked} / ${ACHIEVEMENTS.length} 已解锁</span></h3>`;
  html += '<div class="ach-grid">';
  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = (state.unlockedAchievements || []).includes(ach.id);
    if (isUnlocked) {
      html += `<div class="ach-card unlocked" style="--ach-color:${ach.color}">
        <div class="ach-card-icon">${ach.icon}</div>
        <div><div class="ach-card-name">${escapeHtml(ach.name)}</div><div class="ach-card-desc">${escapeHtml(ach.desc)}</div></div>
      </div>`;
    } else {
      html += `<div class="ach-card locked">
        <div class="ach-card-icon">🔒</div>
        <div><div class="ach-card-name">???</div><div class="ach-card-desc">???</div></div>
      </div>`;
    }
  });
  html += '</div>';
  html += '<button class="overlay-close" onclick="closeOverlay()">关 闭</button>';
  content.innerHTML = html;
  overlay.classList.remove('hidden');
}

// ═══════════════════ RELATIONSHIPS ═══════════════════
function showRelationships() {
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');

  let html = '<h3>💞 羁绊之人</h3>';
  if (state.relationships.length === 0) {
    html += '<p class="empty">尚未与任何人建立羁绊……<br>去遇见值得铭记的人吧。</p>';
  } else {
    html += '<div class="bond-list">';
    state.relationships.forEach(r => {
      const bondClass = bondToClass(r.relation);
      html += `<div class="bond-card">
        <div class="bond-name">${escapeHtml(r.name)}</div>
        <div class="bond-title">${escapeHtml(r.title || '未知身份')}</div>
        <div class="bond-level ${bondClass}">${escapeHtml(r.relation)}</div>
        ${r.notes ? `<div class="bond-notes">${escapeHtml(r.notes)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }
  html += '<button class="overlay-close" onclick="closeOverlay()">关 闭</button>';

  content.innerHTML = html;
  overlay.classList.remove('hidden');
}

function bondToClass(relation) {
  const map = {
    '挚爱': 'bond-deep', '恋人': 'bond-deep', '家人': 'bond-deep', '师徒': 'bond-deep',
    '盟友': 'bond-warm', '挚友': 'bond-warm', '朋友': 'bond-warm', '相识': 'bond-neutral',
    '陌生人': 'bond-neutral', '对手': 'bond-rival', '宿敌': 'bond-rival', '仇敌': 'bond-rival',
  };
  return map[relation] || 'bond-neutral';
}

// ═══════════════════ SAVE/LOAD ═══════════════════

function saveGame() {
  if (!state.gameStarted) return;
  showSaveManager();
}

// Returns account type label for UI
function accountTypeLabel() {
  if (hasCloud()) return 'cloud';
  return 'guest';
}

async function saveToSlot(n) {
  if (!state.gameStarted) return;
  // Save to scoped localStorage
  var slotKey = getSaveKey(n);
  if (slotKey) localStorage.setItem(slotKey, JSON.stringify(serializeState()));

  var cloudOk = false;
  if (hasCloud()) {
    var result = await cloudSave(n);
    cloudOk = result.ok;
    if (!result.ok) {
      toast('本地缓存已保存，但云端同步失败：' + (result.error || '未知错误'), 'error');
    }
  }

  if (cloudOk) {
    toast('已保存到槽位 ' + (n + 1) + '｜云端同步成功 ✓');
  } else if (!hasCloud()) {
    toast('已保存到槽位 ' + (n + 1) + '（游客模式：存档仅保存在当前浏览器） ✓');
  }
  showSaveManager();
}

async function loadSlot(n) {
  var raw = null;
  var source = 'local';

  // Cloud: try Supabase first (RLS ensures only current user's saves)
  if (hasCloud()) {
    var result = await cloudLoad(n);
    if (result.ok && result.data) {
      raw = JSON.stringify(result.data);
      source = 'cloud';
    }
  }

  // Fallback to scoped local only — never read another identity's saves
  if (!raw) {
    var slotKey = getSaveKey(n);
    if (slotKey) raw = localStorage.getItem(slotKey);
  }
  if (!raw) { toast('槽位为空', 'error'); return; }

  try {
    var save = JSON.parse(raw);
    deserializeState(save);
    closeOverlay();
    showScreen('game');
    renderFullHistory();
    resetSuggestions();
    updateStatsBar();
    document.getElementById('command-input').focus();
    if (source === 'cloud') toast('已从云端读取槽位 ' + (n + 1));
    else toast('已读取本地槽位 ' + (n + 1));
  } catch(e) {
    toast('存档损坏，无法读取', 'error');
  }
}

async function deleteSlot(n) {
  if (!confirm('确认删除槽位 ' + (n + 1) + ' 的存档？此操作不可撤销。')) return;
  // Delete scoped local slot
  var slotKey = getSaveKey(n);
  if (slotKey) localStorage.removeItem(slotKey);

  if (hasCloud()) {
    var result = await cloudDelete(n);
    if (result.ok) toast('已删除槽位 ' + (n + 1) + '（本地及云端）');
    else toast('已删除本地槽位 ' + (n + 1) + '，但云端删除失败：' + (result.error || '未知错误'), 'error');
  } else {
    toast('已删除槽位 ' + (n + 1));
  }
  showSaveManager();
}

async function getSlotInfo(n, opt_cloudSlots) {
  // Show cloud + current-identity scoped local, prefer cloud if newer
  var cloudInfo = null;
  var localInfo = null;

  if (hasCloud()) {
    var slots;
    if (opt_cloudSlots !== undefined) {
      slots = opt_cloudSlots;
    } else {
      var result = await cloudListSlots();
      slots = result.ok ? (result.data || []) : null;
    }
    if (slots) {
      var cs = slots.find(function(s) { return s.slot === n; });
      if (cs) {
        cloudInfo = {
          playerName: cs.character_name || '???',
          worldGenre: cs.world_name || '???',
          level: 1,
          savedAt: cs.updated_at || '',
          source: 'cloud',
        };
      }
    }
  }

  // Only read scoped local saves — never read another identity's slots
  var slotKey = getSaveKey(n);
  if (slotKey) {
    var raw = localStorage.getItem(slotKey);
    if (raw) {
      try {
        var s = JSON.parse(raw);
        localInfo = {
          playerName: s.playerName || '???',
          worldGenre: s.worldGenre || '???',
          level: (s.stats && s.stats.level) ? s.stats.level : 1,
          savedAt: s.savedAt || '',
          source: 'local',
        };
      } catch(e) {}
    }
  }

  // Prefer cloud if it exists and is newer
  if (cloudInfo && localInfo) {
    return cloudInfo.savedAt >= localInfo.savedAt ? cloudInfo : localInfo;
  }
  return cloudInfo || localInfo || null;
}

async function showSaveManager() {
  var overlay = document.getElementById('overlay');
  var content = document.getElementById('overlay-content');

  // Show overlay immediately with loading state
  var html = '<h3>💾 存档管理</h3><p style="text-align:center;color:var(--text-dim);font-family:var(--font-ui)">加载中...</p>';
  content.innerHTML = html;
  overlay.classList.remove('hidden');

  // Pre-fetch cloud slots once (instead of per-slot in getSlotInfo)
  var cloudSlots = null;
  var cloudError = null;
  var at = accountTypeLabel();
  if (at === 'cloud') {
    try {
      var result = await cloudListSlots();
      if (result.ok) {
        cloudSlots = result.data || [];
      } else {
        cloudError = result.error || '云端查询失败';
      }
    } catch(e) {
      cloudError = e.message || '云端查询异常';
    }
  }

  // Rebuild header
  html = '<h3>💾 存档管理';
  if (at === 'cloud') {
    html += ' <span style="color:var(--accent-bright);font-size:11px;font-family:var(--font-ui)">☁️ 云端账号：存档可跨设备同步</span>';
  } else {
    html += ' <span style="color:var(--text-dim);font-size:11px;font-family:var(--font-ui)">👤 游客模式：存档仅保存在当前浏览器</span>';
  }
  html += '</h3>';

  // Status line
  if (at === 'cloud') {
    html += '<p style="text-align:center;font-size:11px;color:var(--accent-bright);margin-bottom:8px;font-family:var(--font-ui)">当前只显示此账号的存档</p>';
  } else {
    html += '<p style="text-align:center;font-size:11px;color:var(--text-dim);margin-bottom:8px;font-family:var(--font-ui)">游客存档不会同步到其他设备</p>';
  }

  // Cloud error banner
  if (cloudError) {
    console.warn('[Cloud] 存档列表查询失败：' + cloudError);
    html += '<p style="text-align:center;font-size:11px;color:var(--danger);margin-bottom:8px;font-family:var(--font-ui)">⚠️ 云端存档检查失败。可稍后重试。</p>';
  }

  // Auto-save info (scoped)
  var autoKey = getAutoSaveKey();
  var asRaw = autoKey ? localStorage.getItem(autoKey) : null;
  if (asRaw) {
    try {
      var as = JSON.parse(asRaw);
      if (as.gameStarted && as.savedAt) {
        html += '<div class="save-autosave">🔄 自动存档: ' + formatSaveTime(as.savedAt) + '</div>';
      }
    } catch(e) {}
  }

  html += '<div class="save-slots">';
  for (var i = 0; i < SAVE_SLOTS; i++) {
    var info = await getSlotInfo(i, cloudSlots);
    html += '<div class="save-slot' + (info ? '' : ' empty') + '">';
    html += '<div class="slot-num">槽位 ' + (i + 1) + (info && info.source === 'cloud' ? ' ☁️' : (info ? ' 💻' : '')) + '</div>';
    if (info) {
      html += '<div class="slot-info">' + escapeHtml(info.playerName) + ' <span>|</span> ' + escapeHtml(info.worldGenre) + '</div>';
      html += '<div class="slot-time">' + formatSaveTime(info.savedAt) + (info.source === 'cloud' ? ' · 云端' : ' · 本地') + '</div>';
      html += '<div class="slot-actions">';
      html += '<button class="load-btn" onclick="loadSlot(' + i + ')">📂 读取</button>';
      html += '<button class="save-btn" onclick="saveToSlot(' + i + ')">💾 覆盖</button>';
      html += '<button class="del-btn" onclick="deleteSlot(' + i + ')">🗑 删除</button>';
      html += '</div>';
    } else {
      html += '<div class="slot-empty-text">空</div>';
      html += '<div class="slot-actions">';
      html += '<button class="save-btn" onclick="saveToSlot(' + i + ')">💾 保存到此</button>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '<button class="overlay-close" onclick="closeOverlay()">关 闭</button>';

  content.innerHTML = html;
  overlay.classList.remove('hidden');
}

function closeOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// ═══════════════════ UTILITIES ═══════════════════
function formatSaveTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate() + ' ' +
         String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type === 'error' ? 'error show' : 'show';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.className = ''; }, 2500);
}

// ═══════════════════ EVENT HANDLERS ═══════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Genre card clicks, world settings

  // Genre card clicks
  document.querySelectorAll('.genre-card').forEach(card => {
    card.addEventListener('click', () => selectGenreCard(card.dataset.genre));
  });

  // Custom world desc input
  document.getElementById('custom-world-desc').addEventListener('input', (e) => {
    state.customWorldDesc = e.target.value;
  });

  // Enter key on settings inputs
  document.getElementById('player-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startNewGame();
  });

  // Init local identity
  initIdentity();

  // Auth enter key handlers (for login modal)
  document.getElementById('auth-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSignIn();
    else if (e.key === 'Escape') closeLoginModal();
  });
  document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSignIn();
    else if (e.key === 'Escape') closeLoginModal();
  });

  // Command input
  const cmdInput = document.getElementById('command-input');
  const btnSend = document.getElementById('btn-send');

  btnSend.addEventListener('click', sendCommand);
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (_inputHistory.length === 0) return;
      if (_inputHistoryIdx === -1) _inputHistoryIdx = _inputHistory.length - 1;
      else if (_inputHistoryIdx > 0) _inputHistoryIdx--;
      cmdInput.value = _inputHistory[_inputHistoryIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (_inputHistoryIdx === -1) return;
      if (_inputHistoryIdx < _inputHistory.length - 1) {
        _inputHistoryIdx++;
        cmdInput.value = _inputHistory[_inputHistoryIdx];
      } else {
        _inputHistoryIdx = -1;
        cmdInput.value = '';
      }
    }
  });

  // Close overlay on escape or click outside
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay();
  });
  document.getElementById('overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  // Check for saved game on load (scoped to current identity)
  refreshTitleButtons();
  // Also restore saved API key if any
  var savedApiKey = localStorage.getItem('text_adventure_apikey');
  if (savedApiKey) {
    state.apiKey = savedApiKey;
    var apiInput = document.getElementById('api-key-input');
    if (apiInput && !apiInput.value) apiInput.value = savedApiKey;
  }

  // Add narrative-end marker
  const endMarker = document.createElement('div');
  endMarker.id = 'narrative-end';
  document.getElementById('narrative-area').appendChild(endMarker);

  // Mobile: prevent soft keyboard from obscuring input area
  if (window.visualViewport) {
    const gameScreen = document.getElementById('game-screen');
    window.visualViewport.addEventListener('resize', () => {
      const vh = window.visualViewport.height;
      const wh = window.innerHeight;
      if (vh < wh - 80) {
        gameScreen.style.height = vh + 'px';
      } else {
        gameScreen.style.height = '';
      }
    });
  }
});

// ═══════════════════ EXPORT STORY ═══════════════════
function exportStory() {
  if (!state.gameStarted && state.fullHistory.length === 0) {
    toast('还没有故事可以导出', 'error');
    return;
  }
  var lines = [];
  lines.push('# ' + (state.playerName || '无名') + ' · ' + (state.worldGenre || '未知世界'));
  lines.push('');
  lines.push('> 导出自「异界卷·文字冒险」· ' + new Date().toLocaleDateString('zh-CN'));
  lines.push('');
  lines.push('---');
  lines.push('');
  state.fullHistory.forEach(function(entry) {
    if (entry.role === 'player') {
      lines.push('**▸ ' + entry.content + '**');
      lines.push('');
    } else {
      lines.push(entry.content);
      lines.push('');
    }
  });
  var md = lines.join('\n');
  var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (state.playerName || '故事') + '_' + new Date().toISOString().slice(0, 10) + '.md';
  a.click();
  URL.revokeObjectURL(url);
  toast('故事已导出 ✨');
}

// ═══════════════════ TITLE STARS ═══════════════════
(function createStars() {
  const screen = document.getElementById('title-screen');
  for (let i = 0; i < 30; i++) {
    const star = document.createElement('div');
    star.className = 'title-star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 5 + 's';
    star.style.animationDuration = (2 + Math.random() * 4) + 's';
    screen.appendChild(star);
  }
})();
