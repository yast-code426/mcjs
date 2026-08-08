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
// 确保 settings 有完整的默认值
var DEFAULT_APP_SETTINGS = {
  mirrorIndex: 0,
  memoryLimit: 512,
  autoClean: true,
  saveIsolation: true,
  gpuPrefer: 'high-performance',
  cacheSizeLimit: 2048,
  bgImage: true,
  soundEnabled: true,
  fullscreenLaunch: false,
  fontSize: 'normal',
  cardDensity: 'comfortable',
  autoUpdateCheck: true,
  loadingDetail: true,
  quickLaunch: false,
  reduceMotion: false,
  popupLaunch: false
};

function ensureSettingsDefaults(s) {
  if (!s || typeof s !== 'object') s = {};
  for (var key in DEFAULT_APP_SETTINGS) {
    if (s[key] === undefined || s[key] === null) {
      s[key] = DEFAULT_APP_SETTINGS[key];
    }
  }
  return s;
}

var settings = ensureSettingsDefaults(window.MCJS_SETTINGS || {});
// 如果 window.MCJS_SETTINGS 存在但不完整，更新它
if (window.MCJS_SETTINGS) {
  window.MCJS_SETTINGS = settings;
}

var searchQuery = '';
var searchDebounceTimer = null;
var sound = null;
var currentVersion = null;
var isLaunching = false;
var settingsWindow = null;
var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var isPageRestored = false;
var settingsOpening = false;

/* ========== iOS 页面状态管理 ========== */
var STATE_KEY = 'mcjs_session_state';

function saveSessionState() {
  try {
    var state = {
      lastVersion: currentVersion ? currentVersion.id : null,
      timestamp: Date.now(),
      isGameRunning: gameOverlay.classList.contains('active'),
      versionName: currentVersion ? currentVersion.name : null
    };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch(e) {}
}

function loadSessionState() {
  try {
    var raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    var state = JSON.parse(raw);
    if (Date.now() - state.timestamp > 60000) {
      sessionStorage.removeItem(STATE_KEY);
      return null;
    }
    return state;
  } catch(e) { return null; }
}

function clearSessionState() {
  try { sessionStorage.removeItem(STATE_KEY); } catch(e) {}
}

function handlePageVisibility() {
  if (document.hidden) {
    saveSessionState();
  } else {
    var state = loadSessionState();
    if (state && state.isGameRunning && !gameOverlay.classList.contains('active')) {
      if (state.lastVersion) {
        var versions0 = getVersions();
        var ver = versions0 ? versions0.find(function(v) { return v.id === state.lastVersion; }) : null;
        if (ver) {
          showRestoreBanner(ver);
        }
      }
    }
  }
}

function showRestoreBanner(version) {
  var existing = document.querySelector('.ios-restore-banner');
  if (existing) {
    existing.classList.add('active');
    return;
  }
  var banner = document.createElement('div');
  banner.className = 'ios-restore-banner active';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = 
    '<span>检测到上次未关闭的游戏会话 (' + escapeHtml(version.name) + ')</span>' +
    '<div class="banner-actions">' +
      '<button class="banner-btn banner-btn-primary" data-action="restore">恢复游戏</button>' +
      '<button class="banner-btn banner-btn-secondary" data-action="dismiss">忽略</button>' +
    '</div>';
  document.body.appendChild(banner);
  
  banner.querySelector('[data-action="restore"]').addEventListener('click', function() {
    banner.classList.remove('active');
    setTimeout(function() { banner.remove(); }, 300);
    launchVersion(version.id);
    clearSessionState();
  });
  banner.querySelector('[data-action="dismiss"]').addEventListener('click', function() {
    banner.classList.remove('active');
    setTimeout(function() { banner.remove(); }, 300);
    clearSessionState();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========== 页面生命周期 ========== */
document.addEventListener('visibilitychange', handlePageVisibility);
window.addEventListener('pagehide', function() { saveSessionState(); });
window.addEventListener('beforeunload', function() { saveSessionState(); });
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    isPageRestored = true;
    var state = loadSessionState();
    if (state && state.isGameRunning) {
      if (state.lastVersion) {
        var versions1 = getVersions();
        var ver = versions1 ? versions1.find(function(v) { return v.id === state.lastVersion; }) : null;
        if (ver) {
          setTimeout(function() { showRestoreBanner(ver); }, 500);
        }
      }
    }
  }
});

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
function escapeHtml2(str){
  if(str === null || str === undefined) return '';
  if(typeof str !== 'string') str = String(str);
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

function renderHighlightedDetail(detailText) {
  if (detailText === null || detailText === undefined) return '';
  if (!detailText) return '';
  
  try {
    var lines = detailText.split('\n');
    var result = [];
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      
      var escaped = escapeHtml2(line);
      var rendered = escaped;
      
      try {
        rendered = rendered.replace(/✓/g, '<span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/✗/g, '<span class="detail-icon detail-icon-fail">✗</span>');
        
        rendered = rendered.replace(/(性能：)(高)/g, '$1<span class="detail-perf detail-perf-high">$2</span>');
        rendered = rendered.replace(/(性能：)(极高)/g, '$1<span class="detail-perf detail-perf-extreme">$2</span>');
        rendered = rendered.replace(/(性能：)(中)/g, '$1<span class="detail-perf detail-perf-medium">$2</span>');
        rendered = rendered.replace(/(性能：)(较低)/g, '$1<span class="detail-perf detail-perf-low">$2</span>');
        rendered = rendered.replace(/(性能：)(低)/g, '$1<span class="detail-perf detail-perf-low">$2</span>');
        rendered = rendered.replace(/(性能：)(极低)/g, '$1<span class="detail-perf detail-perf-verylow">$2</span>');
        
        rendered = rendered.replace(/(语言：)(简体中文、英文)/g, '$1<span class="detail-lang detail-lang-zh">$2</span>');
        rendered = rendered.replace(/(语言：)(简体中文)/g, '$1<span class="detail-lang detail-lang-zh">$2</span>');
        rendered = rendered.replace(/(语言：)(仅英文原版)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
        rendered = rendered.replace(/(语言：)(仅英文)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
        rendered = rendered.replace(/(语言：)(English)/g, '$1<span class="detail-lang detail-lang-en">$2</span>');
        
        rendered = rendered.replace(/(设备：)(.*?)(触屏支持)(.*)/g, '$1$2<span class="detail-device detail-device-touch">触屏支持</span>$4');
        rendered = rendered.replace(/(设备：)(.*?)(触屏操作)(.*)/g, '$1$2<span class="detail-device detail-device-touch">触屏操作</span>$4');
        rendered = rendered.replace(/(设备：)(仅支持电脑键鼠操作)/g, '$1<span class="detail-device detail-device-pc">$2</span>');
        rendered = rendered.replace(/(设备：)(电脑键鼠操作)/g, '$1<span class="detail-device detail-device-pc">$2</span>');
        
        rendered = rendered.replace(/(单机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(单机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-fail">✗</span>');
        rendered = rendered.replace(/(局域网)(\s*)(✓)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(局域网)(\s*)(✗)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-fail">✗</span>');
        rendered = rendered.replace(/(远程联机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(远程联机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-fail">✗</span>');
        
        rendered = rendered.replace(/自定义材质包/g, '<span class="detail-resource detail-resource-texture">自定义材质包</span>');
        rendered = rendered.replace(/内置光影包/g, '<span class="detail-resource detail-resource-shader">内置光影包</span>');
        rendered = rendered.replace(/内置模组包/g, '<span class="detail-resource detail-resource-mod">内置模组包</span>');
        rendered = rendered.replace(/光影渲染/g, '<span class="detail-resource detail-resource-shader">光影渲染</span>');
        rendered = rendered.replace(/高帧率/g, '<span class="detail-resource detail-resource-fps">高帧率</span>');
        
        if (rendered.indexOf('⚠️') !== -1 || rendered.indexOf('警告') !== -1) {
          rendered = '<span class="detail-warning">' + rendered + '</span>';
        }
        if (rendered.indexOf('巨卡慎选') !== -1) {
          rendered = '<span class="detail-warning">' + rendered + '</span>';
        }
        
        if (rendered.indexOf('测试版') !== -1 && rendered.indexOf('|') !== -1) {
          rendered = rendered.replace(/测试版/g, '<span class="detail-badge-beta">测试版</span>');
        }
        if (rendered.indexOf('模组整合包') !== -1 && rendered.indexOf('|') !== -1) {
          rendered = rendered.replace(/模组整合包/g, '<span class="detail-badge-modpack">模组整合包</span>');
        }
        if (rendered.indexOf('经典版') !== -1) {
          rendered = rendered.replace(/经典版/g, '<span class="detail-badge-legacy">经典版</span>');
        }
        if (rendered.indexOf('新版测试') !== -1) {
          rendered = rendered.replace(/新版测试/g, '<span class="detail-badge-new">新版测试</span>');
        }
      } catch(lineErr) {
        console.warn('[MCJS] Line render failed, using escaped text:', lineErr.message);
        rendered = escaped;
      }
      
      result.push('<div class="detail-line">' + rendered + '</div>');
    }
    
    return result.join('');
  } catch(e) {
    console.warn('[MCJS] renderHighlightedDetail failed:', e.message);
    return '<div class="detail-line">' + escapeHtml2(detailText) + '</div>';
  }
}

function renderCard(ver){
  var badge = BADGE_MAP[ver.type] || BADGE_MAP.legacy;
  var extra = ver.recommendTag ? (' <span class="card-recommend-tag">' + escapeHtml2(ver.recommendTag) + '</span>') : '';
  var detailHtml = renderHighlightedDetail(ver.detail);

  return '<div class="version-card" role="article" aria-label="' + escapeHtml2(ver.name) + ' 版本卡片" data-type="' + ver.type + '" data-id="' + ver.id + '" data-engine="' + ver.engine + '">' +
    '<div class="card-badges">' +
      '<span class="card-badge ' + badge.cls + '">' + badge.text + '</span>' + extra +
    '</div>' +
    '<div class="card-title">' + escapeHtml2(ver.name) + '</div>' +
    '<div class="card-meta">' + escapeHtml2(ver.version) + '</div>' +
    '<div class="card-meta card-author">原作者: ' + escapeHtml2(ver.author) + '</div>' +
    '<div class="card-detail">' + detailHtml + '</div>' +
    '<div class="card-footer">' +
      '<span class="card-size">' + ver.size + '</span>' +
      '<button class="card-launch-btn" data-id="' + ver.id + '" aria-label="启动 ' + escapeHtml2(ver.name) + '">开始游戏</button>' +
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

function getVersions(){
  if(typeof VERSIONS !== 'undefined' && Array.isArray(VERSIONS)) return VERSIONS;
  if(window.VERSIONS && Array.isArray(window.VERSIONS)) return window.VERSIONS;
  return null;
}

function renderGrid(){
  if(!grid){ grid = document.getElementById('versionSections'); }
  if(!grid){ console.error('[MCJS] renderGrid: no #versionSections'); return; }
  
  var versions = getVersions();
  if(!versions){
    console.error('[MCJS] renderGrid: VERSIONS not available');
    grid.innerHTML = '<div class="empty-state"><p>版本数据加载失败，请刷新页面</p></div>';
    return;
  }
  
  try {
    var q = searchQuery.toLowerCase();
    var html = '';
    var totalShown = 0;
  
    GROUPS.forEach(function(group){
      var matched = versions.filter(function(ver){
        if(!group.typeMatch(ver)) return false;
        return matchSearch(ver, q);
      });
      if(matched.length === 0) return;
      totalShown += matched.length;
      html += '<section class="version-group" data-group="' + group.id + '">' +
        '<header class="group-header">' +
          '<h3 class="group-title">' + escapeHtml2(group.title) + '</h3>' +
          '<p class="group-desc">' + escapeHtml2(group.desc) + '</p>' +
        '</header>' +
        '<div class="version-grid">' + matched.map(renderCard).join('') + '</div>' +
      '</section>';
    });
  
    if(totalShown === 0){
      html = '<div class="empty-state"><p>没有找到匹配的版本</p><p style="font-size:0.78rem;margin-top:6px;opacity:0.7;">请尝试其他搜索关键词</p></div>';
    }
    grid.innerHTML = html;
    console.log('[MCJS] renderGrid: rendered', totalShown, 'versions');
  } catch(e) {
    console.error('[MCJS] renderGrid error:', e);
    try { grid.innerHTML = '<div class="empty-state"><p>渲染版本列表出错: ' + escapeHtml2(e.message) + '</p></div>'; } catch(_){}
  }
}

/* ========== Search ========== */
searchInput.addEventListener('input', function(){
  if(searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(function(){
    searchQuery = searchInput.value.trim();
    renderGrid();
    updateSearchClearBtn();
  }, 300);
});
searchInput.addEventListener('keydown', function(e){ e.stopPropagation(); });
searchInput.addEventListener('keyup', function(e){ e.stopPropagation(); });
searchInput.addEventListener('keypress', function(e){ e.stopPropagation(); });

function updateSearchClearBtn(){
  var btn = document.getElementById('searchClearBtn');
  if(!btn) return;
  if(searchInput.value.length > 0){
    btn.style.display = 'flex';
  }else{
    btn.style.display = 'none';
  }
}
function clearSearch(){
  if(searchInput){
    searchInput.value = '';
    searchQuery = '';
    renderGrid();
    updateSearchClearBtn();
    searchInput.focus();
  }
}
(function(){
  var clearBtn = document.getElementById('searchClearBtn');
  if(clearBtn){
    clearBtn.addEventListener('click', function(){
      clearSearch();
    });
  }
})();

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
  var versions = getVersions();
  if(!versions) return;
  var ver = versions.find(function(v){ return v.id === id; });
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
      '<div class="mirror-item-name">' + escapeHtml2(m.name) + '</div>' +
      '<div class="mirror-item-url">' + escapeHtml2(m.url) + '</div>' +
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
  
  if (settings.popupLaunch) {
    launchInPopup(ver);
    return;
  }
  
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
      saveSessionState();
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

function launchInPopup(ver){
  var popupHtml = buildPopupHTML(ver);
  var win = window.open('', '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes');
  if (!win) {
    console.error('[MCJS] Popup blocked by browser');
    alert('弹窗被浏览器拦截，请允许此站点弹出窗口，或在设置中关闭"弹窗启动"选项。');
    return;
  }
  try {
    win.document.open();
    win.document.write(popupHtml);
    win.document.close();
    win.focus();
  } catch(e) {
    console.error('[MCJS] Failed to write popup window:', e);
    alert('无法打开游戏窗口，请检查浏览器设置。');
  }
}

function buildPopupHTML(ver){
  var settingsJson = JSON.stringify(window.MCJS_SETTINGS || {});
  var verJson = JSON.stringify(ver);
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + escapeHtml2(ver.name) + ' - MCJS</title>\n' +
    '<style>\n' +
    '  * { margin:0; padding:0; box-sizing:border-box; }\n' +
    '  html, body { width:100%; height:100%; overflow:hidden; background:#0d0e12; }\n' +
    '  #gameContainer { width:100%; height:100%; position:relative; }\n' +
    '  #popupLoader { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#1c1d24; color:#d6d8de; font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; z-index:9999; }\n' +
    '  #popupLoader .ring { width:48px; height:48px; border:3px solid rgba(214,216,222,0.18); border-top-color:#22c55e; border-radius:50%; animation:spin 0.7s linear infinite; margin-bottom:16px; }\n' +
    '  @keyframes spin { to { transform:rotate(360deg); } }\n' +
    '  #popupLoader .label { font-size:14px; opacity:0.9; }\n' +
    '  #popupLoader.hidden { display:none; }\n' +
    '  #popupError { position:fixed; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center; background:#1c1d24; color:#f87171; font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; z-index:10000; padding:24px; text-align:center; }\n' +
    '  #popupError .title { font-size:18px; font-weight:600; margin-bottom:8px; }\n' +
    '  #popupError .msg { font-size:14px; opacity:0.8; max-width:400px; line-height:1.6; }\n' +
    '</style>\n' +
    '</head>\n<body>\n' +
    '<div id="gameContainer"></div>\n' +
    '<div id="popupLoader"><div class="ring"></div><div class="label">正在启动 ' + escapeHtml2(ver.name) + '...</div></div>\n' +
    '<div id="popupError"><div class="title">启动失败</div><div class="msg" id="popupErrorMsg"></div></div>\n' +
    '<script src="./js/game.js"></script>\n' +
    '<script>\n' +
    '(function(){\n' +
    '  window.MCJS_SETTINGS = ' + settingsJson + ';\n' +
    '  var version = ' + verJson + ';\n' +
    '  function showError(msg){\n' +
    '    var loader = document.getElementById("popupLoader");\n' +
    '    var err = document.getElementById("popupError");\n' +
    '    var msgEl = document.getElementById("popupErrorMsg");\n' +
    '    if(loader) loader.classList.add("hidden");\n' +
    '    if(err) err.style.display = "flex";\n' +
    '    if(msgEl) msgEl.textContent = msg || "未知错误";\n' +
    '  }\n' +
    '  try {\n' +
    '    if(window.MCJS_GAME && window.MCJS_GAME.launch){\n' +
    '      window.MCJS_GAME.launch(version,\n' +
    '        function(text, pct){\n' +
    '          var label = document.querySelector("#popupLoader .label");\n' +
    '          if(label) label.textContent = text;\n' +
    '        },\n' +
    '        function(){\n' +
    '          var loader = document.getElementById("popupLoader");\n' +
    '          if(loader) setTimeout(function(){ loader.classList.add("hidden"); }, 500);\n' +
    '        },\n' +
    '        function(err){\n' +
    '          showError(err || "启动失败");\n' +
    '        }\n' +
    '      );\n' +
    '    } else {\n' +
    '      showError("游戏模块加载失败");\n' +
    '    }\n' +
    '  } catch(e) {\n' +
    '    showError(e.message || "启动异常");\n' +
    '  }\n' +
    '})();\n' +
    '<\/script>\n' +
    '</body>\n</html>';
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
  clearSessionState();
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
  clearSessionState();
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
  // 确保 s 有默认值
  s = ensureSettingsDefaults(s);
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
    '  --accent-blue-bg: rgba(59, 130, 246, 0.10);\n' +
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
    '.manual-opt-btn { display:block; width:100%; padding:10px 14px; margin-top:8px; background:var(--accent-blue-bg); color:var(--accent-blue); border:1px solid rgba(59,130,246,0.25); border-radius:8px; cursor:pointer; font-family:inherit; font-size:0.88rem; font-weight:600; transition:var(--transition); text-align:center; }\n' +
    '.manual-opt-btn:hover { background:var(--accent-blue); color:#fff; border-color:var(--accent-blue); box-shadow:0 2px 12px rgba(59,130,246,0.25); }\n' +
    '.manual-opt-btn:disabled { opacity:0.5; cursor:not-allowed; pointer-events:none; }\n' +
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
    '        <div class="setting-label"><span>弹窗启动</span><small>在新窗口中启动游戏</small></div>\n' +
    '        <div class="setting-control"><button class="toggle ' + toggleChecked(s.popupLaunch) + '" id="settingPopupLaunch" type="button" role="switch" aria-checked="' + toggleAria(s.popupLaunch) + '"></button></div>\n' +
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
    '      <div class="setting-item" style="border-top:1px solid var(--border-soft); padding-top:12px; margin-top:4px; flex-direction:column; align-items:stretch;">\n' +
    '        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">\n' +
    '          <div class="setting-label"><span>手动内存优化</span><small>立即执行内存释放和垃圾回收</small></div>\n' +
    '        </div>\n' +
    '        <button class="manual-opt-btn" id="manualOptBtn" style="width:100%; margin-top:6px;">执行优化</button>\n' +
    '        <div id="manualOptStatus" style="font-size:0.78rem; color:var(--text-muted); margin-top:4px; text-align:center;"></div>\n' +
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
    '        <div class="cache-info-row"><span>缓存文件</span><strong id="cacheFileCount">读取中…</strong></div>\n' +
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
    '  var defaults = { mirrorIndex:0, memoryLimit:512, autoClean:true, saveIsolation:true, gpuPrefer:"high-performance", cacheSizeLimit:2048, bgImage:true, soundEnabled:true, fullscreenLaunch:false, fontSize:"normal", cardDensity:"comfortable", autoUpdateCheck:true, loadingDetail:true, quickLaunch:false, reduceMotion:false, popupLaunch:false };\n' +
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
    '  bindToggle("settingPopupLaunch", "popupLaunch");\n' +
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
    '  \n' +
    '  var cacheInfoTimer = null;\n' +
    '  \n' +
    '  window.addEventListener("message", function(e) {\n' +
    '    if (e.data && e.data.type === "cache-info-response") {\n' +
    '      var sizeEl = document.getElementById("cacheSizeText");\n' +
    '      var countEl = document.getElementById("cacheFileCount");\n' +
    '      if (sizeEl) sizeEl.textContent = e.data.sizeText || "0 B";\n' +
    '      if (countEl) countEl.textContent = (e.data.count !== undefined && e.data.count !== null) ? e.data.count + " 个文件" : "0 个文件";\n' +
    '    }\n' +
    '  });\n' +
    '  \n' +
    '  function doRequestCacheInfo() {\n' +
    '    if (window.opener) {\n' +
    '      try { window.opener.postMessage({ type: "get-cache-info" }, "*"); } catch(e) {}\n' +
    '    }\n' +
    '  }\n' +
    '  \n' +
    '  doRequestCacheInfo();\n' +
    '  if (cacheInfoTimer) clearInterval(cacheInfoTimer);\n' +
    '  cacheInfoTimer = setInterval(doRequestCacheInfo, 3000);\n' +
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
    '  \n' +
    '  // ===== 手动内存优化 =====\n' +
    '  var manualOptBtn = document.getElementById("manualOptBtn");\n' +
    '  var manualOptStatus = document.getElementById("manualOptStatus");\n' +
    '  if (manualOptBtn) {\n' +
    '    manualOptBtn.addEventListener("click", function() {\n' +
    '      if (manualOptBtn.disabled) return;\n' +
    '      manualOptBtn.disabled = true;\n' +
    '      manualOptBtn.textContent = "优化中...";\n' +
    '      if (manualOptStatus) manualOptStatus.textContent = "正在释放内存...";\n' +
    '      \n' +
    '      if (window.opener && window.opener.MCJS_GAME && window.opener.MCJS_GAME.manualOptimize) {\n' +
    '        window.opener.MCJS_GAME.manualOptimize(\n' +
    '          function(text, pct) {\n' +
    '            if (manualOptStatus) manualOptStatus.textContent = text + " (" + pct + "%)";\n' +
    '          },\n' +
    '          function() {\n' +
    '            manualOptBtn.disabled = false;\n' +
    '            manualOptBtn.textContent = "执行优化";\n' +
    '            if (manualOptStatus) manualOptStatus.textContent = "优化完成";\n' +
    '            showToast("内存优化完成");\n' +
    '            setTimeout(function() { if (manualOptStatus) manualOptStatus.textContent = ""; }, 3000);\n' +
    '          }\n' +
    '        );\n' +
    '      } else {\n' +
    '        manualOptBtn.disabled = false;\n' +
    '        manualOptBtn.textContent = "执行优化";\n' +
    '        if (manualOptStatus) manualOptStatus.textContent = "无法连接主窗口";\n' +
    '        showToast("无法执行内存优化", true);\n' +
    '      }\n' +
    '    });\n' +
    '  }\n' +
    '  \n' +
    '  document.getElementById("clearCacheBtn").addEventListener("click", function(){\n' +
    '    if(confirm("确定要清除所有游戏缓存吗？")){\n' +
    '      showToast("缓存已清除");\n' +
    '      if(window.opener) window.opener.postMessage({ type: "clear-cache" }, "*");\n' +
    '      setTimeout(doRequestCacheInfo, 500);\n' +
    '    }\n' +
    '  });\n' +
    '  document.getElementById("clearSaveBtn").addEventListener("click", function(){\n' +
    '    if(confirm("确定要清除所有存档吗？此操作不可恢复！")){\n' +
    '      showToast("存档已清除");\n' +
    '      if(window.opener) window.opener.postMessage({ type: "clear-save" }, "*");\n' +
    '    }\n' +
    '  });\n' +
    '  window.addEventListener("beforeunload", function(e){\n' +
    '    if(dirty){\n' +
    '      e.preventDefault();\n' +
    '      e.returnValue = "";\n' +
    '      return "";\n' +
    '    }\n' +
    '  });\n' +
    '})();\n' +
    '<\/script>\n' +
    '</body>\n</html>';
}

function openSettingsWindow() {
  // 防止重复打开
  if (settingsOpening) {
    if (settingsWindow && !settingsWindow.closed) {
      settingsWindow.focus();
    }
    return;
  }
  
  if (settingsWindow && !settingsWindow.closed) {
    settingsWindow.focus();
    return;
  }
  
  settingsOpening = true;
  
  if (sound) sound.unlock();
  if (sound) sound.open();

  var html = buildSettingsHTML();
  var win = window.open('', '_blank', 'width=560,height=700,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
  if (!win) {
    settingsOpening = false;
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
  
  // 延迟重置锁
  setTimeout(function() {
    settingsOpening = false;
  }, 1000);
}

window.addEventListener('message', function(e) {
  if (!e.data) return;
  var data = e.data;
  if (data.type === 'settings-updated') {
    var newSettings = data.settings;
    if (newSettings) {
      // 确保新设置也有默认值
      newSettings = ensureSettingsDefaults(newSettings);
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
  
  if(e.key === '/' && (e.ctrlKey || e.metaKey)){
    e.preventDefault();
    if(searchInput) searchInput.focus();
  }
  
  if(e.key === 'Escape'){
    if(gameOverlay && gameOverlay.classList.contains('active')){
      cancelCurrentLaunch();
    }
    if(launchModal && launchModal.classList.contains('active')){
      launchModal.classList.remove('active');
    }
    if(launchFailedModal && launchFailedModal.classList.contains('active')){
      launchFailedModal.classList.remove('active');
    }
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
  // 确保 reduceMotion 默认是 false
  var reduce = (settings.reduceMotion === true);
  if(reduce){
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

/* ========== FAQ 手风琴 ========== */
function initFAQAccordion(){
  if(window.__MCJS_FAQ_INIT__) return;
  window.__MCJS_FAQ_INIT__ = true;
  try {
    var faqItems = document.querySelectorAll('.faq-item');
    if(!faqItems || faqItems.length === 0) {
      console.warn('[MCJS] No FAQ items found');
      return;
    }
    
    faqItems.forEach(function(item){
      // 跳过已绑定
      if(item.__mcjsBound) return;
      item.__mcjsBound = true;
      
      var question = item.querySelector('.faq-question');
      if(!question) return;
      
      question.setAttribute('role', 'button');
      question.setAttribute('tabindex', '0');
      question.setAttribute('aria-expanded', 'false');
      
      var answer = item.querySelector('.faq-answer');
      if(answer){
        answer.setAttribute('role', 'region');
      }
      
      function toggle(e){
        if(e){ e.preventDefault(); e.stopPropagation(); }
        var isOpen = item.classList.contains('active');
        
        // 关闭其他
        faqItems.forEach(function(otherItem){
          if(otherItem !== item && otherItem.classList.contains('active')){
            otherItem.classList.remove('active');
            var otherQ = otherItem.querySelector('.faq-question');
            if(otherQ) otherQ.setAttribute('aria-expanded', 'false');
          }
        });
        
        if(isOpen){
          item.classList.remove('active');
          question.setAttribute('aria-expanded', 'false');
        }else{
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
        }
        try { if(sound) sound.click(); } catch(_){}
      }
      
      // 使用普通 click 和 keydown,不依赖 stopPropagation
      question.addEventListener('click', toggle);
      question.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32){
          toggle(e);
        }
      });
    });
    
    console.log('[MCJS] FAQ accordion initialized with', faqItems.length, 'items');
  } catch(err) {
    console.error('[MCJS] FAQ init failed:', err);
  }
}

/* ========== 初始化 ========== */
function safeRun(fn, label){
  try { fn(); }
  catch(e){ console.error('[MCJS] ' + (label||'init') + ' failed:', e); }
}

(function init(){
  console.log('[MCJS] init start, readyState:', document.readyState);
  
  // 再次确保设置正确
  settings = ensureSettingsDefaults(window.MCJS_SETTINGS || {});
  window.MCJS_SETTINGS = settings;
  
  if(settings.bgImage === false){ document.body.classList.add('no-bg'); }
  safeRun(applyTheme, 'applyTheme');
  safeRun(applyFontSize, 'applyFontSize');
  safeRun(applyCardDensity, 'applyCardDensity');
  
  // 暴露全局调试钩子
  window.MCJS = window.MCJS || {};
  window.MCJS.reloadVersions = function(){ safeRun(renderGrid, 'renderGrid'); };
  window.MCJS.openFAQ = function(idx){
    var items = document.querySelectorAll('.faq-item');
    if(items[idx]){ items[idx].querySelector('.faq-question').click(); }
  };
  
  function bootUI(){
    safeRun(renderGrid, 'renderGrid');
    safeRun(function(){ attachHoverSound(document); }, 'attachHoverSound');
    safeRun(initFAQAccordion, 'initFAQAccordion');
    safeRun(updateSearchClearBtn, 'updateSearchClearBtn');
    
    requestAnimationFrame(function(){
      try {
        sound = new SoundManager();
        sound.setEnabled(settings.soundEnabled !== false);
        // 暴露给插件市场/编辑器等模块使用
        window.MCJS = window.MCJS || {};
        window.MCJS.sound = sound;
      } catch(e) { console.warn('[MCJS] Sound init failed:', e); }
      
      var wasmInfo = safeRun(checkWasmSupport, 'checkWasmSupport');
      if (wasmInfo && !wasmInfo.supported) {
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
      
      var skeleton = document.getElementById('loadingSkeleton');
      if(skeleton){
        skeleton.style.opacity = '0';
        setTimeout(function(){ 
          if(skeleton.parentNode) skeleton.parentNode.removeChild(skeleton); 
        }, 300);
      }
      
      try {
        var state = loadSessionState();
        if (state && state.isGameRunning && state.lastVersion) {
          var ver = window.VERSIONS && window.VERSIONS.find ? window.VERSIONS.find(function(v) { return v.id === state.lastVersion; }) : null;
          if (!ver) {
            ver = VERSIONS.find(function(v) { return v.id === state.lastVersion; });
          }
          if (ver) {
            setTimeout(function() { showRestoreBanner(ver); }, 800);
          }
        }
      } catch(e) { console.warn('[MCJS] session restore failed:', e); }
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUI);
  } else {
    // 已 ready,立即跑
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(bootUI);
    } else {
      setTimeout(bootUI, 0);
    }
  }
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

/* ========== Toast 通知 ========== */
function showToast(msg, type) {
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ';
  t.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-text">' + escapeHtml2(msg) + '</span>';
  container.appendChild(t);
  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
  }, 3500);
}
function escapeHtml2(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
window.MCJS_TOAST = showToast;
window.MCJS_ESCAPE_HTML = escapeHtml2;

/* ========== 插件系统 UI 绑定 ========== */
(function bindPluginUI() {
  function openPluginMarket() {
    if (window.MCJS_PLUGIN_MARKET) window.MCJS_PLUGIN_MARKET.open();
    else showToast('插件市场尚未加载', 'error');
  }
  function openPluginEditor() {
    if (window.MCJS_PLUGIN_EDITOR) window.MCJS_PLUGIN_EDITOR.open();
    else showToast('插件编辑器尚未加载', 'error');
  }
  function showPluginDocs() {
    openPluginMarket();
    setTimeout(function() {
      var tabs = document.querySelectorAll('#pluginMarketModal .plugin-tab');
      var docsTab = null;
      tabs.forEach(function(t) { if (t.getAttribute('data-tab') === 'docs') docsTab = t; });
      if (docsTab) docsTab.click();
    }, 80);
  }

  var pmBtn = document.getElementById('pluginMarketBtn');
  if (pmBtn) pmBtn.addEventListener('click', openPluginMarket);
  var peBtn = document.getElementById('pluginEditorBtn');
  if (peBtn) peBtn.addEventListener('click', openPluginEditor);
  var heroMarket = document.getElementById('openPluginMarket');
  if (heroMarket) heroMarket.addEventListener('click', openPluginMarket);
  var heroDocs = document.getElementById('openPluginDocs');
  if (heroDocs) heroDocs.addEventListener('click', showPluginDocs);

  // WASM 警告 → 跳转插件市场(只在"前往插件市场"按钮上绑定,关闭按钮由上面的逻辑处理)
  var wasmAction = document.getElementById('wasmWarningAction');
  if (wasmAction) wasmAction.addEventListener('click', function() {
    openPluginMarket();
    var warn = document.getElementById('wasmWarning');
    if (warn) warn.style.display = 'none';
  });

  // 已启用插件列表
  function categoryTag(cat) {
    // 纯文字标签,与 plugin-market 保持一致
    return ({
      compatibility: 'COMPAT',
      performance: 'PERF',
      appearance: 'STYLE',
      utility: 'UTIL',
      language: 'I18N',
      custom: 'CUSTOM'
    })[cat] || 'PLUGIN';
  }
  function renderInstalledPluginsList() {
    var section = document.getElementById('installedPluginsSection');
    var listEl = document.getElementById('installedPluginsList');
    var countEl = document.getElementById('installedPluginsCount');
    if (!section || !listEl) return;
    if (!window.MCJS_REGISTRY) return;
    var enabled = window.MCJS_REGISTRY.list().filter(function(p) {
      return window.MCJS_REGISTRY.isEnabled(p.id);
    });
    // 主页不再展示已安装插件面板(避免冗余入口,统一在插件市场的"已安装"tab 管理)
    section.style.display = 'none';
    if (countEl) countEl.textContent = enabled.length + ' 个插件已启用';
  }

  var manageBtn = document.getElementById('managePluginsBtn');
  if (manageBtn) manageBtn.addEventListener('click', openPluginMarket);

  // 事件总线
  if (window.MCJS_EVENTS) {
    window.MCJS_EVENTS.on('plugin:enable', function() { setTimeout(renderInstalledPluginsList, 50); });
    window.MCJS_EVENTS.on('plugin:disable', function() { setTimeout(renderInstalledPluginsList, 50); });
    window.MCJS_EVENTS.on('plugin:install', function() { setTimeout(renderInstalledPluginsList, 50); });
    window.MCJS_EVENTS.on('plugin:uninstall', function() { setTimeout(renderInstalledPluginsList, 50); });
  }

  // 文档标签渲染
  function renderPluginDocs() {
    var container = document.getElementById('pluginDocsContainer');
    if (!container) return;
    container.innerHTML = buildPluginDocsHTML();
  }

  // 初始 + 监听
  setTimeout(function() {
    renderInstalledPluginsList();
    renderPluginDocs();
  }, 500);

  // 暴露给 plugin-market 调用
  window.MCJS_DOCS_RENDER = renderPluginDocs;
})();

/* ========== 插件开发文档(中文) ========== */
function buildPluginDocsHTML() {
  var hookPoints = window.MCJS_HOOK_POINTS || [];
  var events = window.MCJS_EVENT_NAMES || [];
  var perms = (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API.PERMS) || {};

  function hookList() {
    return hookPoints.map(function(h) {
      return '<li><code>' + escapeHtml2(h.name) + '</code><span class="plugin-doc-args">(' + escapeHtml2(h.args) + ') → ' + escapeHtml2(h.returns) + '</span><div class="plugin-doc-desc">' + escapeHtml2(h.desc) + '</div></li>';
    }).join('');
  }
  function eventList() {
    return events.map(function(e) { return '<li><code>' + escapeHtml2(e) + '</code></li>'; }).join('');
  }
  function permList() {
    return Object.keys(perms).map(function(k) {
      return '<li><code>' + escapeHtml2(k) + '</code> - ' + escapeHtml2(perms[k]) + '</li>';
    }).join('');
  }

  return [
    '<div class="plugin-docs-content">',

    '<section class="plugin-doc-section">',
    '<h3>快速开始</h3>',
    '<p>MCJS 插件以 <strong>JSON manifest + JS 源码</strong> 形式存在。你可以通过以下方式创建插件:</p>',
    '<ol>',
    '<li>打开"编写"标签,选择模板并填写元数据</li>',
    '<li>在 <code>inject.js</code> 中编写游戏注入代码</li>',
    '<li>点击"保存"即可自动安装并启用</li>',
    '<li>也可以"导出"为 <code>.mcjs-plugin.json</code> 文件,以后通过"导入插件"加载</li>',
    '</ol>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>插件结构</h3>',
    '<pre class="plugin-doc-code">',
'{\n' +
'  "id": "my.plugin-id",            // 唯一 ID(必须)\n' +
'  "name": "我的插件",              // 显示名\n' +
'  "version": "1.0.0",              // 语义化版本\n' +
'  "author": "Your Name",           // 作者\n' +
'  "category": "utility",           // 分类:compatibility/performance/appearance/utility/language/custom\n' +
'  "description": "插件简介",       // 简短描述\n' +
'  "hooks": ["launch:html"],        // 监听哪些钩子点\n' +
'  "permissions": ["game.inject"],  // 申请权限\n' +
'  "files": {                       // 多文件源码(可选)\n' +
'    "main.js": "...",\n' +
'    "inject.js": "...",\n' +
'    "style.css": "..."\n' +
'  },\n' +
'  "code": "..."                    // 兼容字段(纯 JS 注入时用)\n' +
'}',
'</pre>',
    '<p>当 manifest 包含 <code>code</code> 字段或 <code>files.inject.js</code> 时,该内容会在 <code>launch:html</code> 钩子触发时被注入到游戏页面 <code>&lt;head&gt;</code> 中。</p>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>钩子点 (Hooks)</h3>',
    '<p>插件通过 <code>hooks</code> 字段声明它要监听的钩子。系统会按优先级顺序依次调用所有插件的对应钩子,返回的新值会传递给下一个钩子。</p>',
    '<ul class="plugin-doc-list">' + hookList() + '</ul>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>事件 (Events)</h3>',
    '<p>通过 <code>api.on(eventName, fn)</code> 监听事件。事件名列表:</p>',
    '<ul class="plugin-doc-list">' + eventList() + '</ul>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>权限 (Permissions)</h3>',
    '<p>插件必须显式声明所需权限,启动器 UI 中会展示给用户。</p>',
    '<ul class="plugin-doc-list">' + permList() + '</ul>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>API 参考</h3>',
    '<h4>api.on(eventName, callback)</h4>',
    '<p>监听启动器事件,返回取消监听的函数。</p>',
    '<h4>api.getSetting(key, defaultValue)</h4>',
    '<p>读取本插件的配置项(持久化在 localStorage)。</p>',
    '<h4>api.setSetting(key, value)</h4>',
    '<p>写入本插件的配置项。</p>',
    '<h4>api.storage.getItem(key) / setItem(key, value)</h4>',
    '<p>键值存储,数据完全隔离于其他插件。</p>',
    '<h4>api.fetch(url, opts)</h4>',
    '<p>网络请求包装(credentials 默认 omit)。</p>',
    '<h4>api.toast(message, type)</h4>',
    '<p>显示一条 toast 通知。type 可选 <code>info/success/warn/error</code>。</p>',
    '<h4>api.ui.addButton / addPanel</h4>',
    '<p>向启动器 UI 中动态添加按钮或面板。</p>',
    '<h4>api.injectScript(pluginId, jsCode) / injectCSS(pluginId, cssCode)</h4>',
    '<p>在游戏 iframe 中注入脚本或样式(异步,返回 Promise)。</p>',
    '<h4>api.launchContext.getCurrent()</h4>',
    '<p>读取当前正在启动的版本上下文(版本对象、镜像 URL、起始时间)。</p>',
    '<h4>api.plugins.list() / isInstalled(id) / get(id)</h4>',
    '<p>查询已安装的其他插件。</p>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>实战示例</h3>',

    '<h4>① 注入游戏时打印日志</h4>',
    '<pre class="plugin-doc-code">',
'// manifest.json\n' +
'{\n' +
'  "id": "demo.log",\n' +
'  "name": "日志示例",\n' +
'  "version": "1.0.0",\n' +
'  "author": "demo",\n' +
'  "category": "utility",\n' +
'  "description": "在控制台打印启动日志",\n' +
'  "hooks": ["launch:html"],\n' +
'  "permissions": ["game.inject"]\n' +
'}\n\n' +
'// inject.js\n' +
'(function(){\n' +
'  console.log("[Demo] 插件已注入,版本:", window.__MCJS_LAUNCH_CONTEXT__?.version?.id);\n' +
'  // 在游戏页 head 中插入自定义样式\n' +
'  var s = document.createElement("style");\n' +
'  s.textContent = "body::before { content: \'Plugin Loaded\'; position:fixed; top:0; left:0; background:#22c55e; color:#fff; padding:2px 6px; z-index:99999; font:12px monospace; }";\n' +
'  document.head.appendChild(s);\n' +
'})();',
'</pre>',

    '<h4>② 修改启动参数,强制全屏</h4>',
    '<pre class="plugin-doc-code">',
'// manifest.json (关键字段)\n' +
'"hooks": ["launch:version"]\n\n' +
'// main.js (由系统调用,args 是 version 对象)\n' +
'"builtin": function(){\n' +
'  return {\n' +
'    inject: function(ctx) { return null; },\n' +
'    onLaunchVersion: function(version) {\n' +
'      version.forceFullscreen = true;\n' +
'      return version;\n' +
'    }\n' +
'  };\n' +
'}',
'</pre>',

    '<h4>③ 动态添加镜像(去广告/换源)</h4>',
    '<pre class="plugin-doc-code">',
'// manifest.json\n' +
'"hooks": ["launch:mirrors"]\n\n' +
'// inject logic - 直接修改 mirrors 数组\n' +
'// 详见插件编写器 → 模板: "修改镜像列表"\n',
'</pre>',

    '<h4>④ 监听事件实现自动备份</h4>',
    '<pre class="plugin-doc-code">',
'// 在 main.js 中\nexport default function(api) {\n' +
'  api.on("game:close", function() {\n' +
'    var data = api.storage.getItem("lastBackup") || "[]";\n' +
'    var list = JSON.parse(data);\n' +
'    list.push({ ts: Date.now() });\n' +
'    api.storage.setItem("lastBackup", JSON.stringify(list));\n' +
'    api.toast("已记录关闭时间", "info");\n' +
'  });\n' +
'  return {};\n' +
'}',
'</pre>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>安全与限制</h3>',
    '<ul>',
    '<li>所有插件 JS 在 <strong>同一 window 上下文</strong> 运行,无法完全隔离。导入第三方插件时务必检查源码。</li>',
    '<li>对游戏 iframe 的注入通过 <code>srcdoc</code> + <code>data-mcjs-plugin</code> 属性标记,可在控制台审查。</li>',
    '<li>权限仅是 UI 提示,不构成技术限制;官方插件会在描述中清楚说明行为。</li>',
    '<li>插件存储完全独立(<code>mcjs_plugin_storage</code> 键),卸载时会被清除。</li>',
    '<li>若插件代码导致游戏异常,直接到"插件市场 → 已安装"中禁用即可。</li>',
    '</ul>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>远程加载 / 第三方市场</h3>',
    '<p>MCJS v3.0 开放了插件加载链路,支持以下方式从远程安装插件:</p>',
    '<ol>',
    '<li><strong>添加第三方仓库</strong>:在远程仓库标签点击 "添加仓库",填入任何符合协议的 JSON manifest 地址。</li>',
    '<li><strong>URL 直接导入</strong>:在 "浏览" 标签底部粘贴 URL(GitHub raw、CDN、个人服务器),选择要安装的插件即可。</li>',
    '<li><strong>本地文件导入</strong>:点击 "导入文件" 选择本地 <code>.json</code> 插件文件。</li>',
    '</ol>',
    '<p><strong>Manifest 协议</strong>(远程仓库 JSON):</p>',
    '<pre class="plugin-doc-code">',
'{\n' +
'  "name": "我的插件市场",\n' +
'  "version": "1.0.0",\n' +
'  "plugins": [\n' +
'    {\n' +
'      "id": "author.plugin-name",\n' +
'      "name": "插件名",\n' +
'      "version": "1.0.0",\n' +
'      "author": "Your Name",\n' +
'      "category": "utility",\n' +
'      "description": "插件描述",\n' +
'      "hooks": ["launch:html"],\n' +
'      "permissions": ["game.inject"],\n' +
'      "url": "https://.../plugin-name/manifest.json"  // 插件完整 manifest\n' +
'    }\n' +
'  ]\n' +
'}',
'</pre>',
    '<p>如果是单个插件 URL,manifest 直接是插件对象本身(无 <code>plugins</code> 数组)。</p>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>签名验证</h3>',
    '<p>为了保证插件来源可信,MCJS 支持在 manifest 中嵌入 <strong>SHA-256 签名</strong>。校验流程:</p>',
    '<ol>',
    '<li>系统拉取插件 manifest</li>',
    '<li>从 manifest 移除 <code>signature</code> / <code>signatureType</code> / <code>publicKey</code> 字段</li>',
    '<li>对剩余 JSON 做 SHA-256 哈希</li>',
    '<li>与 <code>signature</code> 字段对比,相等则通过</li>',
    '</ol>',
    '<p>在 manifest 中加入签名:</p>',
    '<pre class="plugin-doc-code">',
'{\n' +
'  "id": "my.plugin",\n' +
'  "name": "My Plugin",\n' +
'  "version": "1.0.0",\n' +
'  "hooks": ["launch:html"],\n' +
'  "permissions": ["game.inject"],\n' +
'  "code": "...",\n' +
'  "signatureType": "sha256",\n' +
'  "signature": "abc123...64位hex..."\n' +
'}',
'</pre>',
    '<p>生成 SHA-256 签名的脚本示例(Node.js):</p>',
    '<pre class="plugin-doc-code">',
'const crypto = require("crypto");\n' +
'const fs = require("fs");\n' +
'const plugin = JSON.parse(fs.readFileSync("plugin.json", "utf8"));\n' +
'const p = Object.assign({}, plugin);\n' +
'delete p.signature;\n' +
'delete p.signatureType;\n' +
'delete p.publicKey;\n' +
'const ordered = Object.keys(p).sort().reduce((o,k)=>(o[k]=p[k],o),{});\n' +
'const hash = crypto.createHash("sha256")\n' +
'  .update(JSON.stringify(ordered))\n' +
'  .digest("hex");\n' +
'plugin.signatureType = "sha256";\n' +
'plugin.signature = hash;\n' +
'fs.writeFileSync("plugin.signed.json", JSON.stringify(plugin, null, 2));',
'</pre>',
    '<p>高安全场景推荐使用 <strong>RSA-SHA256</strong>(<code>signatureType: "rsa-sha256"</code>),通过公钥验证作者身份。</p>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>最佳实践</h3>',
    '<ul>',
    '<li><strong>幂等注入</strong>:用 <code>window.__MCJS_xxx__</code> 标记,避免重复注入。例:<code>if (window.__MCJS_MY_PLUGIN__) return;</code></li>',
    '<li><strong>捕获异常</strong>:用 <code>try/catch</code> 包装逻辑,失败时 <code>console.warn</code> 而非崩溃游戏。</li>',
    '<li><strong>少改动 DOM</strong>:优先用 CSS 样式,避免删除节点导致游戏逻辑异常。</li>',
    '<li><strong>暴露开关</strong>:用 <code>api.getSetting("enabled", true)</code> 让用户可关闭插件副作用。</li>',
    '<li><strong>语义化版本</strong>:每次改动递增 <code>version</code>(<code>MAJOR.MINOR.PATCH</code>),让更新检查能识别。</li>',
    '<li><strong>描述清楚权限</strong>:<code>permissions</code> 字段会展示给用户,越具体越能获得信任。</li>',
    '<li><strong>提供卸载说明</strong>:在 <code>description</code> 中说明插件做了什么,以便用户判断是否需要。</li>',
    '<li><strong>签名发布</strong>:发布到第三方市场时附上 SHA-256 签名,用户可一键验证完整性。</li>',
    '</ul>',
    '</section>',

    '<section class="plugin-doc-section">',
    '<h3>贡献与发布</h3>',
    '<p>想把你的插件分享给社区?</p>',
    '<ol>',
    '<li>在 "插件编写器" 编写并测试你的插件</li>',
    '<li>点击 "导出" 下载 <code>.mcjs-plugin.json</code></li>',
    '<li>把文件放到任何 HTTPS 可访问的位置(自己的服务器、GitHub Pages、CDN)</li>',
    '<li>构建一个 manifest.json 列出你的所有插件:</li>',
    '</ol>',
    '<pre class="plugin-doc-code">',
'{\n' +
'  "name": "我的市场",\n' +
'  "version": "1.0.0",\n' +
'  "plugins": [\n' +
'    { "id": "my.plugin-a", "version": "1.0.0", "name": "插件A", "url": "https://me.com/a.json" },\n' +
'    { "id": "my.plugin-b", "version": "1.0.0", "name": "插件B", "url": "https://me.com/b.json" }\n' +
'  ]\n' +
'}',
'</pre>',
    '<ol start="5">',
    '<li>分享你的 manifest URL,任何用户都可以在 "远程仓库 → 添加仓库" 中订阅</li>',
    '</ol>',
    '<p>MCJS 不强制审核 — 用户可自由添加任何来源,信任级别由用户自决(官方 / 社区 / 不信任)。</p>',
    '</section>',

    '</div>'
  ].join('');
}

})();