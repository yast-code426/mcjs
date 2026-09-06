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
  // 启动
  mirrorIndex: 0,
  fullscreenLaunch: false,
  quickLaunch: false,
  popupLaunch: false,
  loadingDetail: true,
  enginePrefer: 'auto',        // auto | wasm | js —— 默认引擎偏好
  confirmLaunch: true,         // 启动/关闭危险操作前二次确认
  // 性能
  memoryLimit: 512,
  autoClean: true,
  gpuPrefer: 'high-performance',
  // 存储
  saveIsolation: true,
  cacheSizeLimit: 2048,
  saveReminder: true,          // 定期提醒备份存档
  // 外观
  theme: 'light',              // light | dark | system
  accentColor: 'green',        // green | blue | purple | orange | pink
  bgImage: true,
  glassBlur: true,             // 毛玻璃效果开关
  reduceMotion: false,
  fontSize: 'normal',
  cardDensity: 'comfortable',
  // 音效与辅助
  soundEnabled: true,
  soundVolume: 70,             // 0~100 界面音量(百分比)
  autoUpdateCheck: true,
  showAnnouncements: true,     // 启动时显示更新公告
  // 插件
  pluginAutoCheck: true,       // 启动时检查插件更新
  // 工程调试
  debugMode: false,
  verboseLog: false,
  disableCache: false,
  showDebugOverlay: false,
  testMode: false
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
// v1.5: 音量改为 0~100 百分比存储；旧版若存的是 0~1 小数则自动换算
if (typeof settings.soundVolume === 'number' && settings.soundVolume > 0 && settings.soundVolume <= 1) {
  settings.soundVolume = Math.round(settings.soundVolume * 100);
}
// 确保 window.MCJS_SETTINGS 始终可用（供 game.js / 插件读取）
window.MCJS_SETTINGS = settings;

var searchQuery = '';
var searchDebounceTimer = null;
var sound = null;
var currentVersion = null;
var isLaunching = false;
var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var isPageRestored = false;

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
  this.volume = 0.7;
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
    var v = (volume || 0.08) * (this.volume == null ? 0.7 : this.volume);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v, t + 0.01);
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
SoundManager.prototype.setVolume = function(v){
  v = parseFloat(v);
  if (isNaN(v)) v = 0.7;
  this.volume = Math.max(0, Math.min(1, v));
};

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
  'new-beta': { cls: 'badge-new', text: '新版测试' },
  'third-party': { cls: 'badge-third-party', text: '第三方' }
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
        rendered = rendered.replace(/(单机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(单机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-single">单机</span> <span class="detail-icon detail-icon-fail">✗</span>');
        rendered = rendered.replace(/(局域网)(\s*)(✓)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(局域网)(\s*)(✗)/g, '<span class="detail-feature detail-feature-lan">局域网</span> <span class="detail-icon detail-icon-fail">✗</span>');
        rendered = rendered.replace(/(远程联机)(\s*)(✓)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-ok">✓</span>');
        rendered = rendered.replace(/(远程联机)(\s*)(✗)/g, '<span class="detail-feature detail-feature-online">远程联机</span> <span class="detail-icon detail-icon-fail">✗</span>');

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
        if (rendered.indexOf('定制主题') !== -1) {
          rendered = rendered.replace(/(定制主题)/g, '<span class="detail-resource-mod">$1</span>');
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

  // v1.5.1: 部分高版本测试版存在「无皮肤无法进入主页」的 bug，提供官方默认皮肤下载按钮（与 MCJS 官网同步）
  var skinBtn = ver.tempSkin
    ? ('<a class="card-skin-btn" href="' + escapeHtml2(ver.tempSkin) + '" download="steve.png" title="下载官方默认皮肤 steve.png，进入游戏后在皮肤设置中导入即可">下载临时皮肤</a>')
    : '';

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
      '<div class="card-actions">' +
        skinBtn +
        '<button class="card-launch-btn" data-id="' + ver.id + '" aria-label="启动 ' + escapeHtml2(ver.name) + '">开始游戏</button>' +
      '</div>' +
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
    desc: '提前体验最新版本 (1.13+ 高版本)。测试版不稳定且 bug 多，仅测试体验。高版本对设备性能要求高，仅有 WASM 版，需高性能电脑。部分版本已有中文翻译。',
    typeMatch: function(ver){ return !ver.modpack && (ver.type === 'beta' || ver.type === 'new-beta'); }
  },
  {
    id: 'third-party',
    title: '第三方 Eaglercraft 客户端',
    desc: '由社区开发的第三方客户端，魔改界面和功能，非官方不受支持。',
    typeMatch: function(ver){ return ver.type === 'third-party'; }
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
  ver = resolveEngineVersion(ver);
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
    '<div><div class="auto-launch-name">自动选择（智能最快镜像）</div>' +
    '<div class="auto-launch-desc">并发测速，自动连接延迟最低的镜像</div></div>' +
  '</div>' +
  '<div class="mirror-speed-bar">' +
    '<button class="mirror-speed-btn" id="mirrorSpeedTestBtn" type="button">📡 测速镜像延迟</button>' +
    '<span class="mirror-speed-hint" id="mirrorSpeedHint"></span>' +
  '</div>';
  html += ver.mirrors.map(function(m, i){
    return '<div class="mirror-item" data-mirror="' + i + '" role="button" tabindex="0">' +
      '<div class="mirror-item-row"><div class="mirror-item-name">' + escapeHtml2(m.name) + '</div>' +
      '<span class="mirror-ping" data-ping="' + i + '">—</span></div>' +
      '<div class="mirror-item-url">' + escapeHtml2(m.url) + '</div>' +
    '</div>';
  }).join('');
  container.innerHTML = html;
  document.getElementById('autoLaunchBtn').addEventListener('click', function(){
    if(sound) sound.click();
    startGameLaunch(ver, true);
  });
  document.getElementById('autoLaunchBtn').addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); startGameLaunch(ver); }
  });
  if (!renderMirrorSelection._modalBound) {
    renderMirrorSelection._modalBound = true;
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
  }
  // ===== 镜像测速(并发 ping,显示延迟) =====
  var speedBtn = document.getElementById('mirrorSpeedTestBtn');
  var speedHint = document.getElementById('mirrorSpeedHint');
  if (speedBtn && !speedBtn._mcjsBound) {
    speedBtn._mcjsBound = true;
    speedBtn.addEventListener('click', function(){
      if (speedBtn.disabled) return;
      speedBtn.disabled = true;
      speedBtn.textContent = '⏳ 测速中…';
      if (speedHint) speedHint.textContent = '';
      var pingEls = container.querySelectorAll('.mirror-ping');
      for (var pi=0; pi<pingEls.length; pi++){ pingEls[pi].textContent = '…'; pingEls[pi].className = 'mirror-ping'; }
      var done = 0, total = ver.mirrors.length, results = [];
      var BATCH = 6; // 每批并发 6 个,避免一次性请求过多
      var idx = 0;
      function launchBatch(){
        var batch = [];
        while(idx < ver.mirrors.length && batch.length < BATCH){
          (function(mirrorIndex){
            var m = ver.mirrors[mirrorIndex];
            var url = window.MCJS_GAME.buildMirrorURL(m, ver);
            var el = container.querySelector('.mirror-ping[data-ping="'+mirrorIndex+'"]');
            batch.push(
              window.MCJS_GAME.pingMirror(url, 6000).then(function(res){
                if (el){
                  if (res){
                    el.textContent = res.latency + ' ms';
                    el.className = 'mirror-ping ' + (res.latency < 800 ? 'ping-good' : (res.latency < 2000 ? 'ping-mid' : 'ping-bad'));
                    results.push({ idx: mirrorIndex, latency: res.latency });
                  } else {
                    el.textContent = '不可用';
                    el.className = 'mirror-ping ping-bad';
                  }
                }
              }).catch(function(){
                if (el){ el.textContent = '失败'; el.className = 'mirror-ping ping-bad'; }
              })
            );
          })(idx);
          idx++;
        }
        if (batch.length === 0){
          speedBtn.disabled = false;
          speedBtn.textContent = '📡 重新测速';
          if (speedHint && results.length > 0){
            results.sort(function(a,b){ return a.latency - b.latency; });
            speedHint.textContent = '最快:镜像 ' + (results[0].idx + 1) + ' (' + results[0].latency + ' ms),点击它启动';
          } else if (speedHint){
            speedHint.textContent = '所有镜像暂不可达,请检查网络';
          }
          return;
        }
        Promise.all(batch).then(function(){ launchBatch(); });
      }
      launchBatch();
    });
  }
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

function startGameLaunch(ver, autoMode){
  if (isLaunching) return;
  var launchAuto = autoMode === true;
  
  if (settings.popupLaunch) {
    // 弹窗模式：游戏在独立窗口运行，关闭镜像选择弹窗
    launchModal.classList.remove('active');
    if(sound) sound.close();
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
      try { startDebugOverlay(ver); } catch(e) {}
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
    },
    launchAuto
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
    '<base href="' + escapeHtml2(window.location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '')) + '">\n' +
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
    '<script src="./js/compat.js"></script>\n' +
    '<script src="./js/plugin-api.js"></script>\n' +
    '<script src="./js/plugin-registry.js"></script>\n' +
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
    '          if(window.MCJS_SETTINGS && window.MCJS_SETTINGS.fullscreenLaunch){\n' +
    '            var fsDone=false;\n' +
    '            function doFs(){\n' +
    '              if(fsDone) return;\n' +
    '              try{\n' +
    '                var el=document.documentElement;\n' +
    '                var req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen;\n' +
    '                if(!req) return;\n' +
    '                var ret=req.call(el); fsDone=true;\n' +
    '                if(ret&&ret.catch) ret.catch(function(){ fsDone=false; });\n' +
    '              }catch(e){}\n' +
    '            }\n' +
    '            setTimeout(doFs, 600);\n' +
    '            function onGesture(){ if(!fsDone) doFs(); }\n' +
    '            document.addEventListener("pointerdown", onGesture, {once:true});\n' +
    '            document.addEventListener("keydown", onGesture, {once:true});\n' +
    '          }\n' +
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

var _debugOverlayTimer = null;
function stopDebugOverlay() {
  if (_debugOverlayTimer) { clearInterval(_debugOverlayTimer); _debugOverlayTimer = null; }
  var el = document.getElementById('mcjsDebugOverlay');
  if (el) el.remove();
}
function startDebugOverlay(ver) {
  stopDebugOverlay();
  if (!settings.showDebugOverlay) return;
  var container = document.getElementById('gameContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.id = 'mcjsDebugOverlay';
  el.className = 'mcjs-debug-overlay';
  container.appendChild(el);
  var frames = 0, last = performance.now(), fps = 0;
  function tick() {
    frames++;
    var now = performance.now();
    if (now - last >= 1000) {
      fps = Math.round(frames * 1000 / (now - last));
      frames = 0; last = now;
    }
    var mem = '';
    try { if (performance.memory) mem = ' 内存 ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB'; } catch(e) {}
    var fs = document.fullscreenElement ? '全屏' : '窗口';
    el.textContent = 'FPS ' + fps + ' | ' + fs + mem + (ver ? ' | ' + ver.name : '');
  }
  _debugOverlayTimer = setInterval(tick, 500);
  tick();
}

function cancelCurrentLaunch(){
  console.log('[MCJS] Cancelling launch...');
  stopDebugOverlay();
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
  stopDebugOverlay();
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
  try {
    var req = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
    if(!req) { if(window.MCJS_TOAST) window.MCJS_TOAST('当前环境不支持全屏', 'warn'); return; }
    var ret = req.call(container);
    // 旧前缀方法返回 undefined,不能直接 .catch
    if(ret && typeof ret.catch === 'function'){
      ret.catch(function(e){ console.warn('[MCJS] Fullscreen failed:', e); });
    }
  } catch(e) { console.warn('[MCJS] Fullscreen failed:', e); }
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
   ===== 设置窗口（v1.5 站内模态版） =====
   ============================================================ */

var settingsBtn = document.getElementById('settingsBtn');
var settingsModalEl = document.getElementById('settingsModal');
var settingsDraft = null;
var settingsDirty = false;
var settingsCacheTimer = null;
var _systemDarkMql = null;

/* ---------- 工具 ---------- */
function settingsEsc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function settingsToast(msg, type) {
  if (window.MCJS_TOAST) { window.MCJS_TOAST(msg, type || 'success'); return; }
  showToast(msg, type === 'error' ? 'error' : (type === 'info' ? 'info' : ''));
}

/* ---------- 主题 / 外观即时预览 ---------- */
function resolveTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyThemeMode(mode) {
  var t = resolveTheme(mode);
  document.body.setAttribute('data-theme', t);
}
function applyAccentColor(color) {
  document.body.setAttribute('data-accent', color || 'green');
}
function applyGlass(on) {
  if (on === false) document.body.classList.add('no-glass');
  else document.body.classList.remove('no-glass');
}

/* ---------- 控件生成 ---------- */
function stToggle(id, key, label, desc) {
  var on = settingsDraft[key] !== false;
  return '<div class="setting-item">' +
    '<div class="setting-label"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' +
    '<div class="setting-control"><button type="button" class="toggle' + (on ? ' on' : '') + '" id="' + id + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-key="' + key + '"></button></div>' +
  '</div>';
}
function stSelect(id, key, label, desc, options) {
  var cur = settingsDraft[key];
  var opts = options.map(function(o) {
    var val = (typeof o === 'object') ? o.v : o;
    var txt = (typeof o === 'object') ? o.t : o;
    return '<option value="' + settingsEsc(val) + '"' + (String(cur) === String(val) ? ' selected' : '') + '>' + settingsEsc(txt) + '</option>';
  }).join('');
  return '<div class="setting-item">' +
    '<div class="setting-label"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' +
    '<div class="setting-control"><select class="setting-select" id="' + id + '" data-key="' + key + '">' + opts + '</select></div>' +
  '</div>';
}
function stSlider(id, key, label, desc, min, max, step, unit) {
  var val = settingsDraft[key];
  return '<div class="setting-item">' +
    '<div class="setting-label"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' +
    '<div class="setting-control"><div class="setting-slider">' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-key="' + key + '" data-unit="' + unit + '" />' +
      '<span class="slider-value" id="' + id + 'Val">' + val + ' ' + unit + '</span>' +
    '</div></div>' +
  '</div>';
}
function stSeg(id, key, label, desc, segs) {
  var cur = settingsDraft[key];
  var btns = segs.map(function(sg) {
    return '<button type="button" class="seg-btn' + (String(cur) === String(sg.v) ? ' active' : '') + '" data-seg="' + id + '" data-val="' + settingsEsc(sg.v) + '">' + settingsEsc(sg.t) + '</button>';
  }).join('');
  return '<div class="setting-item">' +
    '<div class="setting-label"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' +
    '<div class="setting-control"><div class="seg-control" id="' + id + '" data-key="' + key + '">' + btns + '</div></div>' +
  '</div>';
}
function stSwatches(id, key, label, desc, colors) {
  var cur = settingsDraft[key] || 'green';
  var sw = colors.map(function(c) {
    return '<button type="button" class="color-swatch' + (cur === c.v ? ' active' : '') + '" data-swatch="' + id + '" data-val="' + c.v + '" title="' + settingsEsc(c.t) + '" style="background:' + c.hex + ';" aria-label="' + settingsEsc(c.t) + '"></button>';
  }).join('');
  return '<div class="setting-item">' +
    '<div class="setting-label"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' +
    '<div class="setting-control"><div class="color-swatches" id="' + id + '" data-key="' + key + '">' + sw + '</div></div>' +
  '</div>';
}
function stGroup(title, body) {
  return '<div class="settings-group"><div class="settings-group-title">' + title + '</div>' + body + '</div>';
}
function stAction(id, label, cls) {
  return '<button type="button" class="settings-action-btn ' + (cls || '') + '" id="' + id + '">' + label + '</button>';
}

/* ---------- 各分类面板 ---------- */
function buildGeneralPane() {
  var s = settingsDraft;
  var mirrorOpts = [
    { v: 0, t: '自动选择（智能测速）' },
    { v: 1, t: '镜像 1 (144449.xyz)' },
    { v: 2, t: '镜像 2 (IPv6)' },
    { v: 3, t: '镜像 3 (mirror)' },
    { v: 4, t: '镜像 4 (mirror-test)' },
    { v: 5, t: '镜像 5 (备用)' }
  ];
  return stGroup('启动',
    stSelect('setMirror', 'mirrorIndex', '首选镜像', '自动选择会在启动时测速并连接最快镜像', mirrorOpts) +
    stSeg('setEngine', 'enginePrefer', '默认引擎', 'WASM 性能更高，JS 兼容性更好；仅影响同时提供两种引擎的版本', [
      { v: 'auto', t: '自动' }, { v: 'wasm', t: 'WASM' }, { v: 'js', t: 'JS' }
    ]) +
    stToggle('setQuickLaunch', 'quickLaunch', '快速启动', '跳过镜像选择，直接启动') +
    stToggle('setPopup', 'popupLaunch', '弹窗启动', '在新窗口中启动游戏') +
    stToggle('setLoadingDetail', 'loadingDetail', '加载详情', '显示详细的加载步骤信息') +
    stToggle('setConfirmLaunch', 'confirmLaunch', '操作二次确认', '清除数据等危险操作前弹出确认')
  ) + stGroup('更新',
    stToggle('setAutoUpdate', 'autoUpdateCheck', '自动检查更新', '启动时检查启动器更新') +
    stToggle('setShowAnn', 'showAnnouncements', '显示更新公告', '启动时展示最新版本公告')
  );
}

function buildAppearancePane() {
  return stGroup('主题',
    stSeg('setTheme', 'theme', '界面主题', '深色模式护眼，跟随系统将自动匹配系统外观', [
      { v: 'light', t: '浅色' }, { v: 'dark', t: '深色' }, { v: 'system', t: '跟随系统' }
    ]) +
    stSwatches('setAccent', 'accentColor', '主题强调色', '按钮、开关、高亮等元素的颜色', [
      { v: 'green', t: '经典绿', hex: '#22c55e' },
      { v: 'blue', t: '海洋蓝', hex: '#3b82f6' },
      { v: 'purple', t: '梦幻紫', hex: '#8b5cf6' },
      { v: 'orange', t: '活力橙', hex: '#f59e0b' },
      { v: 'pink', t: '樱花粉', hex: '#ec4899' }
    ]) +
    stToggle('setGlass', 'glassBlur', '毛玻璃效果', '关闭后界面使用纯色背景（低性能设备推荐）') +
    stToggle('setBgImage', 'bgImage', '背景图片', '显示 Minecraft 风景背景')
  ) + stGroup('排版',
    stSelect('setFontSize', 'fontSize', '字体大小', '调整界面文字大小', [
      { v: 'small', t: '小' }, { v: 'normal', t: '正常' }, { v: 'large', t: '大' }, { v: 'xlarge', t: '特大' }
    ]) +
    stSelect('setDensity', 'cardDensity', '卡片密度', '版本卡片的间距和大小', [
      { v: 'compact', t: '紧凑' }, { v: 'comfortable', t: '舒适' }, { v: 'spacious', t: '宽松' }
    ]) +
    stToggle('setReduceMotion', 'reduceMotion', '减少动态效果', '关闭界面动画和过渡效果')
  );
}

function buildPerformancePane() {
  return stGroup('性能',
    stSlider('setMemory', 'memoryLimit', '内存分配上限', '游戏可使用的最大内存', 256, 4096, 128, 'MB') +
    stSelect('setGpu', 'gpuPrefer', 'GPU 偏好', '选择图形处理器模式', [
      { v: 'high-performance', t: '高性能独立显卡' }, { v: 'default', t: '默认' }, { v: 'low-power', t: '节能模式' }
    ]) +
    stToggle('setAutoClean', 'autoClean', '启动前内存优化', '启动游戏前自动清理内存')
  ) + stGroup('手动优化',
    '<div class="settings-info-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
      '<div><div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">手动内存优化</div><small style="color:var(--text-muted);">立即执行内存释放和垃圾回收</small></div>' +
      '<button type="button" class="settings-action-btn accent" id="manualOptBtn" style="width:auto;margin-top:0;padding:8px 18px;">执行优化</button>' +
    '</div>' +
    '<div class="info-status" id="manualOptStatus"></div>'
  );
}

function buildStoragePane() {
  return stGroup('存档与缓存',
    stToggle('setSaveIso', 'saveIsolation', '存档隔离', '每个版本使用独立的存档空间') +
    stToggle('setSaveReminder', 'saveReminder', '存档备份提醒', '定期提醒备份游戏存档，避免浏览器清理导致丢失') +
    stSlider('setCacheLimit', 'cacheSizeLimit', '缓存上限', '游戏文件本地缓存大小限制', 512, 8192, 256, 'MB')
  ) + stGroup('缓存信息',
    '<div class="settings-info-card">' +
      '<div class="info-row"><span>已用缓存</span><strong id="cacheSizeText">读取中…</strong></div>' +
      '<div class="info-row"><span>缓存文件</span><strong id="cacheFileCount">读取中…</strong></div>' +
    '</div>' +
    '<div class="settings-btn-row">' +
      stAction('clearCacheBtn', '清除游戏缓存') +
      stAction('refreshCacheBtn', '刷新统计') +
    '</div>' +
    stAction('clearSaveBtn', '清除所有存档', 'danger')
  );
}

function buildPluginsPane() {
  var listHtml = '<div class="settings-info-card" style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:20px;">暂无已安装插件</div>';
  try {
    if (window.MCJS_REGISTRY) {
      var installed = window.MCJS_REGISTRY.listUserInstalled ? window.MCJS_REGISTRY.listUserInstalled() : window.MCJS_REGISTRY.list();
      var official = window.MCJS_REGISTRY.listOfficial ? window.MCJS_REGISTRY.listOfficial() : [];
      var all = (official || []).concat(installed || []);
      var seen = {};
      var rows = [];
      all.forEach(function(p) {
        if (!p || seen[p.id]) return;
        seen[p.id] = true;
        var isInstalled = window.MCJS_REGISTRY.isInstalled(p.id);
        var isEnabled = window.MCJS_REGISTRY.isEnabled(p.id);
        if (!isInstalled) return;
        rows.push(
          '<div class="settings-plugin-row" data-pid="' + settingsEsc(p.id) + '">' +
            '<div class="spr-name">' + settingsEsc(p.name) + ' <span class="spr-ver">v' + settingsEsc(p.version) + '</span></div>' +
            '<button type="button" class="toggle' + (isEnabled ? ' on' : '') + '" data-plugin-toggle="' + settingsEsc(p.id) + '" role="switch" aria-checked="' + (isEnabled ? 'true' : 'false') + '" style="transform:scale(0.85);"></button>' +
          '</div>'
        );
      });
      if (rows.length) {
        listHtml = '<div class="settings-plugin-list">' + rows.join('') + '</div>';
      }
    }
  } catch (e) { console.warn('[MCJS] settings plugin list failed:', e); }

  return stGroup('插件管理',
    '<div class="setting-item" style="border-top:none;">' +
      '<div class="setting-label"><span>已安装插件</span><small>快速开关已安装的插件，完整管理请前往插件市场</small></div>' +
      '<div class="setting-control"><button type="button" class="settings-action-btn accent" id="openMarketFromSettings" style="width:auto;margin-top:0;padding:7px 16px;">打开插件市场</button></div>' +
    '</div>' +
    listHtml
  ) + stGroup('插件偏好',
    stToggle('setPluginAutoCheck', 'pluginAutoCheck', '自动检查插件更新', '启动时自动检查已安装插件的更新')
  );
}

function buildPrivacyPane() {
  return stGroup('通知',
    stToggle('setSound', 'soundEnabled', '界面音效', '按钮点击、弹窗等操作反馈音') +
    stSlider('setVolume', 'soundVolume', '界面音量', '调整操作反馈音的音量', 0, 100, 5, '%') +
    stToggle('setShowAnn2', 'showAnnouncements', '更新公告弹窗', '新版本发布时在首页展示公告')
  ) + stGroup('隐私与重置',
    stToggle('setConfirmLaunch2', 'confirmLaunch', '危险操作确认', '清除存档 / 缓存前要求确认') +
    stAction('resetOsGateBtn', '重置系统兼容性提示') +
    stAction('resetAnnounceBtn', '重置更新公告提示') +
    stAction('resetAllTipsBtn', '重置所有“不再提示”') +
    stAction('resetSettingsBtn', '恢复全部默认设置', 'danger')
  );
}

function buildDebugPane() {
  return stGroup('工程调试',
    stToggle('setDebug', 'debugMode', '调试模式', '显示详细错误信息和调用栈') +
    stToggle('setVerbose', 'verboseLog', '详细日志', '输出所有加载步骤和钩子调用日志') +
    stToggle('setNoCache', 'disableCache', '禁用缓存', '每次启动重新下载游戏文件（测试用）') +
    stToggle('setFpsOverlay', 'showDebugOverlay', '调试浮层', '在游戏画面上显示 FPS 和性能信息') +
    stToggle('setTestMode', 'testMode', '测试模式', '开发调试预留（正式版不启用测试镜像）')
  );
}

function buildAboutPane() {
  return stGroup('浏览器与设备信息',
    '<div class="settings-info-card" id="browserInfo" style="font-family:var(--font-mono);font-size:0.76rem;">' +
      '<div class="info-row"><span>浏览器</span><strong id="biBrowser">检测中…</strong></div>' +
      '<div class="info-row"><span>内核</span><strong id="biEngine">检测中…</strong></div>' +
      '<div class="info-row"><span>操作系统</span><strong id="biOS">检测中…</strong></div>' +
      '<div class="info-row"><span>平台</span><strong id="biPlatform">检测中…</strong></div>' +
      '<div class="info-row"><span>屏幕分辨率</span><strong id="biScreen">检测中…</strong></div>' +
      '<div class="info-row"><span>CPU 核心</span><strong id="biCores">检测中…</strong></div>' +
      '<div class="info-row"><span>设备内存</span><strong id="biMem">检测中…</strong></div>' +
      '<div class="info-row"><span>语言</span><strong id="biLang">检测中…</strong></div>' +
      '<div class="info-row"><span>触摸支持</span><strong id="biTouch">检测中…</strong></div>' +
      '<div class="info-row"><span>WebAssembly</span><strong id="biWasm">检测中…</strong></div>' +
      '<div class="info-row"><span>WebGL / WebGL2</span><strong id="biWebGL">检测中…</strong></div>' +
      '<div class="info-row"><span>GPU</span><strong id="biGPU">检测中…</strong></div>' +
      '<div class="info-row"><span>Cookie / 在线</span><strong id="biCookie">检测中…</strong></div>' +
      '<div class="info-row" style="align-items:flex-start;"><span>User Agent</span><strong id="biUA" style="word-break:break-all;font-size:0.68rem;line-height:1.5;text-align:right;max-width:65%;">检测中…</strong></div>' +
    '</div>' +
    stAction('copyBrowserInfoBtn', '复制环境信息')
  ) + stGroup('关于 MCJS Launcher',
    '<div class="settings-info-card">' +
      '<div class="info-row"><span>启动器版本</span><strong>v1.5.1</strong></div>' +
      '<div class="info-row"><span>项目性质</span><strong>社区启动器</strong></div>' +
      '<div class="info-row"><span>游戏内核</span><strong>Eaglercraft</strong></div>' +
    '</div>' +
    '<div class="settings-btn-row">' +
      stAction('openHelpBtn', '打开帮助中心') +
      stAction('openAnnHistoryBtn2', '查看历代更新公告') +
    '</div>'
  );
}

var SETTINGS_PANES = {
  general: { title: '常规', build: buildGeneralPane },
  appearance: { title: '外观', build: buildAppearancePane },
  performance: { title: '性能', build: buildPerformancePane },
  storage: { title: '存储', build: buildStoragePane },
  plugins: { title: '插件', build: buildPluginsPane },
  privacy: { title: '通知与隐私', build: buildPrivacyPane },
  debug: { title: '高级调试', build: buildDebugPane },
  about: { title: '关于 / 环境', build: buildAboutPane }
};

var settingsCurrentPane = 'general';

function renderSettingsPane(name) {
  var content = document.getElementById('settingsContent');
  if (!content) return;
  var pane = SETTINGS_PANES[name];
  if (!pane) return;
  settingsCurrentPane = name;
  content.innerHTML = '<div class="settings-pane active">' + pane.build() + '</div>';
  var navItems = document.querySelectorAll('#settingsNav .settings-nav-item');
  navItems.forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-pane') === name);
  });
  bindSettingsControls(content);
  if (name === 'storage') requestCacheInfo(true);
  if (name === 'about') detectBrowserInfo();
  if (name === 'plugins') bindPluginQuickToggles();
}

/* ---------- 控件绑定 ---------- */
function markSettingsDirty() {
  settingsDirty = true;
  var hint = document.getElementById('settingsSaveHint');
  if (hint) { hint.textContent = '有未保存的更改'; hint.classList.add('dirty'); }
}
function clearSettingsDirty() {
  settingsDirty = false;
  var hint = document.getElementById('settingsSaveHint');
  if (hint) { hint.textContent = ''; hint.classList.remove('dirty'); }
}

function bindSettingsControls(root) {
  // 开关
  root.querySelectorAll('.toggle[data-key]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = btn.getAttribute('data-key');
      var next = !btn.classList.contains('on');
      btn.classList.toggle('on', next);
      btn.setAttribute('aria-checked', next ? 'true' : 'false');
      settingsDraft[key] = next;
      markSettingsDirty();
      applyLivePreview(key, next);
      if (sound) sound.toggle();
    });
  });
  // 下拉
  root.querySelectorAll('select.setting-select').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var key = sel.getAttribute('data-key');
      var val = sel.value;
      if (key === 'mirrorIndex') val = parseInt(val, 10) || 0;
      settingsDraft[key] = val;
      markSettingsDirty();
      applyLivePreview(key, val);
    });
  });
  // 滑杆
  root.querySelectorAll('input[type="range"][data-key]').forEach(function(r) {
    r.addEventListener('input', function() {
      var key = r.getAttribute('data-key');
      var unit = r.getAttribute('data-unit') || '';
      // 所有滑杆均按滑块原始量纲存储(音量为 0~100 百分比,内存/缓存为 MB)
      var val = parseInt(r.value, 10);
      var valEl = document.getElementById(r.id + 'Val');
      if (valEl) valEl.textContent = val + ' ' + unit;
      settingsDraft[key] = val;
      markSettingsDirty();
      applyLivePreview(key, val);
    });
  });
  // 分段选择
  root.querySelectorAll('.seg-control').forEach(function(seg) {
    var key = seg.getAttribute('data-key');
    seg.querySelectorAll('.seg-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        seg.querySelectorAll('.seg-btn').forEach(function(x) { x.classList.remove('active'); });
        b.classList.add('active');
        settingsDraft[key] = b.getAttribute('data-val');
        markSettingsDirty();
        applyLivePreview(key, b.getAttribute('data-val'));
        if (sound) sound.click();
      });
    });
  });
  // 主题色色板
  root.querySelectorAll('.color-swatches').forEach(function(swc) {
    var key = swc.getAttribute('data-key');
    swc.querySelectorAll('.color-swatch').forEach(function(sw) {
      sw.addEventListener('click', function() {
        swc.querySelectorAll('.color-swatch').forEach(function(x) { x.classList.remove('active'); });
        sw.classList.add('active');
        settingsDraft[key] = sw.getAttribute('data-val');
        markSettingsDirty();
        applyLivePreview(key, sw.getAttribute('data-val'));
        if (sound) sound.click();
      });
    });
  });
}

/* 外观类设置即时预览 */
function applyLivePreview(key, val) {
  var preview = Object.assign({}, settings, settingsDraft);
  if (key === 'theme') { applyThemeMode(val); return; }
  if (key === 'accentColor') { applyAccentColor(val); return; }
  if (key === 'glassBlur') { applyGlass(val); return; }
  if (key === 'bgImage') {
    if (val === false) document.body.classList.add('no-bg');
    else document.body.classList.remove('no-bg');
    return;
  }
  if (key === 'reduceMotion') {
    if (val === true) document.body.classList.add('no-anim');
    else document.body.classList.remove('no-anim');
    return;
  }
  if (key === 'fontSize') {
    var sizeMap = { 'small': '14px', 'normal': '16px', 'large': '18px', 'xlarge': '20px' };
    document.documentElement.style.fontSize = sizeMap[val] || '16px';
    return;
  }
  if (key === 'cardDensity') {
    document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    if (val !== 'comfortable') document.body.classList.add('density-' + val);
    var gapMap = { 'compact': '8px', 'comfortable': '14px', 'spacious': '20px' };
    var padMap = { 'compact': '12px 14px 10px', 'comfortable': '18px 20px 14px', 'spacious': '24px 26px 18px' };
    document.documentElement.style.setProperty('--card-gap', gapMap[val] || '14px');
    document.documentElement.style.setProperty('--card-padding', padMap[val] || '18px 20px 14px');
    return;
  }
  if (key === 'soundEnabled') { if (sound) sound.setEnabled(val !== false); return; }
  if (key === 'soundVolume') {
    if (sound) {
      sound.setVolume(Math.max(0, Math.min(1, val / 100)));
      sound.unlock(); sound.hover();
    }
    return;
  }
}

/* ---------- 缓存信息 ---------- */
function requestCacheInfo(once) {
  if (window.MCJS_GAME && window.MCJS_GAME.getCacheSize) {
    window.MCJS_GAME.getCacheSize().then(function(info) {
      var sizeText = window.MCJS_GAME.formatBytes ? window.MCJS_GAME.formatBytes(info.bytes) : (info.bytes + ' B');
      var sizeEl = document.getElementById('cacheSizeText');
      var countEl = document.getElementById('cacheFileCount');
      if (sizeEl) sizeEl.textContent = sizeText;
      if (countEl) countEl.textContent = (info.count != null ? info.count : 0) + ' 个文件';
    }).catch(function() {
      var sizeEl = document.getElementById('cacheSizeText');
      var countEl = document.getElementById('cacheFileCount');
      if (sizeEl) sizeEl.textContent = '无法读取';
      if (countEl) countEl.textContent = '0 个文件';
    });
  }
}

/* ---------- 浏览器信息检测 ---------- */
function detectBrowserInfo() {
  if (window._mcjsSettingsBrowserInfo) { fillBrowserInfo(window._mcjsSettingsBrowserInfo); return; }
  var ua = navigator.userAgent || '';
  var browser = '未知', engine = '未知';
  if (/Edg\/(\d+)/.test(ua)) { browser = 'Edge ' + RegExp.$1; engine = 'Blink'; }
  else if (/OPR\/(\d+)/.test(ua)) { browser = 'Opera ' + RegExp.$1; engine = 'Blink'; }
  else if (/Chrome\/(\d+)/.test(ua)) { browser = 'Chrome ' + RegExp.$1; engine = 'Blink'; }
  else if (/Firefox\/(\d+)/.test(ua)) { browser = 'Firefox ' + RegExp.$1; engine = 'Gecko'; }
  else if (/Safari\/(\d+)/.test(ua)) { browser = 'Safari ' + RegExp.$1; engine = 'WebKit'; }
  var os = '未知';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
  else if (/Mac OS X ([\d_]+)/.test(ua)) os = 'macOS ' + RegExp.$1.replace(/_/g, '.');
  else if (/Android (\d+)/.test(ua)) os = 'Android ' + RegExp.$1;
  else if (/iPhone OS (\d+)/.test(ua)) os = 'iOS ' + RegExp.$1;
  else if (/Linux/.test(ua)) os = 'Linux';
  var platform = navigator.platform || '未知';
  var screen = (window.screen ? window.screen.width + ' × ' + window.screen.height : '未知') + ' @ ' + (window.devicePixelRatio || 1) + 'x';
  var cores = navigator.hardwareConcurrency || '未知';
  var mem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '未知';
  var lang = navigator.language || '未知';
  var touch = ('ontouchstart' in window) ? '支持' : '不支持';
  var wasm = (typeof WebAssembly !== 'undefined') ? '支持' : '不支持';
  var webgl = '不支持', webgl2 = '不支持', gpu = '未知';
  try {
    var c = document.createElement('canvas').getContext('webgl');
    if (c) { webgl = '支持'; var dbg = c.getExtension('WEBGL_debug_renderer_info'); if (dbg) gpu = c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '未知'; }
  } catch (e) {}
  try {
    var c2 = document.createElement('canvas').getContext('webgl2');
    if (c2) webgl2 = '支持';
  } catch (e) {}
  var info = {
    browser: browser, engine: engine, os: os, platform: platform, screen: screen,
    cores: cores, mem: mem, lang: lang, touch: touch, wasm: wasm,
    webgl: webgl + ' / ' + webgl2, gpu: gpu,
    cookie: (navigator.cookieEnabled ? '启用' : '禁用') + ' / ' + (navigator.onLine ? '在线' : '离线'),
    ua: ua
  };
  window._mcjsSettingsBrowserInfo = info;
  fillBrowserInfo(info);
}
function fillBrowserInfo(info) {
  var map = { biBrowser: 'browser', biEngine: 'engine', biOS: 'os', biPlatform: 'platform', biScreen: 'screen', biCores: 'cores', biMem: 'mem', biLang: 'lang', biTouch: 'touch', biWasm: 'wasm', biWebGL: 'webgl', biGPU: 'gpu', biCookie: 'cookie', biUA: 'ua' };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = info[map[id]];
  });
}

/* ---------- 插件快速开关 ---------- */
function bindPluginQuickToggles() {
  var content = document.getElementById('settingsContent');
  if (!content || !window.MCJS_REGISTRY) return;
  content.querySelectorAll('[data-plugin-toggle]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pid = btn.getAttribute('data-plugin-toggle');
      try {
        if (window.MCJS_REGISTRY.isEnabled(pid)) {
          window.MCJS_REGISTRY.disable(pid);
          btn.classList.remove('on');
          btn.setAttribute('aria-checked', 'false');
          settingsToast('已禁用插件', 'info');
        } else {
          window.MCJS_REGISTRY.enable(pid);
          btn.classList.add('on');
          btn.setAttribute('aria-checked', 'true');
          settingsToast('已启用插件', 'success');
        }
        if (sound) sound.toggle();
      } catch (e) {
        settingsToast('操作失败: ' + e.message, 'error');
      }
    });
  });
}

/* ---------- 保存 / 重置 / 导入导出 ---------- */
function saveSettingsFromModal() {
  settings = ensureSettingsDefaults(settingsDraft);
  window.MCJS_SETTINGS = settings;
  try { window.MCJS_SAVE_SETTINGS(settings); } catch (e) {}
  // 触发插件钩子（hook 文档承诺了 settings:save）
  try {
    if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
      window.MCJS_PLUGIN_API._internal.runHook('settings:save', settings);
    }
  } catch (e) {}
  applyAllSettings();
  clearSettingsDirty();
  settingsToast('设置已保存', 'success');
  closeSettingsModal(true);
}

function applyAllSettings() {
  applyBackground();
  applyTheme();
  applyFontSize();
  applyCardDensity();
  applyThemeMode(settings.theme || 'light');
  applyAccentColor(settings.accentColor || 'green');
  applyGlass(settings.glassBlur !== false);
  if (sound) {
    sound.setEnabled(settings.soundEnabled !== false);
    sound.setVolume(settings.soundVolume == null ? 0.7 : Math.max(0, Math.min(1, settings.soundVolume / 100)));
  }
  // 通知系统主题变化（供插件使用）
  try {
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('settings:updated', settings);
  } catch (e) {}
}

function resetAllSettings() {
  if (!confirmAction('确定恢复全部默认设置吗？')) return;
  settingsDraft = Object.assign({}, DEFAULT_APP_SETTINGS);
  settings = ensureSettingsDefaults(settingsDraft);
  window.MCJS_SETTINGS = settings;
  try { window.MCJS_SAVE_SETTINGS(settings); } catch (e) {}
  applyAllSettings();
  renderSettingsPane(settingsCurrentPane);
  clearSettingsDirty();
  settingsToast('已恢复默认设置', 'success');
}

function confirmAction(msg) {
  if (settingsDraft && settingsDraft.confirmLaunch === false) return true;
  return confirm(msg);
}

function exportSettings() {
  try {
    var data = JSON.stringify({ type: 'mcjs-settings', version: 1, settings: settingsDraft || settings }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mcjs-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    settingsToast('配置已导出', 'success');
  } catch (e) {
    settingsToast('导出失败: ' + e.message, 'error');
  }
}

function importSettings(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      var incoming = data && data.settings ? data.settings : data;
      if (!incoming || typeof incoming !== 'object') throw new Error('文件格式不正确');
      settingsDraft = ensureSettingsDefaults(Object.assign({}, DEFAULT_APP_SETTINGS, incoming));
      // 应用外观预览
      applyThemeMode(settingsDraft.theme);
      applyAccentColor(settingsDraft.accentColor);
      applyGlass(settingsDraft.glassBlur);
      renderSettingsPane(settingsCurrentPane);
      markSettingsDirty();
      settingsToast('配置已导入，点击「保存设置」生效', 'success');
    } catch (err) {
      settingsToast('导入失败: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* ---------- 打开 / 关闭 ---------- */
function openSettingsWindow() {
  if (!settingsModalEl) return;
  settingsDraft = Object.assign({}, ensureSettingsDefaults(settings || {}));
  clearSettingsDirty();
  try {
    if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
      window.MCJS_PLUGIN_API._internal.runHook('settings:open', settingsDraft);
    }
  } catch (e) {}
  if (sound) { sound.unlock(); sound.open(); }
  renderSettingsPane('general');
  settingsModalEl.classList.add('active');
  // 启动缓存信息轮询
  if (settingsCacheTimer) clearInterval(settingsCacheTimer);
  settingsCacheTimer = setInterval(function() {
    if (settingsModalEl.classList.contains('active') && settingsCurrentPane === 'storage') {
      requestCacheInfo(true);
    }
  }, 4000);
}

function closeSettingsModal(skipConfirm) {
  if (!settingsModalEl) return;
  if (!skipConfirm && settingsDirty) {
    if (!confirm('有未保存的更改，确定要关闭吗？')) return;
  }
  settingsModalEl.classList.remove('active');
  if (settingsCacheTimer) { clearInterval(settingsCacheTimer); settingsCacheTimer = null; }
  // 关闭后恢复为已保存的外观
  applyAllSettings();
  if (sound) sound.close();
}

/* ---------- 事件绑定 ---------- */
(function bindSettingsModal() {
  // 左侧导航
  var nav = document.getElementById('settingsNav');
  if (nav) {
    nav.querySelectorAll('.settings-nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var pane = item.getAttribute('data-pane');
        if (sound) sound.click();
        renderSettingsPane(pane);
      });
    });
  }

  // 顶栏设置按钮
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsWindow);
  }

  // 关闭按钮 / 遮罩 / 取消
  var closeBtn = document.getElementById('settingsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', function() { closeSettingsModal(false); });
  var cancelBtn = document.getElementById('settingsCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { closeSettingsModal(false); });
  if (settingsModalEl) {
    settingsModalEl.addEventListener('click', function(e) {
      if (e.target === settingsModalEl) closeSettingsModal(false);
    });
  }
  var saveBtn = document.getElementById('settingsSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', function() {
    if (sound) sound.click();
    saveSettingsFromModal();
  });

  // 底部：恢复默认 / 导出 / 导入
  var resetBtn = document.getElementById('settingsResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetAllSettings);
  var exportBtn = document.getElementById('settingsExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportSettings);
  var importBtn = document.getElementById('settingsImportBtn');
  var importFile = document.getElementById('settingsImportFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function() { importFile.click(); });
    importFile.addEventListener('change', function() {
      if (importFile.files && importFile.files[0]) importSettings(importFile.files[0]);
      importFile.value = '';
    });
  }

  // 面板内按钮（事件委托）
  document.getElementById('settingsContent') && document.getElementById('settingsContent').addEventListener('click', function(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    var id = t.id;
    if (id === 'manualOptBtn') {
      t.disabled = true;
      t.textContent = '优化中…';
      var st = document.getElementById('manualOptStatus');
      if (st) st.textContent = '正在释放内存…';
      if (window.MCJS_GAME && window.MCJS_GAME.manualOptimize) {
        window.MCJS_GAME.manualOptimize(
          function(text, pct) { if (st) st.textContent = text + ' (' + pct + '%)'; },
          function() {
            t.disabled = false; t.textContent = '执行优化';
            if (st) st.textContent = '优化完成';
            settingsToast('内存优化完成', 'success');
            setTimeout(function() { if (st) st.textContent = ''; }, 3000);
          }
        );
      } else {
        t.disabled = false; t.textContent = '执行优化';
        if (st) st.textContent = '游戏模块未就绪';
        settingsToast('暂时无法执行内存优化', 'error');
      }
      return;
    }
    if (id === 'clearCacheBtn') {
      if (!confirmAction('确定要清除所有游戏缓存吗？')) return;
      if (window.MCJS_GAME && window.MCJS_GAME.clearCache) {
        window.MCJS_GAME.clearCache().then(function() {
          settingsToast('缓存已清除', 'success');
          setTimeout(function() { requestCacheInfo(true); }, 600);
        });
      } else {
        settingsToast('游戏模块未就绪', 'error');
      }
      return;
    }
    if (id === 'refreshCacheBtn') { requestCacheInfo(true); return; }
    if (id === 'clearSaveBtn') {
      if (!confirmAction('确定要清除所有存档吗？此操作不可恢复！')) return;
      if (window.MCJS_GAME && window.MCJS_GAME.clearSaveData) {
        window.MCJS_GAME.clearSaveData().then(function() {
          settingsToast('存档已清除', 'success');
        });
      } else {
        settingsToast('游戏模块未就绪', 'error');
      }
      return;
    }
    if (id === 'openMarketFromSettings') {
      closeSettingsModal(true);
      setTimeout(function() {
        if (window.MCJS_PLUGIN_MARKET) window.MCJS_PLUGIN_MARKET.open();
        else settingsToast('插件市场尚未加载', 'error');
      }, 200);
      return;
    }
    if (id === 'copyBrowserInfoBtn') {
      var info = window._mcjsSettingsBrowserInfo || {};
      var text = Object.keys(info).map(function(k) { return k + ': ' + info[k]; }).join('\n');
      try {
        navigator.clipboard.writeText(text).then(function() { settingsToast('已复制到剪贴板', 'success'); })
          .catch(function() { settingsToast('复制失败', 'error'); });
      } catch (err) { settingsToast('复制失败', 'error'); }
      return;
    }
    if (id === 'openHelpBtn') {
      closeSettingsModal(true);
      setTimeout(function() {
        var hm = document.getElementById('helpModal');
        if (hm) hm.style.display = 'flex';
      }, 200);
      return;
    }
    if (id === 'openAnnHistoryBtn2') {
      if (window.MCJS_OPEN_ANN_HISTORY) window.MCJS_OPEN_ANN_HISTORY();
      else settingsToast('公告功能未就绪', 'error');
      return;
    }
    if (id === 'resetOsGateBtn') {
      try {
        localStorage.removeItem('mcjs_os_gate_ack');
        settingsToast('已重置系统兼容性提示，刷新后生效', 'success');
      } catch (err) { settingsToast('重置失败', 'error'); }
      return;
    }
    if (id === 'resetAnnounceBtn') {
      try {
        Object.keys(localStorage).filter(function(k) { return k.indexOf('mcjs_announce_') === 0; })
          .forEach(function(k) { localStorage.removeItem(k); });
        settingsToast('已重置公告提示，刷新后生效', 'success');
      } catch (err) { settingsToast('重置失败', 'error'); }
      return;
    }
    if (id === 'resetAllTipsBtn') {
      if (!confirmAction('确定重置所有"不再提示"类设置吗？')) return;
      try {
        Object.keys(localStorage).filter(function(k) {
          return k.indexOf('mcjs_announce_') === 0 || k === 'mcjs_os_gate_ack';
        }).forEach(function(k) { localStorage.removeItem(k); });
        settingsToast('已重置全部提示，刷新后生效', 'success');
      } catch (err) { settingsToast('重置失败', 'error'); }
      return;
    }
    if (id === 'resetSettingsBtn') { resetAllSettings(); return; }
  });

  // ESC 关闭
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && settingsModalEl && settingsModalEl.classList.contains('active')) {
      // 若插件市场等其他弹窗在最上层，不处理
      closeSettingsModal(false);
    }
  });

  // 系统主题变化监听
  if (window.matchMedia) {
    _systemDarkMql = window.matchMedia('(prefers-color-scheme: dark)');
    var handler = function() {
      if ((settingsDraft ? settingsDraft.theme : settings.theme) === 'system') {
        applyThemeMode('system');
      }
    };
    if (_systemDarkMql.addEventListener) _systemDarkMql.addEventListener('change', handler);
    else if (_systemDarkMql.addListener) _systemDarkMql.addListener(handler);
  }
})();

/* 兼容旧的弹窗设置通信（外部页面若以 postMessage 通信，忽略即可） */
window.addEventListener('message', function(e) {
  if (!e.data) return;
  var data = e.data;
  if (data.type === 'settings-updated' && data.settings) {
    // 来自旧版弹窗窗口的消息（理论上不再产生），做兜底合并
    var ns = ensureSettingsDefaults(data.settings);
    window.MCJS_SETTINGS = ns;
    settings = ns;
    try { window.MCJS_SAVE_SETTINGS(ns); } catch (err) {}
    applyAllSettings();
  }
  // 旧弹窗请求缓存信息 / 清除数据的兼容响应
  if (data.type === 'get-cache-info' && window.MCJS_GAME && window.MCJS_GAME.getCacheSize) {
    window.MCJS_GAME.getCacheSize().then(function(info) {
      try {
        e.source.postMessage({ type: 'cache-info-response', sizeText: window.MCJS_GAME.formatBytes(info.bytes), count: info.count }, '*');
      } catch (ex) {}
    }).catch(function() {
      try { e.source.postMessage({ type: 'cache-info-response', sizeText: '无法读取', count: 0 }, '*'); } catch (ex) {}
    });
  }
  if (data.type === 'clear-cache' && window.MCJS_GAME && window.MCJS_GAME.clearCache) {
    window.MCJS_GAME.clearCache();
  }
  if (data.type === 'clear-save' && window.MCJS_GAME && window.MCJS_GAME.clearSaveData) {
    window.MCJS_GAME.clearSaveData();
  }
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

  if(e.key === '?' || (e.key === '/' && e.shiftKey)){
    if(e.ctrlKey || e.metaKey){
      e.preventDefault();
      var hm = document.getElementById('helpModal');
      if(hm) hm.style.display = hm.style.display === 'none' ? 'flex' : 'none';
    }
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
    var hm2 = document.getElementById('helpModal');
    if(hm2 && hm2.style.display !== 'none') hm2.style.display = 'none';
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

/* ========== 更新公告(动态渲染 + 历代历史) ========== */
function getLatestAnnouncement() {
  if (window.MCJS_GET_LATEST_ANNOUNCEMENT) {
    try { return window.MCJS_GET_LATEST_ANNOUNCEMENT(); } catch (e) {}
  }
  return { version: 'v1.5.1', date: '', title: '更新公告', items: [] };
}

function getAllAnnouncements() {
  if (window.MCJS_GET_ALL_ANNOUNCEMENTS) {
    try { return window.MCJS_GET_ALL_ANNOUNCEMENTS(); } catch (e) {}
  }
  return [ getLatestAnnouncement() ];
}

function renderAnnouncementHTML(list) {
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var items = '';
    var itemsArr = a.items || [];
    for (var j = 0; j < itemsArr.length; j++) {
      var it = itemsArr[j];
      var tag = it.tag || '';
      var cls = 'ann-tag-other';
      if (tag === '修复') cls = 'ann-tag-fix';
      else if (tag === '新增' || tag === '首发') cls = 'ann-tag-new';
      else if (tag === '优化') cls = 'ann-tag-opt';
      items += '<li><span class="ann-tag ' + cls + '">' + escapeAnn(tag) + '</span>' + it.text + '</li>';
    }
    html += '<div class="ann-entry">' +
      '<div class="ann-entry-head"><span class="ann-entry-version">' + escapeAnn(a.version) + '</span>' +
      (a.date ? '<span class="ann-entry-date">' + escapeAnn(a.date) + '</span>' : '') +
      '</div>' +
      '<h3 class="ann-entry-title">' + escapeAnn(a.title) + '</h3>' +
      '<ul class="ann-entry-list">' + items + '</ul>' +
      (i < list.length - 1 ? '<div class="ann-entry-divider"></div>' : '') +
      '</div>';
  }
  return html;
}

function escapeAnn(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showAnnouncement() {
  var latest = getLatestAnnouncement();
  // 永久关闭 key 与公告版本绑定:新版本发布后会再次展示
  var ANNOUNCE_KEY = 'mcjs_announce_closed_' + latest.version;
  var ANNOUNCE_TODAY_KEY = 'mcjs_announce_today_' + latest.version;
  var READ_TIME = 3;

  try {
    var forever = localStorage.getItem(ANNOUNCE_KEY);
    if (forever === 'closed') return;
    var today = localStorage.getItem(ANNOUNCE_TODAY_KEY);
    var todayStr = new Date().toDateString();
    if (today === todayStr) return;
  } catch (e) { /* localStorage 不可用时仍展示 */ }

  var modal = document.getElementById('announceModal');
  if (!modal) return;

  // 动态填充最新公告内容
  var contentEl = document.getElementById('announceContent');
  if (contentEl) contentEl.innerHTML = renderAnnouncementHTML([ latest ]);
  var tagEl = document.getElementById('announceVersionTag');
  if (tagEl) tagEl.textContent = latest.version;

  modal.style.display = 'flex';

  var timerEl = document.getElementById('announceTimer');
  var btnToday = document.getElementById('announceCloseToday');
  var btnForever = document.getElementById('announceCloseForever');
  if (!timerEl || !btnToday || !btnForever) return;

  // 重置按钮状态(防止重复绑定)
  btnToday.disabled = true;
  btnForever.disabled = true;
  timerEl.classList.remove('ready');

  var countdown = READ_TIME;
  timerEl.textContent = '请阅读 ' + countdown + ' 秒后可关闭…';
  if (window._mcjsAnnounceTimer) clearInterval(window._mcjsAnnounceTimer);

  window._mcjsAnnounceTimer = setInterval(function() {
    countdown--;
    if (countdown > 0) {
      timerEl.textContent = '请阅读 ' + countdown + ' 秒后可关闭…';
    } else {
      clearInterval(window._mcjsAnnounceTimer);
      window._mcjsAnnounceTimer = null;
      timerEl.textContent = '可以关闭了';
      timerEl.classList.add('ready');
      btnToday.disabled = false;
      btnForever.disabled = false;
    }
  }, 1000);

  if (!btnToday._mcjsBound) {
    btnToday._mcjsBound = true;
    btnToday.addEventListener('click', function() {
      if (btnToday.disabled) return;
      try { localStorage.setItem(ANNOUNCE_TODAY_KEY, new Date().toDateString()); } catch (e) {}
      modal.style.display = 'none';
    });
  }
  if (!btnForever._mcjsBound) {
    btnForever._mcjsBound = true;
    btnForever.addEventListener('click', function() {
      if (btnForever.disabled) return;
      try { localStorage.setItem(ANNOUNCE_KEY, 'closed'); } catch (e) {}
      modal.style.display = 'none';
    });
  }

  // "查看历代所有公告"链接
  var histLink = document.getElementById('announceHistoryLink');
  if (histLink && !histLink._mcjsBound) {
    histLink._mcjsBound = true;
    histLink.addEventListener('click', function() {
      modal.style.display = 'none';
      openAnnouncementHistory();
    });
  }

  // ESC 关闭
  if (!window._mcjsAnnEscBound) {
    window._mcjsAnnEscBound = true;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        if (!btnToday.disabled) modal.style.display = 'none';
      }
    });
  }
}

/* 历代公告弹窗(主页面) */
function openAnnouncementHistory() {
  var overlay = document.getElementById('annHistoryModal');
  if (!overlay) return;
  var body = document.getElementById('annHistoryBody');
  if (body) body.innerHTML = renderAnnouncementHTML(getAllAnnouncements());
  overlay.style.display = 'flex';
  if (overlay._mcjsBound) return;
  overlay._mcjsBound = true;
  var close = function() { overlay.style.display = 'none'; };
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });
  var closeBtn = document.getElementById('annHistoryClose');
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.style.display === 'flex') close();
  });
}

/* ========== v1.5 附加功能 ========== */
// 存档备份提醒：每 30 天提醒一次（可在设置中关闭）
function maybeRemindBackup() {
  try {
    if (settings.saveReminder === false) return;
    var KEY = 'mcjs_backup_remind_last';
    var now = Date.now();
    var last = 0;
    try { last = parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) {}
    var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (now - last < THIRTY_DAYS) return;
    // 首次使用不提醒（last 为 0 时仅记录时间，不打扰）
    if (!last) { try { localStorage.setItem(KEY, String(now)); } catch (e) {} return; }
    try { localStorage.setItem(KEY, String(now)); } catch (e) {}
    setTimeout(function() {
      if (window.MCJS_TOAST) window.MCJS_TOAST('记得定期备份游戏存档哦～可在设置 → 存储中管理', 'info');
    }, 8000);
  } catch (e) {}
}

// 暴露"历代公告"打开入口（供设置面板调用）
window.MCJS_OPEN_ANN_HISTORY = function() {
  try { openAnnouncementHistory(); }
  catch (e) { console.warn('[MCJS] openAnnouncementHistory failed:', e); }
};

// 引擎偏好：把用户选择的版本解析为实际启动的版本（JS/WASM 成对切换）
function resolveEngineVersion(ver) {
  var prefer = settings.enginePrefer || 'auto';
  if (prefer === 'auto' || !ver || !ver.id) return ver;
  var versions = getVersions();
  if (!versions) return ver;
  function findById(id) {
    return versions.find(function(v) { return v.id === id; });
  }
  var id = ver.id;
  var targetId = null;
  if (prefer === 'wasm') {
    if (/wasm$/i.test(id)) return ver;
    // pixelclient/1.8.8 -> pixelclient/1.8.8wasm；1.8.8 -> 1.8.8wasm
    targetId = id + 'wasm';
  } else if (prefer === 'js') {
    if (/wasm$/i.test(id)) {
      targetId = id.replace(/wasm$/i, '');
    } else {
      return ver;
    }
  }
  if (targetId) {
    var found = findById(targetId);
    if (found) {
      console.log('[MCJS] enginePrefer=' + prefer + '，切换版本:', id, '->', targetId);
      return found;
    }
  }
  return ver;
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
  // v1.5：主题模式 / 强调色 / 毛玻璃
  safeRun(function(){
    applyThemeMode(settings.theme || 'light');
    applyAccentColor(settings.accentColor || 'green');
    applyGlass(settings.glassBlur !== false);
    if (window.matchMedia) {
      _systemDarkMql = window.matchMedia('(prefers-color-scheme: dark)');
      var mqlHandler = function() {
        if ((settings.theme || 'light') === 'system') applyThemeMode('system');
      };
      if (_systemDarkMql.addEventListener) _systemDarkMql.addEventListener('change', mqlHandler);
      else if (_systemDarkMql.addListener) _systemDarkMql.addListener(mqlHandler);
    }
  }, 'applyThemeExtras');
  
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
    if (settings.showAnnouncements !== false) {
      safeRun(showAnnouncement, 'showAnnouncement');
    }
    // v1.5：启动时自动检查插件更新
    if (settings.pluginAutoCheck !== false && window.MCJS_REGISTRY && window.MCJS_REGISTRY.checkAllUpdates) {
      setTimeout(function() {
        try {
          window.MCJS_REGISTRY.checkAllUpdates().then(function(updates) {
            if (updates && updates.length) {
              var names = updates.slice(0, 3).map(function(u) { return u.name || u.id; }).join('、');
              var extra = updates.length > 3 ? (' 等' + updates.length + '个') : '';
              if (window.MCJS_TOAST) window.MCJS_TOAST('有插件可更新：' + names + extra + '，前往插件市场查看', 'info');
            }
          }).catch(function() {});
        } catch (e) {}
      }, 4000);
    }
    // v1.5：存档备份提醒（每 30 天一次）
    safeRun(maybeRemindBackup, 'maybeRemindBackup');
    
    requestAnimationFrame(function(){
      try {
        sound = new SoundManager();
        sound.setEnabled(settings.soundEnabled !== false);
        try { sound.setVolume(settings.soundVolume == null ? 0.7 : Math.max(0, Math.min(1, settings.soundVolume / 100))); } catch(e) {}
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
  var helpBtn = document.getElementById('helpBtn');
  if (helpBtn) helpBtn.addEventListener('click', function() {
    var hm = document.getElementById('helpModal');
    if (hm) hm.style.display = 'flex';
  });
  var helpClose = document.getElementById('helpCloseBtn');
  if (helpClose) helpClose.addEventListener('click', function() {
    var hm = document.getElementById('helpModal');
    if (hm) hm.style.display = 'none';
  });
  var helpOverlay = document.getElementById('helpModal');
  if (helpOverlay) helpOverlay.addEventListener('click', function(e) {
    if (e.target === helpOverlay) helpOverlay.style.display = 'none';
  });
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
  function pluginCatIcon(cat) {
    return ({
      compatibility: '🛡',
      performance: '⚡',
      appearance: '🎨',
      utility: '🧩',
      language: '🌐',
      custom: '📦'
    })[cat] || '🧩';
  }
  function renderInstalledPluginsList() {
    var section = document.getElementById('installedPluginsSection');
    var listEl = document.getElementById('installedPluginsList');
    var countEl = document.getElementById('installedPluginsCount');
    if (!section || !listEl) return;
    if (!window.MCJS_REGISTRY) { section.style.display = 'none'; return; }
    var installed = window.MCJS_REGISTRY.list().filter(function(p) {
      return window.MCJS_REGISTRY.isInstalled(p.id);
    });
    if (!installed.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    var enabledCount = 0;
    listEl.innerHTML = installed.map(function(p) {
      var en = window.MCJS_REGISTRY.isEnabled(p.id);
      if (en) enabledCount++;
      var cat = p.category || 'custom';
      var name = p.name || p.id;
      var ver = p.version ? ('v' + p.version) : '';
      var desc = p.description || '';
      if (desc.length > 42) desc = desc.slice(0, 42) + '…';
      return '<div class="installed-plugin-card">' +
        '<div class="installed-plugin-icon ' + cat + '">' + pluginCatIcon(cat) + '</div>' +
        '<div class="installed-plugin-info">' +
          '<div class="installed-plugin-name">' + escHome(name) + '</div>' +
          (ver ? '<div class="installed-plugin-version">' + escHome(ver) + '</div>' : '') +
          (desc ? '<div class="installed-plugin-desc">' + escHome(desc) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="installed-plugin-toggle' + (en ? ' on' : '') + '" ' +
          'role="switch" aria-checked="' + (en ? 'true' : 'false') + '" ' +
          'data-pid="' + escHome(p.id) + '" title="' + (en ? '点击停用' : '点击启用') + '"></button>' +
      '</div>';
    }).join('');
    if (countEl) countEl.textContent = enabledCount + ' / ' + installed.length + ' 个插件已启用';
    // 绑定开关
    listEl.querySelectorAll('.installed-plugin-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var pid = btn.getAttribute('data-pid');
        var turnOn = !btn.classList.contains('on');
        try {
          if (turnOn) window.MCJS_REGISTRY.enable(pid);
          else window.MCJS_REGISTRY.disable(pid);
          if (window.MCJS && window.MCJS.sound) window.MCJS.sound.toggle();
        } catch (e) { console.warn('[MCJS] plugin toggle failed:', e); }
        renderInstalledPluginsList();
      });
    });
  }
  function escHome(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    '<p>MCJS v1.4 开放了插件加载链路,支持以下方式从远程安装插件:</p>',
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