/* MCJS Launcher - Main Application */
(function(){'use strict';

/* ========== DOM Refs ========== */
var grid = document.getElementById('versionSections');
var searchInput = document.getElementById('searchInput');
var launchModal = document.getElementById('launchModal');
var gameOverlay = document.getElementById('gameOverlay');
var gameToolbar = document.getElementById('gameToolbar');
var gameTitle = document.getElementById('gameTitle');
var launchText = document.getElementById('launchText');
var launchDetail = document.getElementById('launchDetail');
var launchProgress = document.getElementById('launchProgress');
var launchContent = document.getElementById('launchContent');

/* ========== State ========== */
var searchQuery = '';
var searchDebounceTimer = null;
var settings = window.MCJS_SETTINGS || {};
var sound = null;
var currentVersion = null;
var isLaunching = false;
var settingsWindow = null;

/* ========== Sound Manager ========== */
var SoundManager = function(){
  this.ctx = null;
  this.enabled = true;
  this.unlocked = false;
  this._initAndUnlock();
};
SoundManager.prototype._initAndUnlock = function(){
  var AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return;
  try {
    this.ctx = new AC();
    if(this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function(){});
    }
    try{
      var buf = this.ctx.createBuffer(1, 1, 22050);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch(e){}
    this.unlocked = true;
  } catch(e){
    console.warn('[MCJS] AudioContext init failed:', e);
    this.ctx = null;
  }
};
SoundManager.prototype._ensureCtx = function(){
  if(this.ctx && this.unlocked) return;
  this._initAndUnlock();
};
SoundManager.prototype.unlock = function(){
  if(this.unlocked) return;
  this._ensureCtx();
};
SoundManager.prototype._tone = function(freq, duration, type, volume){
  if(!this.enabled) return;
  this._ensureCtx();
  if(!this.ctx) return;
  try{
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume || 0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch(e){}
};
SoundManager.prototype.click = function(){ if(!this.enabled) return; this._tone(880, 0.06, 'square', 0.04); };
SoundManager.prototype.hover = function(){ if(!this.enabled) return; this._tone(1320, 0.04, 'sine', 0.02); };
SoundManager.prototype.toggle = function(){
  if(!this.enabled) return;
  this._tone(660, 0.08, 'triangle', 0.05);
  setTimeout(function(){ this._tone(990, 0.06, 'triangle', 0.04); }.bind(this), 40);
};
SoundManager.prototype.open = function(){
  if(!this.enabled) return;
  this._tone(523, 0.08, 'sine', 0.05);
  setTimeout(function(){ this._tone(784, 0.10, 'sine', 0.05); }.bind(this), 60);
};
SoundManager.prototype.close = function(){
  if(!this.enabled) return;
  this._tone(784, 0.08, 'sine', 0.05);
  setTimeout(function(){ this._tone(523, 0.10, 'sine', 0.05); }.bind(this), 60);
};
SoundManager.prototype.launch = function(){
  if(!this.enabled) return;
  var notes = [523, 659, 784, 1046];
  for(var i = 0; i < notes.length; i++){
    (function(freq, delay){
      setTimeout(function(){ this._tone(freq, 0.12, 'triangle', 0.05); }.bind(this), delay);
    }.bind(this))(notes[i], i * 70);
  }
};
SoundManager.prototype.error = function(){ if(!this.enabled) return; this._tone(220, 0.18, 'sawtooth', 0.06); };
SoundManager.prototype.setEnabled = function(on){ this.enabled = !!on; };

/* ========== Rendering ========== */
function escapeHtml(str){
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

var BADGE_MAP = {
  'recommended': { cls: 'badge-recommended', text: '推荐' },
  'beta': { cls: 'badge-beta', text: '测试版' },
  'legacy': { cls: 'badge-legacy', text: '经典版' },
  'new-beta': { cls: 'badge-new', text: '新版测试' }
};

/* ============================================================
   ===== 详情高亮渲染函数 =====
   ============================================================ */
function renderHighlightedDetail(detailText) {
  if (!detailText) return '';
  
  var lines = detailText.split('\n');
  var result = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    
    var escaped = escapeHtml(line);
    var rendered = escaped;
    
    // ---- 1. 联机状态：✓ 绿色粗体，✗ 灰色 ----
    rendered = rendered.replace(/✓/g, '<span class="detail-icon detail-icon-ok">✓</span>');
    rendered = rendered.replace(/✗/g, '<span class="detail-icon detail-icon-fail">✗</span>');
    
    // ---- 2. 性能等级高亮 ----
    // 性能：高 → 绿色
    rendered = rendered.replace(/(性能：)(高)/g, '$1<span class="detail-perf detail-perf-high">$2</span>');
    // 性能：极高 → 绿色+粗体
    rendered = rendered.replace(/(性能：)(极高)/g, '$1<span class="detail-perf detail-perf-extreme">$2</span>');
    // 性能：中 → 橙色
    rendered = rendered.replace(/(性能：)(中)/g, '$1<span class="detail-perf detail-perf-medium">$2</span>');
    // 性能：较低 → 红色
    rendered = rendered.replace(/(性能：)(较低)/g, '$1<span class="detail-perf detail-perf-low">$2</span>');
    // 性能：低 → 红色
    rendered = rendered.replace(/(性能：)(低)/g, '$1<span class="detail-perf detail-perf-low">$2</span>');
    // 性能：极低 → 红色+粗体
    rendered = rendered.replace(/(性能：)(极低)/g, '$1<span class="detail-perf detail-perf-verylow">$2</span>');
    
    // ---- 3. 语言支持 ----
    // 简体中文 → 绿色高亮
    rendered = rendered.replace(/(语言：)(简体中文、英文)/g, '$1<span class="detail-lang detail-lang-zh">$2</span>');
    rendered = rendered.replace(/(语言：)(简体中文)/g, '$1<span class="detail-lang detail-lang-zh">$2</span>');
    // 仅英文原版 → 灰色
    rendered = rendered.replace(/(语言：)(仅英文原版)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
    rendered = rendered.replace(/(语言：)(仅英文)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
    // English → 普通
    rendered = rendered.replace(/(语言：)(English)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
    
    // ---- 4. 设备支持 ----
    // 触屏支持 → 蓝色高亮
    rendered = rendered.replace(/(设备：)(.*?)(触屏支持)(.*)/g, '$1$2<span class="detail-device detail-device-touch">触屏支持</span>$4');
    rendered = rendered.replace(/(设备：)(.*?)(触屏操作)(.*)/g, '$1$2<span class="detail-device detail-device-touch">触屏操作</span>$4');
    // 仅支持电脑键鼠操作 → 灰色
    rendered = rendered.replace(/(设备：)(仅支持电脑键鼠操作)/g, '$1<span class="detail-device detail-device-pc">$2</span>');
    // 电脑键鼠操作 → 普通高亮
    rendered = rendered.replace(/(设备：)(电脑键鼠操作)/g, '$1<span class="detail-device detail-device-pc">$2</span>');
    
    // ---- 5. 联机标签 ----
    // 单机 ✓ → 绿色
    rendered = rendered.replace(/(单机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-ok">✓</span>');
    rendered = rendered.replace(/(单机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-fail">✗</span>');
    // 局域网 ✓ → 蓝色
    rendered = rendered.replace(/(局域网)(\s*)(✓)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-ok">✓</span>');
    rendered = rendered.replace(/(局域网)(\s*)(✗)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-fail">✗</span>');
    // 远程联机 ✓ → 紫色
    rendered = rendered.replace(/(远程联机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-ok">✓</span>');
    rendered = rendered.replace(/(远程联机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-fail">✗</span>');
    
    // ---- 6. 资源标签 ----
    // 自定义材质包 → 紫色
    rendered = rendered.replace(/自定义材质包/g, '<span class="detail-resource detail-resource-texture">自定义材质包</span>');
    // 内置光影包 → 蓝色
    rendered = rendered.replace(/内置光影包/g, '<span class="detail-resource detail-resource-shader">内置光影包</span>');
    // 内置模组包 → 紫色
    rendered = rendered.replace(/内置模组包/g, '<span class="detail-resource detail-resource-mod">内置模组包</span>');
    // 光影渲染 → 蓝色
    rendered = rendered.replace(/光影渲染/g, '<span class="detail-resource detail-resource-shader">光影渲染</span>');
    // 高帧率 → 绿色
    rendered = rendered.replace(/高帧率/g, '<span class="detail-resource detail-resource-fps">高帧率</span>');
    
    // ---- 7. 警告信息 ----
    // ⚠️ 开头或含"警告"的行 → 红色大字号
    if (rendered.indexOf('⚠️') !== -1 || rendered.indexOf('警告') !== -1) {
      rendered = '<span class="detail-warning">' + rendered + '</span>';
    }
    // 巨卡慎选 → 红色大字号
    if (rendered.indexOf('巨卡慎选') !== -1) {
      rendered = '<span class="detail-warning">' + rendered + '</span>';
    }
    
    // ---- 8. 测试版/新版标签 ----
    if (rendered.indexOf('测试版') !== -1 && rendered.indexOf('|') !== -1) {
      rendered = rendered.replace(/测试版/g, '<span class="detail-badge-beta">测试版</span>');
    }
    if (rendered.indexOf('模组整合包') !== -1 && rendered.indexOf('|') !== -1) {
      rendered = rendered.replace(/模组整合包/g, '<span class="detail-badge-modpack">模组整合包</span>');
    }
    if (rendered.indexOf('经典版') !== -1) {
      rendered = rendered.replace(/经典版/g, '<span class="detail-badge-legacy">经典版</span>');
    }
    
    // ---- 9. 新版测试标签 ----
    if (rendered.indexOf('新版测试') !== -1) {
      rendered = rendered.replace(/新版测试/g, '<span class="detail-badge-new">新版测试</span>');
    }
    
    // ---- 10. 语言标签辅助 ----
    // 修复联机行中残留的纯文本
    // 已经处理过的就不再重复
    
    result.push('<div class="detail-line">' + rendered + '</div>');
  }
  
  return result.join('');
}

/* ============================================================ */

function renderCard(ver){
  var badge = BADGE_MAP[ver.type] || BADGE_MAP.legacy;
  var extra = ver.recommendTag ? (' <span class="card-recommend-tag">' + escapeHtml(ver.recommendTag) + '</span>') : '';
  
  // 使用高亮渲染详情
  var detailHtml = renderHighlightedDetail(ver.detail);

  return '<div class="version-card" data-type="' + ver.type + '" data-id="' + ver.id + '" data-engine="' + ver.engine + '">' +
    '<div class="card-badges">' +
      '<span class="card-badge ' + badge.cls + '">' + badge.text + '</span>' + extra +
    '</div>' +
    '<div class="card-title">' + escapeHtml(ver.name) + '</div>' +
    '<div class="card-meta">' + escapeHtml(ver.version) + '</div>' +
    '<div class="card-meta card-author">原作者: ' + escapeHtml(ver.author) + '</div>' +
    '<div class="card-detail">' + detailHtml + '</div>' +
    '<div class="card-footer">' +
      '<span class="card-size">' + ver.size + '</span>' +
      '<button class="card-launch-btn" data-id="' + ver.id + '" aria-label="启动 ' + escapeHtml(ver.name) + '">开始游戏</button>' +
    '</div>' +
  '</div>';
}

function matchSearch(ver, q){
  if(!q) return true;
  if(ver.name.toLowerCase().indexOf(q) !== -1) return true;
  if(ver.version.toLowerCase().indexOf(q) !== -1) return true;
  if(ver.author && ver.author.toLowerCase().indexOf(q) !== -1) return true;
  if(ver.engine && ver.engine.toLowerCase().indexOf(q) !== -1) return true;
  return false;
}

var GROUPS = [
  {
    id: 'mcjs',
    title: 'MCJS 优化 Eaglercraft 客户端（推荐）',
    desc: 'MCJS 专为简体中文用户优化的 Eaglercraft 中文版。1.8.8 已支持远程联机，全版本均已支持中文语言。',
    typeMatch: function(ver){ return ver.type === 'recommended'; }
  },
  {
    id: 'modpack',
    title: '模组整合包 Eaglercraft 客户端',
    desc: '1.6.4 Forge 版本，内置近百种热门模组，超越原版体验。模组整合包对设备性能要求较高，仅 WASM 版本可用。注意：这些版本仅支持英文，切换语言会导致游戏崩溃。',
    typeMatch: function(ver){ return ver.modpack === true; }
  },
  {
    id: 'newbeta',
    title: '最新测试版 Eaglercraft 客户端',
    desc: '提前体验最新版本。测试版稳定性不足，仅用于体验。高版本对设备性能要求较高，仅 WASM 版本可用。注意：这些版本仅支持英文。',
    typeMatch: function(ver){ return !ver.modpack && (ver.type === 'beta' || ver.type === 'new-beta'); }
  },
  {
    id: 'legacy',
    title: '旧版 Eaglercraft 客户端',
    desc: '早期版本原版搬运，仅提供英文版本，仅供怀旧体验。',
    typeMatch: function(ver){ return ver.type === 'legacy'; }
  }
];

function renderGrid(){
  var q = searchQuery.toLowerCase();
  var html = '';
  var totalShown = 0;

  GROUPS.forEach(function(group){
    var matched = VERSIONS.filter(function(ver){
      if(!group.typeMatch(ver)) return false;
      return matchSearch(ver, q);
    });
    if(matched.length === 0) return;
    totalShown += matched.length;
    html += '<section class="version-group" data-group="' + group.id + '">' +
      '<header class="group-header">' +
        '<h3 class="group-title">' + escapeHtml(group.title) + '</h3>' +
        '<p class="group-desc">' + escapeHtml(group.desc) + '</p>' +
      '</header>' +
      '<div class="version-grid">' + matched.map(renderCard).join('') + '</div>' +
    '</section>';
  });

  if(totalShown === 0){
    html = '<div class="empty-state"><p>没有找到匹配的版本</p><p style="font-size:0.78rem;margin-top:6px;opacity:0.7;">请尝试其他搜索关键词</p></div>';
  }
  grid.innerHTML = html;
}

/* ========== Search ========== */
searchInput.addEventListener('input', function(){
  if(searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(function(){
    searchQuery = searchInput.value.trim();
    renderGrid();
  }, 180);
});
searchInput.addEventListener('keydown', function(e){ e.stopPropagation(); });
searchInput.addEventListener('keyup', function(e){ e.stopPropagation(); });
searchInput.addEventListener('keypress', function(e){ e.stopPropagation(); });

/* ========== WASM 检测 ========== */
function checkWasmSupport() {
  if (window.MCJS_GAME && window.MCJS_GAME.detectWasmSupport) {
    return window.MCJS_GAME.detectWasmSupport();
  }
  try {
    if (typeof WebAssembly === 'undefined') {
      return { supported: false, reason: 'WebAssembly not defined' };
    }
    var code = new Uint8Array([0,97,115,109,1,0,0,0]);
    var module = new WebAssembly.Module(code);
    if (!(module instanceof WebAssembly.Module)) {
      return { supported: false, reason: 'Module creation failed' };
    }
    return { supported: true, gc: false, sab: typeof SharedArrayBuffer !== 'undefined' };
  } catch(e) {
    return { supported: false, reason: e.message };
  }
}

/* ========== Launch System ========== */
grid.addEventListener('click', function(e){
  var btn = e.target.closest('.card-launch-btn');
  var card = e.target.closest('.version-card');
  var target = btn || card;
  if(!target) return;
  var id = btn ? btn.getAttribute('data-id') : target.getAttribute('data-id');
  if(id){
    if(sound) sound.click();
    launchVersion(id);
  }
});

function launchVersion(id){
  var ver = VERSIONS.find(function(v){ return v.id === id; });
  if(!ver) return;
  currentVersion = ver;
  if (settings.quickLaunch === true) {
    startGameLaunch(ver);
    return;
  }
  gameTitle.textContent = ver.name;
  launchModal.classList.add('active');
  if(sound) sound.open();
  launchText.textContent = '正在准备启动…';
  launchDetail.textContent = '选择镜像或直接启动';
  launchProgress.style.width = '0%';
  renderMirrorSelection(ver);
}

function renderMirrorSelection(ver){
  var container = document.getElementById('mirrorList');
  var html = '<div class="auto-launch-btn" id="autoLaunchBtn" role="button" tabindex="0">' +
    '<span class="auto-launch-icon">▶</span>' +
    '<div><div class="auto-launch-name">自动选择（推荐镜像）</div>' +
    '<div class="auto-launch-desc">使用默认镜像直接启动</div></div>' +
  '</div>';
  html += ver.mirrors.map(function(m, i){
    return '<div class="mirror-item" data-mirror="' + i + '" role="button" tabindex="0">' +
      '<div class="mirror-item-name">' + escapeHtml(m.name) + '</div>' +
      '<div class="mirror-item-url">' + escapeHtml(m.url) + '</div>' +
    '</div>';
  }).join('');
  container.innerHTML = html;
  document.getElementById('autoLaunchBtn').addEventListener('click', function(){
    if(sound) sound.click();
    startGameLaunch(ver);
  });
  document.getElementById('autoLaunchBtn').addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); startGameLaunch(ver); }
  });
  document.getElementById('modalClose').addEventListener('click', function(){
  if(sound) sound.close();
  launchModal.classList.remove('active');
});

launchModal.addEventListener('click', function(e){
  if(e.target === launchModal){
    if(sound) sound.close();
    launchModal.classList.remove('active');
  }
});
  container.querySelectorAll('.mirror-item').forEach(function(el){
    el.addEventListener('click', function(){
      if(sound) sound.click();
      var idx = parseInt(el.getAttribute('data-mirror'));
      settings.mirrorIndex = idx;
      window.MCJS_SETTINGS = settings;
      window.MCJS_SAVE_SETTINGS(settings);
      startGameLaunch(ver);
    });
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        var idx = parseInt(el.getAttribute('data-mirror'));
        settings.mirrorIndex = idx;
        window.MCJS_SETTINGS = settings;
        window.MCJS_SAVE_SETTINGS(settings);
        startGameLaunch(ver);
      }
    });
  });
}

function startGameLaunch(ver){
  if (isLaunching) return;
  isLaunching = true;
  
  gameTitle.textContent = ver.name;
  
  if(sound) sound.launch();
  launchModal.classList.remove('active');
  gameOverlay.classList.add('active');
  if(launchContent) {
    launchContent.style.display = 'flex';
    var oldRetry = launchContent.querySelector('.launch-retry-btn');
    if(oldRetry) oldRetry.remove();
    var cancelBtn = document.getElementById('launchCancelBtn');
    if(cancelBtn) cancelBtn.style.display = 'inline-block';
  }
  if(gameToolbar) gameToolbar.style.display = 'none';
  launchText.textContent = '正在优化内存…';
  launchDetail.textContent = '请稍候…';
  launchProgress.style.width = '0%';
  window.MCJS_UPDATE_LAUNCH = function(text, pct){
    try{
      launchText.textContent = text;
      launchProgress.style.width = Math.min(pct, 100) + '%';
    } catch(e){}
  };
  window.MCJS_GAME.launch(ver,
    function(text, pct){
      try{
        launchText.textContent = text;
        launchProgress.style.width = Math.min(pct, 100) + '%';
      } catch(e){}
    },
    function(){
      isLaunching = false;
      setTimeout(function(){
        if(launchContent) launchContent.style.display = 'none';
        if(gameToolbar) gameToolbar.style.display = 'flex';
      }, 400);
    },
    function(err){
      isLaunching = false;
      if(sound) sound.error();
      try{
        launchText.textContent = '启动失败';
        launchDetail.textContent = err || '请检查网络连接后重试';
        launchProgress.style.width = '0%';
        var cancelBtn = document.getElementById('launchCancelBtn');
        if(cancelBtn) cancelBtn.style.display = 'none';
        var oldRetry = launchContent.querySelector('.launch-retry-btn');
        if(oldRetry) oldRetry.remove();
        var retryBtn = document.createElement('button');
        retryBtn.className = 'launch-cancel-btn launch-retry-btn';
        retryBtn.textContent = '重试';
        retryBtn.style.marginTop = '12px';
        retryBtn.onclick = function(){
          retryBtn.remove();
          var cancelBtn2 = document.getElementById('launchCancelBtn');
          if(cancelBtn2) cancelBtn2.style.display = 'inline-block';
          startGameLaunch(ver);
        };
        launchContent.appendChild(retryBtn);
      } catch(e){}
    }
  );
}

function cancelCurrentLaunch(){
  console.log('[MCJS] Cancelling launch...');
  if (window.MCJS_GAME && window.MCJS_GAME.cancel) {
    window.MCJS_GAME.cancel();
  }
  isLaunching = false;
  gameOverlay.classList.remove('active');
  if(launchContent) {
    launchContent.style.display = 'flex';
    var dynamicBtns = launchContent.querySelectorAll('.launch-retry-btn');
    dynamicBtns.forEach(function(btn){ btn.remove(); });
    var cancelBtn = document.getElementById('launchCancelBtn');
    if(cancelBtn) cancelBtn.style.display = 'inline-block';
  }
  if(gameToolbar) gameToolbar.style.display = 'none';
  launchText.textContent = '已取消';
  launchDetail.textContent = '点击"开始游戏"重新启动';
  launchProgress.style.width = '0%';
  launchModal.classList.remove('active');
  if(sound) sound.close();
}

document.getElementById('gameCloseBtn').addEventListener('click', function(){
  if(sound) sound.close();
  if (window.MCJS_GAME) window.MCJS_GAME.close();
  gameOverlay.classList.remove('active');
  if(launchContent) {
    launchContent.style.display = 'flex';
    var dynamicBtns = launchContent.querySelectorAll('.launch-retry-btn');
    dynamicBtns.forEach(function(btn){ btn.remove(); });
    var cancelBtn = document.getElementById('launchCancelBtn');
    if(cancelBtn) cancelBtn.style.display = 'inline-block';
    launchText.textContent = '已关闭';
    launchDetail.textContent = '点击"开始游戏"重新启动';
    launchProgress.style.width = '0%';
  }
  if(gameToolbar) gameToolbar.style.display = 'none';
  isLaunching = false;
});

document.getElementById('gameFullscreenBtn').addEventListener('click', function(){
  if(sound) sound.click();
  var container = document.getElementById('gameContainer');
  if(!container) return;
  var req = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
  if(req) req.call(container).catch(function(e){ console.warn('[MCJS] Fullscreen failed:', e); });
});

document.getElementById('launchCancelBtn').addEventListener('click', function(){
  if(sound) sound.click();
  cancelCurrentLaunch();
});

document.getElementById('downloadCancelBtn').addEventListener('click', function(){
  if(sound) sound.click();
  cancelCurrentLaunch();
});

/* ============================================================
   ===== 设置窗口 =====
   ============================================================ */

var settingsBtn = document.getElementById('settingsBtn');

function buildSettingsHTML() {
  var s = window.MCJS_SETTINGS || {};
  function toggleChecked(val) { return val !== false ? 'active' : ''; }
  function toggleAria(val) { return val !== false ? 'true' : 'false'; }

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>MCJS Launcher — 设置</title>\n' +
    '<style>\n' +
    ':root {\n' +
    '  --bg-page: #f0f2f5;\n' +
    '  --bg-card: rgba(255, 255, 255, 0.60);\n' +
    '  --bg-detail: rgba(0, 0, 0, 0.03);\n' +
    '  --border-base: rgba(255, 255, 255, 0.35);\n' +
    '  --border-soft: rgba(255, 255, 255, 0.20);\n' +
    '  --border-strong: rgba(255, 255, 255, 0.50);\n' +
    '  --text-primary: #1a1d26;\n' +
    '  --text-secondary: #4a4f5e;\n' +
    '  --text-muted: #7c818f;\n' +
    '  --text-faint: #a8adb8;\n' +
    '  --accent-green: #22c55e;\n' +
    '  --accent-green-bg: rgba(34, 197, 94, 0.10);\n' +
    '  --accent-green-strong: #16a34a;\n' +
    '  --accent-red: #ef4444;\n' +
    '  --accent-red-bg: rgba(239, 68, 68, 0.10);\n' +
    '  --accent-blue: #3b82f6;\n' +
    '  --radius: 12px;\n' +
    '  --radius-sm: 8px;\n' +
    '  --radius-xs: 6px;\n' +
    '  --font-base: 16px;\n' +
    '  --font-display: "Sora", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;\n' +
    '  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;\n' +
    '  --font-mono: "JetBrains Mono", "Fira Code", monospace;\n' +
    '  --transition: 0.2s ease;\n' +
    '  --shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02);\n' +
    '}\n' +
    '* { margin:0; padding:0; box-sizing:border-box; }\n' +
    'html { font-family: var(--font-body); font-size: var(--font-base); color: var(--text-primary); background: var(--bg-page); -webkit-font-smoothing: antialiased; line-height: 1.6; min-height: 100vh; }\n' +
    'body { min-height: 100vh; display:flex; align-items:center; justify-content:center; padding:20px; background: var(--bg-page); background-image: radial-gradient(ellipse at 20% 0%, rgba(34,197,94,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(139,92,246,0.04) 0%, transparent 50%); background-attachment: fixed; }\n' +
    '.settings-window { width:100%; max-width:540px; max-height:90vh; background: rgba(255,255,255,0.55); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); border-radius: var(--radius); border: 1px solid var(--border-base); box-shadow: 0 25px 70px rgba(0,0,0,0.10); display:flex; flex-direction:column; overflow:hidden; }\n' +
    '.settings-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--border-base); flex-shrink:0; }\n' +
    '.settings-header h2 { font-family:var(--font-display); font-size:1.15rem; font-weight:700; color:var(--text-primary); }\n' +
    '.settings-close { background:transparent; border:none; font-size:1.6rem; color:var(--text-muted); cursor:pointer; width:32px; height:32px; border-radius:6px; transition:var(--transition); line-height:1; }\n' +
    '.settings-close:hover { background:var(--bg-detail); color:var(--text-primary); }\n' +
    '.settings-body { flex:1; overflow-y:auto; padding:18px 24px 24px; }\n' +
    '.settings-group { margin-bottom:22px; }\n' +
    '.settings-group-title { font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--accent-green); margin-bottom:8px; padding-left:2px; }\n' +
    '.setting-item { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-top:1px solid var(--border-soft); gap:12px; }\n' +
    '.setting-item:first-child { border-top:none; }\n' +
    '.setting-label span { font-size:0.92rem; font-weight:500; color:var(--text-primary); display:block; }\n' +
    '.setting-label small { font-size:0.75rem; color:var(--text-muted); display:block; margin-top:1px; }\n' +
    '.setting-control { flex-shrink:0; }\n' +
    '.setting-select { padding:5px 10px; background:var(--bg-detail); border:1px solid var(--border-base); border-radius:6px; color:var(--text-primary); font-family:inherit; font-size:0.85rem; cursor:pointer; outline:none; }\n' +
    '.setting-select:focus { border-color:var(--accent-green); }\n' +
    '.setting-slider { display:flex; align-items:center; gap:10px; }\n' +
    '.setting-slider input[type="range"] { width:110px; accent-color:var(--accent-green); cursor:pointer; }\n' +
    '.slider-value { font-size:0.78rem; color:var(--text-secondary); font-family:var(--font-mono); min-width:56px; text-align:right; }\n' +
    '.toggle { position:relative; display:inline-block; width:38px; height:22px; background:var(--border-strong); border:none; border-radius:999px; cursor:pointer; transition:var(--transition); flex-shrink:0; padding:0; }\n' +
    '.toggle::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; background:#fff; border-radius:50%; transition:var(--transition); box-shadow:0 1px 3px rgba(0,0,0,0.15); }\n' +
    '.toggle.active { background:var(--accent-green); }\n' +
    '.toggle.active::after { left:18px; }\n' +
    '.settings-actions { display:flex; gap:10px; padding-top:16px; border-top:1px solid var(--border-soft); margin-top:4px; }\n' +
    '.settings-actions .btn { flex:1; padding:10px 0; border-radius:8px; border:none; font-family:inherit; font-size:0.9rem; font-weight:600; cursor:pointer; transition:var(--transition); }\n' +
    '.btn-primary { background:var(--accent-green); color:#fff; }\n' +
    '.btn-primary:hover { background:var(--accent-green-strong); }\n' +
    '.btn-secondary { background:var(--bg-detail); color:var(--text-primary); border:1px solid var(--border-soft); }\n' +
    '.btn-secondary:hover { background:rgba(0,0,0,0.06); }\n' +
    '.cache-info { margin-top:10px; padding:10px 14px; background:var(--bg-detail); border-radius:var(--radius-sm); font-size:0.82rem; }\n' +
    '.cache-info-row { display:flex; justify-content:space-between; padding:2px 0; color:var(--text-secondary); }\n' +
    '.cache-info-row strong { color:var(--text-primary); font-weight:600; font-family:var(--font-mono); }\n' +
    '.action-btn { display:block; width:100%; padding:8px 0; margin-top:6px; background:var(--bg-detail); color:var(--text-primary); border:1px solid var(--border-soft); border-radius:6px; cursor:pointer; font-family:inherit; font-size:0.82rem; font-weight:500; transition:var(--transition); }\n' +
    '.action-btn:hover { background:rgba(0,0,0,0.06); }\n' +
    '.action-btn.danger { color:var(--accent-red); }\n' +
    '.action-btn.danger:hover { background:var(--accent-red-bg); border-color:rgba(239,68,68,0.3); }\n' +
    '.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--accent-green); color:#fff; padding:10px 24px; border-radius:8px; font-weight:500; font-size:0.9rem; box-shadow:0 4px 16px rgba(34,197,94,0.30); opacity:0; transition:opacity 0.3s; pointer-events:none; z-index:999; }\n' +
    '.toast.show { opacity:1; }\n' +
    '.toast.error { background:var(--accent-red); box-shadow:0 4px 16px rgba(239,68,68,0.30); }\n' +
    '@media (max-width:480px) { .settings-window { max-height:100vh; border-radius:0; max-width:100%; } .settings-body { padding:14px 16px 20px; } .settings-header { padding:14px 16px; } }\n' +
    '</style>\n' +
    '</head>\n<body>\n' +
    '<div class="settings-window">\n' +
    '  <div class="settings-header">\n' +
    '    <h2>启动器设置</h2>\n' +
    '    <button class="settings-close" id="settingsCloseBtn" title="关闭">&times;</button>\n' +
    '  </div>\n' +
    '  <div class="settings-body" id="settingsBody">\n' +

    '    <div class="settings-group">\n' +
    '      <div class="settings-group-title">启动</div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>默认镜像</span><small>选择首选的游戏文件源</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <select class="setting-select" id="settingMirror">\n' +
    '            <option value="0"' + (s.mirrorIndex === 0 ? ' selected' : '') + '>主站 (pages.dev)</option>\n' +
    '            <option value="1"' + (s.mirrorIndex === 1 ? ' selected' : '') + '>镜像 1 (144449.xyz)</option>\n' +
    '            <option value="2"' + (s.mirrorIndex === 2 ? ' selected' : '') + '>镜像 2 (IPv6)</option>\n' +
    '            <option value="3"' + (s.mirrorIndex === 3 ? ' selected' : '') + '>镜像 3 (mirror)</option>\n' +
    '            <option value="4"' + (s.mirrorIndex === 4 ? ' selected' : '') + '>镜像 4 (mirror-test)</option>\n' +
    '            <option value="5"' + (s.mirrorIndex === 5 ? ' selected' : '') + '>镜像 5 (备用)</option>\n' +
    '          </select>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>全屏启动</span><small>启动游戏后自动进入全屏模式</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.fullscreenLaunch) + '" id="settingFullscreen" type="button" role="switch" aria-checked="' + toggleAria(s.fullscreenLaunch) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>快速启动</span><small>跳过镜像选择直接启动</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.quickLaunch) + '" id="settingQuickLaunch" type="button" role="switch" aria-checked="' + toggleAria(s.quickLaunch) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>加载详情</span><small>显示详细的加载步骤信息</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.loadingDetail) + '" id="settingLoadingDetail" type="button" role="switch" aria-checked="' + toggleAria(s.loadingDetail) + '"></button></div>\n' +
    '      </div>\n' +
    '    </div>\n' +

    '    <div class="settings-group">\n' +
    '      <div class="settings-group-title">性能</div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>内存分配上限</span><small>游戏可使用的最大内存</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <div class="setting-slider">\n' +
    '            <input type="range" id="settingMemory" min="256" max="4096" step="128" value="' + (s.memoryLimit || 512) + '" />\n' +
    '            <span class="slider-value" id="memoryValue">' + (s.memoryLimit || 512) + ' MB</span>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>启动前内存优化</span><small>启动游戏前自动清理内存</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.autoClean) + '" id="settingAutoClean" type="button"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>GPU 偏好</span><small>选择图形处理器模式</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <select class="setting-select" id="settingGPU">\n' +
    '            <option value="high-performance"' + (s.gpuPrefer === 'high-performance' ? ' selected' : '') + '>高性能独立显卡</option>\n' +
    '            <option value="default"' + (s.gpuPrefer === 'default' ? ' selected' : '') + '>默认</option>\n' +
    '            <option value="low-power"' + (s.gpuPrefer === 'low-power' ? ' selected' : '') + '>节能模式</option>\n' +
    '          </select>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +

    '    <div class="settings-group">\n' +
    '      <div class="settings-group-title">存储</div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>存档隔离</span><small>每个版本使用独立的存档空间</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.saveIsolation) + '" id="settingSaveIsolation" type="button" role="switch" aria-checked="' + toggleAria(s.saveIsolation) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>缓存上限</span><small>游戏文件本地缓存大小限制</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <div class="setting-slider">\n' +
    '            <input type="range" id="settingCacheLimit" min="512" max="8192" step="256" value="' + (s.cacheSizeLimit || 2048) + '" />\n' +
    '            <span class="slider-value" id="cacheValue">' + (s.cacheSizeLimit || 2048) + ' MB</span>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="cache-info" id="cacheInfo">\n' +
    '        <div class="cache-info-row"><span>已用缓存</span><strong id="cacheSizeText">读取中…</strong></div>\n' +
    '        <div class="cache-info-row"><span>缓存文件</span><strong id="cacheFileCount"></strong></div>\n' +
    '      </div>\n' +
    '      <button class="action-btn" id="clearCacheBtn">清除游戏缓存</button>\n' +
    '      <button class="action-btn danger" id="clearSaveBtn" style="margin-top:4px;">清除所有存档</button>\n' +
    '    </div>\n' +

    '    <div class="settings-group">\n' +
    '      <div class="settings-group-title">外观</div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>背景图片</span><small>显示 Minecraft 风景背景</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.bgImage) + '" id="settingBgImage" type="button" role="switch" aria-checked="' + toggleAria(s.bgImage) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>减少动态效果</span><small>关闭动画和过渡效果</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.reduceMotion) + '" id="settingReduceMotion" type="button" role="switch" aria-checked="' + toggleAria(s.reduceMotion) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>字体大小</span><small>调整界面文字大小</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <select class="setting-select" id="settingFontSize">\n' +
    '            <option value="small"' + (s.fontSize === 'small' ? ' selected' : '') + '>小</option>\n' +
    '            <option value="normal"' + (s.fontSize === 'normal' || !s.fontSize ? ' selected' : '') + '>正常</option>\n' +
    '            <option value="large"' + (s.fontSize === 'large' ? ' selected' : '') + '>大</option>\n' +
    '            <option value="xlarge"' + (s.fontSize === 'xlarge' ? ' selected' : '') + '>特大</option>\n' +
    '          </select>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>卡片密度</span><small>版本卡片的间距和大小</small></div>\n' +
    '        <div class="setting-control">\n' +
    '          <select class="setting-select" id="settingCardDensity">\n' +
    '            <option value="compact"' + (s.cardDensity === 'compact' ? ' selected' : '') + '>紧凑</option>\n' +
    '            <option value="comfortable"' + (s.cardDensity === 'comfortable' || !s.cardDensity ? ' selected' : '') + '>舒适</option>\n' +
    '            <option value="spacious"' + (s.cardDensity === 'spacious' ? ' selected' : '') + '>宽松</option>\n' +
    '          </select>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +

    '    <div class="settings-group">\n' +
    '      <div class="settings-group-title">音效与辅助</div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>音效</span><small>启动器界面音效</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.soundEnabled) + '" id="settingSound" type="button" role="switch" aria-checked="' + toggleAria(s.soundEnabled) + '"></button></div>\n' +
    '      </div>\n' +
    '      <div class="setting-item">\n' +
    '        <div class="setting-label"><span>自动检查更新</span><small>启动时检查启动器更新</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.autoUpdateCheck) + '" id="settingAutoUpdateCheck" type="button" role="switch" aria-checked="' + toggleAria(s.autoUpdateCheck) + '"></button></div>\n' +
    '      </div>\n' +
    '    </div>\n' +

    '    <div class="settings-actions">\n' +
    '      <button class="btn btn-secondary" id="settingsCancelBtn">取消</button>\n' +
    '      <button class="btn btn-primary" id="settingsSaveBtn">保存设置</button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div class="toast" id="toast"></div>\n' +

    '<script>\n' +
    '(function() {\n' +
    '  var settings = {};\n' +
    '  try { var stored = localStorage.getItem("mcjs_settings"); settings = stored ? JSON.parse(stored) : {}; } catch(e) {}\n' +
    '  var defaults = { mirrorIndex:0, memoryLimit:512, autoClean:true, saveIsolation:true, gpuPrefer:"high-performance", cacheSizeLimit:2048, bgImage:true, soundEnabled:true, fullscreenLaunch:false, fontSize:"normal", cardDensity:"comfortable", autoUpdateCheck:true, loadingDetail:true, quickLaunch:false, reduceMotion:false };\n' +
    '  Object.keys(defaults).forEach(function(k){ if(settings[k]===undefined) settings[k]=defaults[k]; });\n' +
    '  var dirty = false;\n' +
    '  var toastTimer = null;\n' +
    '  function showToast(msg, isError) { var el=document.getElementById("toast"); if(!el)return; el.textContent=msg; el.className="toast show"+(isError?" error":""); if(toastTimer)clearTimeout(toastTimer); toastTimer=setTimeout(function(){ el.className="toast"; }, 2500); }\n' +
    '  function getToggle(el){ return el && el.classList.contains("active"); }\n' +
    '  function setToggle(el, on){ if(!el)return; if(on) el.classList.add("active"); else el.classList.remove("active"); el.setAttribute("aria-checked", on?"true":"false"); }\n' +
    '  function bindToggle(id, key){ var el=document.getElementById(id); if(!el)return; setToggle(el, settings[key]!==false); el.addEventListener("click", function(){ var next=!getToggle(el); setToggle(el, next); settings[key]=next; dirty=true; }); }\n' +
    '  function bindSelect(id, key){ var el=document.getElementById(id); if(!el)return; el.addEventListener("change", function(){ settings[key]=el.value; dirty=true; }); }\n' +
    '  function bindSlider(id, valueId, key, unit){ var el=document.getElementById(id); var valEl=document.getElementById(valueId); if(!el||!valEl)return; el.addEventListener("input", function(){ var v=parseInt(el.value); valEl.textContent=v+" "+unit; settings[key]=v; dirty=true; }); }\n' +
    '  bindToggle("settingFullscreen", "fullscreenLaunch");\n' +
    '  bindToggle("settingQuickLaunch", "quickLaunch");\n' +
    '  bindToggle("settingLoadingDetail", "loadingDetail");\n' +
    '  bindToggle("settingAutoClean", "autoClean");\n' +
    '  bindToggle("settingSaveIsolation", "saveIsolation");\n' +
    '  bindToggle("settingBgImage", "bgImage");\n' +
    '  bindToggle("settingReduceMotion", "reduceMotion");\n' +
    '  bindToggle("settingSound", "soundEnabled");\n' +
    '  bindToggle("settingAutoUpdateCheck", "autoUpdateCheck");\n' +
    '  bindSelect("settingMirror", "mirrorIndex");\n' +
    '  bindSelect("settingGPU", "gpuPrefer");\n' +
    '  bindSelect("settingFontSize", "fontSize");\n' +
    '  bindSelect("settingCardDensity", "cardDensity");\n' +
    '  bindSlider("settingMemory", "memoryValue", "memoryLimit", "MB");\n' +
    '  bindSlider("settingCacheLimit", "cacheValue", "cacheSizeLimit", "MB");\n' +
    '  \n' +
    '  function requestCacheInfo() {\n' +
    '    if (window.opener) {\n' +
    '      window.opener.postMessage({ type: "get-cache-info" }, "*");\n' +
    '    }\n' +
    '  }\n' +
    '  window.addEventListener("message", function(e) {\n' +
    '    if (e.data && e.data.type === "cache-info-response") {\n' +
    '      var sizeEl = document.getElementById("cacheSizeText");\n' +
    '      var countEl = document.getElementById("cacheFileCount");\n' +
    '      if (sizeEl) sizeEl.textContent = e.data.sizeText || "0 B";\n' +
    '      if (countEl) countEl.textContent = e.data.count + " 个文件";\n' +
    '    }\n' +
    '  });\n' +
    '  requestCacheInfo();\n' +
    '  setInterval(requestCacheInfo, 5000);\n' +
    '  \n' +
    '  function saveAndClose() {\n' +
    '    try {\n' +
    '      localStorage.setItem("mcjs_settings", JSON.stringify(settings));\n' +
    '      dirty = false;\n' +
    '      showToast("设置已保存");\n' +
    '      if (window.opener) {\n' +
    '        try { window.opener.postMessage({ type: "settings-updated", settings: settings }, "*"); } catch(e) {}\n' +
    '      }\n' +
    '      setTimeout(function() { window.close(); }, 500);\n' +
    '    } catch(e) {\n' +
    '      showToast("保存失败: " + e.message, true);\n' +
    '    }\n' +
    '  }\n' +
    '  document.getElementById("settingsSaveBtn").addEventListener("click", saveAndClose);\n' +
    '  document.getElementById("settingsCancelBtn").addEventListener("click", function(){\n' +
    '    if(dirty && !confirm("有未保存的更改，确定要关闭吗？")) return;\n' +
    '    window.close();\n' +
    '  });\n' +
    '  document.getElementById("settingsCloseBtn").addEventListener("click", function(){\n' +
    '    if(dirty && !confirm("有未保存的更改，确定要关闭吗？")) return;\n' +
    '    window.close();\n' +
    '  });\n' +
    '  window.addEventListener("keydown", function(e){\n' +
    '    if(e.key === "Escape"){\n' +
    '      if(dirty && !confirm("有未保存的更改，确定要关闭吗？")) return;\n' +
    '      window.close();\n' +
    '    }\n' +
    '    if((e.ctrlKey||e.metaKey) && e.key === "s"){\n' +
    '      e.preventDefault();\n' +
    '      saveAndClose();\n' +
    '    }\n' +
    '  });\n' +
    '  document.getElementById("clearCacheBtn").addEventListener("click", function(){\n' +
    '    if(confirm("确定要清除所有游戏缓存吗？")){\n' +
    '      showToast("缓存已清除");\n' +
    '      if(window.opener) window.opener.postMessage({ type: "clear-cache" }, "*");\n' +
    '    }\n' +
    '  });\n' +
    '  document.getElementById("clearSaveBtn").addEventListener("click", function(){\n' +
    '    if(confirm("确定要清除所有存档吗？此操作不可恢复！")){\n' +
    '      showToast("存档已清除");\n' +
    '      if(window.opener) window.opener.postMessage({ type: "clear-save" }, "*");\n' +
    '    }\n' +
    '  });\n' +
    '})();\n' +
    '<\/script>\n' +
    '</body>\n</html>';
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.closed) {
    settingsWindow.focus();
    return;
  }
  if (sound) sound.unlock();
  if (sound) sound.open();

  var html = buildSettingsHTML();
  var win = window.open('', '_blank', 'width=560,height=700,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
  if (!win) {
    alert('弹窗被拦截，请允许此站点弹出窗口。');
    return;
  }
  settingsWindow = win;
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch(e) {
    console.warn('[MCJS] Failed to write settings window:', e);
    alert('无法打开设置窗口，请检查浏览器设置。');
    settingsWindow = null;
  }
}

window.addEventListener('message', function(e) {
  if (!e.data) return;
  var data = e.data;
  if (data.type === 'settings-updated') {
    var newSettings = data.settings;
    if (newSettings) {
      window.MCJS_SETTINGS = newSettings;
      window.MCJS_SAVE_SETTINGS(newSettings);
      settings = newSettings;
      applyBackground();
      applyTheme();
      applyFontSize();
      applyCardDensity();
      if (sound) sound.setEnabled(settings.soundEnabled !== false);
      console.log('[MCJS] Settings updated from settings window');
    }
  }
  if (data.type === 'get-cache-info') {
    if (window.MCJS_GAME && window.MCJS_GAME.getCacheSize) {
      window.MCJS_GAME.getCacheSize().then(function(info) {
        var sizeText = window.MCJS_GAME.formatBytes(info.bytes);
        try {
          e.source.postMessage({
            type: 'cache-info-response',
            sizeText: sizeText,
            count: info.count
          }, '*');
        } catch(ex) {}
      }).catch(function() {
        try {
          e.source.postMessage({
            type: 'cache-info-response',
            sizeText: '无法读取',
            count: 0
          }, '*');
        } catch(ex) {}
      });
    }
  }
  if (data.type === 'clear-cache') {
    if (window.MCJS_GAME && window.MCJS_GAME.clearCache) {
      window.MCJS_GAME.clearCache().then(function() {
        console.log('[MCJS] Cache cleared from settings window');
      });
    }
  }
  if (data.type === 'clear-save') {
    if (window.MCJS_GAME && window.MCJS_GAME.clearSaveData) {
      window.MCJS_GAME.clearSaveData().then(function() {
        console.log('[MCJS] Save data cleared from settings window');
      });
    }
  }
});

settingsBtn.addEventListener('click', function(){
  openSettingsWindow();
});

document.addEventListener('keydown', function(e){
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if(e.key === ',' && (e.ctrlKey || e.metaKey)){
    e.preventDefault();
    openSettingsWindow();
  }
});

/* ========== 外观应用函数 ========== */
function applyBackground(){
  if(settings.bgImage === false){
    document.body.classList.add('no-bg');
  }else{
    document.body.classList.remove('no-bg');
  }
}
function applyTheme(){
  if(settings.reduceMotion){
    document.body.classList.add('no-anim');
  }else{
    document.body.classList.remove('no-anim');
  }
}
function applyFontSize(){
  var sizeMap = { 'small':'14px', 'normal':'16px', 'large':'18px', 'xlarge':'20px' };
  var px = sizeMap[settings.fontSize] || '16px';
  document.documentElement.style.fontSize = px;
}
function applyCardDensity(){
  document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  var d = settings.cardDensity || 'comfortable';
  if(d !== 'comfortable'){
    document.body.classList.add('density-' + d);
  }
  var gapMap = { 'compact':'8px', 'comfortable':'14px', 'spacious':'20px' };
  var padMap = { 'compact':'12px 14px 10px', 'comfortable':'18px 20px 14px', 'spacious':'24px 26px 18px' };
  var g = gapMap[d] || '14px';
  var p = padMap[d] || '18px 20px 14px';
  document.documentElement.style.setProperty('--card-gap', g);
  document.documentElement.style.setProperty('--card-padding', p);
}

/* ========== Launch Failed Dialog ========== */
var launchFailedModal = document.getElementById('launchFailedModal');
var launchFailedMsg = document.getElementById('launchFailedMsg');
var launchFailedUrl = document.getElementById('launchFailedUrl');
var launchFailedCopy = document.getElementById('launchFailedCopy');
var launchFailedOpen = document.getElementById('launchFailedOpen');
var launchFailedRetry = document.getElementById('launchFailedRetry');
var launchFailedClose = document.getElementById('launchFailedClose');
var launchFailedVersion = null;

window.addEventListener('mcjs:launch-failed', function(e){
  var detail = (e && e.detail) || {};
  launchFailedVersion = detail.version || null;
  if(launchFailedMsg) launchFailedMsg.textContent = detail.url ? ('无法从任何镜像加载游戏。可手动访问下方链接：') : '无法启动游戏。';
  if(launchFailedUrl) launchFailedUrl.value = detail.url || '';
  if(launchFailedModal){
    launchFailedModal.classList.add('active');
    gameOverlay.classList.remove('active');
    if(launchContent) launchContent.style.display = 'flex';
  }
  if(sound) sound.error();
});

if(launchFailedClose) launchFailedClose.addEventListener('click', function(){
  if(sound) sound.close();
  launchFailedModal.classList.remove('active');
});
if(launchFailedModal) launchFailedModal.addEventListener('click', function(e){
  if(e.target === launchFailedModal) launchFailedModal.classList.remove('active');
});
if(launchFailedCopy) launchFailedCopy.addEventListener('click', function(){
  if(!launchFailedUrl) return;
  launchFailedUrl.select();
  try{
    var ok = document.execCommand('copy');
    if(ok){
      launchFailedCopy.textContent = '已复制';
      if(sound) sound.toggle();
      setTimeout(function(){ launchFailedCopy.textContent = '复制链接'; }, 1500);
    }
  } catch(e){
    if(navigator.clipboard){
      navigator.clipboard.writeText(launchFailedUrl.value).then(function(){
        launchFailedCopy.textContent = '已复制';
        setTimeout(function(){ launchFailedCopy.textContent = '复制链接'; }, 1500);
      }).catch(function(){});
    }
  }
});
if(launchFailedOpen) launchFailedOpen.addEventListener('click', function(){
  if(launchFailedUrl && launchFailedUrl.value){
    if(sound) sound.click();
    window.open(launchFailedUrl.value, '_blank', 'noopener');
  }
});
if(launchFailedRetry) launchFailedRetry.addEventListener('click', function(){
  if(sound) sound.click();
  launchFailedModal.classList.remove('active');
  if(launchFailedVersion) launchVersion(launchFailedVersion.id);
});

function showWasmWarning(msg){
  var el = document.getElementById('wasmWarning');
  var text = document.getElementById('wasmWarningText');
  if(!el || !text) return;
  text.textContent = msg || '已自动回退到兼容版本。';
  el.style.display = 'flex';
}
function hideWasmWarning(){
  var el = document.getElementById('wasmWarning');
  if(el) el.style.display = 'none';
}
document.getElementById('wasmWarningClose') && document.getElementById('wasmWarningClose').addEventListener('click', function(){
  hideWasmWarning();
});

function attachHoverSound(root){
  var nodes = root.querySelectorAll('button, .card-launch-btn, .filter-tab, .mirror-item, .auto-launch-btn, .toolbar-btn');
  nodes.forEach(function(n){
    if(n._mcjsHoverBound) return;
    n._mcjsHoverBound = true;
    n.addEventListener('mouseenter', function(){
      if(sound) sound.hover();
    });
  });
}

/* ========== OS Gate ========== */
(function osGate(){
  var SUPPORTED_RE = /Windows NT|Mac OS X|Macintosh|iPhone|iPad|iPod|Android/i;
  var NAME_MAP = [
    { re: /Windows NT 10\.0/, name: 'Windows 10/11' },
    { re: /Windows NT 6\.3/, name: 'Windows 8.1' },
    { re: /Windows NT 6\.2/, name: 'Windows 8' },
    { re: /Windows NT 6\.1/, name: 'Windows 7' },
    { re: /Windows NT/, name: 'Windows' },
    { re: /iPhone|iPad|iPod/, name: 'iOS' },
    { re: /Android/, name: 'Android' },
    { re: /Mac OS X|Macintosh/, name: 'macOS' }
  ];
  function detectOS(ua){
    for(var i = 0; i < NAME_MAP.length; i++){
      if(NAME_MAP[i].re.test(ua)) return NAME_MAP[i].name;
    }
    if(/Linux/i.test(ua)) return 'Linux';
    if(/CrOS/.test(ua)) return 'Chrome OS';
    if(/BSD/.test(ua)) return 'BSD';
    if(/X11/.test(ua)) return 'Unix-like';
    return '未知系统';
  }
  var ua = navigator.userAgent || '';
  var osName = detectOS(ua);
  var supported = SUPPORTED_RE.test(ua);

  var ackKey = 'mcjs_os_gate_ack';
  try{ var ack = localStorage.getItem(ackKey); if(ack === '1' || ack === 'skipped'){ return; } } catch(e){}

  if(supported) return;

  var gate = document.getElementById('osGate');
  if(!gate) return;
  var osEL = document.getElementById('osGateOs');
  if(osEL) osEL.textContent = '检测到您的操作系统：' + osName + '（User-Agent 提示）';

  gate.style.display = 'flex';
  gate.style.position = 'fixed';
  gate.style.inset = '0';
  gate.style.zIndex = '9999';
  gate.style.pointerEvents = 'auto';

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  function closeGate(remember){
    gate.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if(remember){
      try{ localStorage.setItem(ackKey, '1'); } catch(e){}
    }
  }
  var continueBtn = document.getElementById('osGateContinue');
  var leaveBtn = document.getElementById('osGateLeave');
  if(continueBtn){
    continueBtn.addEventListener('click', function(){ closeGate(true); });
  }
  if(leaveBtn){
    leaveBtn.addEventListener('click', function(){
      try{ window.close(); } catch(e){}
      setTimeout(function(){
        try{ window.location.replace('about:blank'); } catch(e){}
        document.body.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f0f2f5;color:#1a1d26;font-family:sans-serif;padding:24px;text-align:center;z-index:9999;">已放弃访问。请关闭此标签页。</div>';
      }, 50);
    });
  }
  document.addEventListener('keydown', function(e){
    if(gate.style.display === 'none') return;
    if(e.key === 'Escape'){
      if(leaveBtn) leaveBtn.click();
    }
  });
  window.MCJS_RESET_OS_GATE = function(){
    try{ localStorage.removeItem(ackKey); } catch(e){}
  };
})();

/* ========== 初始化 ========== */
(function init(){
  sound = new SoundManager();
  sound.setEnabled(settings.soundEnabled !== false);
  renderGrid();
  attachHoverSound(document);

  var wasmInfo = checkWasmSupport();
  if (!wasmInfo.supported) {
    console.warn('[MCJS] WebAssembly not supported - polyfill will be used');
    var warnEl = document.getElementById('wasmWarning');
    if (warnEl) {
      var textEl = document.getElementById('wasmWarningText');
      if (textEl) {
        textEl.textContent = '您的浏览器不支持 WebAssembly，启动游戏时将自动使用兼容模式（性能可能下降）';
      }
      warnEl.style.display = 'flex';
    }
  }

  if(settings.bgImage === false){ document.body.classList.add('no-bg'); }
  applyTheme();
  applyFontSize();
  applyCardDensity();
})();

var _origRenderGrid = renderGrid;
renderGrid = function(){
  _origRenderGrid();
  attachHoverSound(grid);
};

if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      console.log('[MCJS] Service Worker registered');
    }).catch(function(err){
      console.warn('[MCJS] SW registration failed:', err);
    });
  });
}

})();