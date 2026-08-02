/* MCJS Launcher - Main Application
 * Fixes:
 *  - Settings panel: added new options, fixed missing elements
 *  - Input key handling: no longer blocked by overlay
 *  - Info collection: wrapped in try-catch
 *  - Light theme support
 *  - Important text has distinct colors
 */
(function(){'use strict';

/* ========== DOM References ========== */
var grid=document.getElementById('versionSections');
var searchInput=document.getElementById('searchInput');
var launchModal=document.getElementById('launchModal');
var settingsModal=document.getElementById('settingsModal');
var gameOverlay=document.getElementById('gameOverlay');
var gameToolbar=document.getElementById('gameToolbar');
var gameTitle=document.getElementById('gameTitle');
var launchText=document.getElementById('launchText');
var launchDetail=document.getElementById('launchDetail');
var launchProgress=document.getElementById('launchProgress');
var launchContent=document.getElementById('launchContent');

/* ========== State ========== */
var searchQuery='';
var searchDebounceTimer=null;
var settings=window.MCJS_SETTINGS||{};
var sound=null;

/* ========== Group Definitions ========== */
var GROUPS=[
  {
    id:'mcjs',
    title:'MCJS 优化 Eaglercraft 客户端 (推荐)',
    desc:'MCJS 专为简体中文用户优化的 Eaglercraft 中文版。1.8.8 已支持远程联机，此处全版本已支持中文语言。',
    typeMatch:function(ver){return ver.type==='recommended';}
  },
  {
    id:'modpack',
    title:'模组整合包 Eaglercraft 客户端',
    desc:'1.6.4 Forge 版本，内置近百种热门模组，超越原版体验。模组整合包对设备性能要求高，仅 WASM 版。这些版本不支持中文语言，强制切换语言会导致游戏崩溃。',
    typeMatch:function(ver){return ver.modpack===true;}
  },
  {
    id:'newbeta',
    title:'最新测试版 Eaglercraft 客户端',
    desc:'提前体验最新版本。测试版不稳定且 bug 多，仅测试体验。高版本对设备性能要求高，仅 WASM 版，需高性能电脑。注意：这些版本不支持中文语言，强制切换语言会导致游戏崩溃。',
    typeMatch:function(ver){return !ver.modpack&&(ver.type==='beta'||ver.type==='new-beta');}
  },
  {
    id:'legacy',
    title:'旧版 Eaglercraft 客户端',
    desc:'早期版本原版搬运，只有英文版，无中文版，仅怀旧体验。',
    typeMatch:function(ver){return ver.type==='legacy';}
  }
];

var BADGE_MAP={
  'recommended':{cls:'badge-recommended',text:'推荐'},
  'beta':{cls:'badge-beta',text:'测试版'},
  'legacy':{cls:'badge-legacy',text:'经典版'},
  'new-beta':{cls:'badge-new',text:'新版测试'}
};

/* ========== Sound Manager ========== */
var SoundManager=function(){
  this.ctx=null;
  this.enabled=true;
  this.unlocked=false;
};
SoundManager.prototype._ensureCtx=function(){
  if(this.ctx)return;
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  try{this.ctx=new AC();}catch(e){this.ctx=null;}
};
SoundManager.prototype.unlock=function(){
  if(this.unlocked)return;
  this._ensureCtx();
  if(!this.ctx)return;
  if(this.ctx.state==='suspended'){
    this.ctx.resume().catch(function(){});
  }
  try{
    var buf=this.ctx.createBuffer(1,1,22050);
    var src=this.ctx.createBufferSource();
    src.buffer=buf;
    src.connect(this.ctx.destination);
    src.start(0);
  }catch(e){}
  this.unlocked=true;
};
SoundManager.prototype._tone=function(freq,duration,type,volume){
  if(!this.enabled||!this.ctx)return;
  try{
    var t=this.ctx.currentTime;
    var osc=this.ctx.createOscillator();
    var gain=this.ctx.createGain();
    osc.type=type||'sine';
    osc.frequency.setValueAtTime(freq,t);
    gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(volume||0.08,t+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t+duration+0.02);
  }catch(e){}
};
SoundManager.prototype.click=function(){if(!this.enabled)return;this._tone(880,0.06,'square',0.04);};
SoundManager.prototype.hover=function(){if(!this.enabled)return;this._tone(1320,0.04,'sine',0.02);};
SoundManager.prototype.toggle=function(){
  if(!this.enabled)return;
  this._tone(660,0.08,'triangle',0.05);
  setTimeout(function(){this._tone(990,0.06,'triangle',0.04);}.bind(this),40);
};
SoundManager.prototype.open=function(){
  if(!this.enabled)return;
  this._tone(523,0.08,'sine',0.05);
  setTimeout(function(){this._tone(784,0.10,'sine',0.05);}.bind(this),60);
};
SoundManager.prototype.close=function(){
  if(!this.enabled)return;
  this._tone(784,0.08,'sine',0.05);
  setTimeout(function(){this._tone(523,0.10,'sine',0.05);}.bind(this),60);
};
SoundManager.prototype.launch=function(){
  if(!this.enabled)return;
  var notes=[523,659,784,1046];
  for(var i=0;i<notes.length;i++){
    (function(freq,delay){
      setTimeout(function(){this._tone(freq,0.12,'triangle',0.05);}.bind(this),delay);
    }.bind(this))(notes[i],i*70);
  }
};
SoundManager.prototype.error=function(){if(!this.enabled)return;this._tone(220,0.18,'sawtooth',0.06);};
SoundManager.prototype.setEnabled=function(on){this.enabled=!!on;};

/* ========== Rendering ========== */
function escapeHtml(str){
  var div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

function renderCard(ver){
  var badge=BADGE_MAP[ver.type]||BADGE_MAP.legacy;
  var extra=ver.recommendTag?(' <span class="card-recommend-tag">'+escapeHtml(ver.recommendTag)+'</span>'):'';

  var detailLines=ver.detail?ver.detail.split('\n').map(function(line){
    return line.trim()?'<div class="card-detail-line">'+escapeHtml(line)+'</div>':'';
  }).join(''):'';

  return '<div class="version-card" data-type="'+ver.type+'" data-id="'+ver.id+'" data-engine="'+ver.engine+'">'+
    '<div class="card-badges">'+
      '<span class="card-badge '+badge.cls+'">'+badge.text+'</span>'+extra+
    '</div>'+
    '<div class="card-title">'+escapeHtml(ver.name)+'</div>'+
    '<div class="card-meta">'+escapeHtml(ver.version)+'</div>'+
    '<div class="card-meta card-author">原作者: '+escapeHtml(ver.author)+'</div>'+
    '<div class="card-detail">'+detailLines+'</div>'+
    '<div class="card-footer">'+
      '<span class="card-size">'+ver.size+'</span>'+
      '<button class="card-launch-btn" data-id="'+ver.id+'" aria-label="启动 '+escapeHtml(ver.name)+'">开始游戏</button>'+
    '</div>'+
  '</div>';
}

function matchSearch(ver,q){
  if(!q)return true;
  if(ver.name.toLowerCase().indexOf(q)!==-1)return true;
  if(ver.version.toLowerCase().indexOf(q)!==-1)return true;
  if(ver.author&&ver.author.toLowerCase().indexOf(q)!==-1)return true;
  if(ver.engine&&ver.engine.toLowerCase().indexOf(q)!==-1)return true;
  return false;
}

function renderGrid(){
  var q=searchQuery.toLowerCase();
  var html='';
  var totalShown=0;

  GROUPS.forEach(function(group){
    var matched=VERSIONS.filter(function(ver){
      if(!group.typeMatch(ver))return false;
      return matchSearch(ver,q);
    });
    if(matched.length===0)return;
    totalShown+=matched.length;
    html+='<section class="version-group" data-group="'+group.id+'">'+
      '<header class="group-header">'+
        '<h3 class="group-title">'+escapeHtml(group.title)+'</h3>'+
        '<p class="group-desc">'+escapeHtml(group.desc)+'</p>'+
      '</header>'+
      '<div class="version-grid">'+matched.map(renderCard).join('')+'</div>'+
    '</section>';
  });

  if(totalShown===0){
    html='<div class="empty-state"><p>没有找到匹配的版本</p><p style="font-size:0.78rem;margin-top:6px;opacity:0.7;">试试其他搜索关键字</p></div>';
  }
  grid.innerHTML=html;
}

/* ========== Search ========== */
searchInput.addEventListener('input',function(){
  if(searchDebounceTimer)clearTimeout(searchDebounceTimer);
  searchDebounceTimer=setTimeout(function(){
    searchQuery=searchInput.value.trim();
    renderGrid();
  },180);
});

/* ========== Fix: Search input should not be blocked by keyboard events ========== */
/* Ensure search input always works regardless of any overlay state */
searchInput.addEventListener('keydown',function(e){
  e.stopPropagation();
});
searchInput.addEventListener('keyup',function(e){
  e.stopPropagation();
});
searchInput.addEventListener('keypress',function(e){
  e.stopPropagation();
});

/* ========== Launch System ========== */
grid.addEventListener('click',function(e){
  var btn=e.target.closest('.card-launch-btn');
  var card=e.target.closest('.version-card');
  var target=btn||card;
  if(!target)return;
  var id=btn?btn.getAttribute('data-id'):target.getAttribute('data-id');
  if(id){
    if(sound)sound.click();
    launchVersion(id);
  }
});

function launchVersion(id){
  var ver=VERSIONS.find(function(v){return v.id===id;});
  if(!ver)return;

  if(ver.engine==='WASM'&&!window.MCJS_WASM_SUPPORTED){
    var fallbackId=ver.id.replace(/wasm$/i,'').replace(/u\d+$/,'');
    var fallback=VERSIONS.find(function(v){
      return v.id===fallbackId||v.id===fallbackId+'js'||
             (v.engine==='JS'&&v.version.split(' ')[2]===ver.version.split(' ')[2]);
    });
    if(fallback){
      showWasmWarning('当前版本需要 WebAssembly,但您的浏览器不支持。已自动切换到兼容版本:'+fallback.name);
      ver=fallback;
    }
  }

  gameTitle.textContent=ver.name;
  launchModal.classList.add('active');
  if(sound)sound.open();
  launchText.textContent='正在准备启动...';
  launchDetail.textContent='选择镜像或直接启动';
  launchProgress.style.width='0%';

  renderMirrorSelection(ver);
}

function renderMirrorSelection(ver){
  var container=document.getElementById('mirrorList');
  var html='<div class="auto-launch-btn" id="autoLaunchBtn" role="button" tabindex="0">'+
    '<span class="auto-launch-icon">&#9654;</span>'+
    '<div><div class="auto-launch-name">自动选择 (推荐镜像)</div>'+
    '<div class="auto-launch-desc">使用默认镜像直接启动</div></div>'+
  '</div>';

  html+=ver.mirrors.map(function(m,i){
    return '<div class="mirror-item" data-mirror="'+i+'" role="button" tabindex="0">'+
      '<div class="mirror-item-name">'+escapeHtml(m.name)+'</div>'+
      '<div class="mirror-item-url">'+escapeHtml(m.url)+'</div>'+
    '</div>';
  }).join('');

  container.innerHTML=html;

  document.getElementById('autoLaunchBtn').addEventListener('click',function(){
    if(sound)sound.click();
    startGameLaunch(ver);
  });
  document.getElementById('autoLaunchBtn').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();startGameLaunch(ver);}
  });

  container.querySelectorAll('.mirror-item').forEach(function(el){
    el.addEventListener('click',function(){
      if(sound)sound.click();
      var idx=parseInt(el.getAttribute('data-mirror'));
      settings.mirrorIndex=idx;
      window.MCJS_SETTINGS=settings;
      window.MCJS_SAVE_SETTINGS(settings);
      startGameLaunch(ver);
    });
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        var idx=parseInt(el.getAttribute('data-mirror'));
        settings.mirrorIndex=idx;
        window.MCJS_SETTINGS=settings;
        window.MCJS_SAVE_SETTINGS(settings);
        startGameLaunch(ver);
      }
    });
  });
}

function startGameLaunch(ver){
  if(sound)sound.launch();
  launchModal.classList.remove('active');

  gameOverlay.classList.add('active');
  if(launchContent)launchContent.style.display='';
  if(gameToolbar)gameToolbar.style.display='none';
  launchText.textContent='正在优化内存...';
  launchDetail.textContent='请稍候...';
  launchProgress.style.width='0%';

  window.MCJS_UPDATE_LAUNCH=function(text,pct){
    try{
      launchText.textContent=text;
      launchProgress.style.width=pct+'%';
    }catch(e){}
  };

  window.MCJS_GAME.launch(ver,
    function(text,pct){
      try{
        launchText.textContent=text;
        launchProgress.style.width=pct+'%';
      }catch(e){}
    },
    function(){
      setTimeout(function(){
        if(launchContent)launchContent.style.display='none';
        if(gameToolbar)gameToolbar.style.display='flex';
      },500);
    },
    function(err){
      if(sound)sound.error();
      try{
        launchText.textContent=err;
        launchDetail.textContent='请检查网络连接后重试';
        launchProgress.style.width='0%';
      }catch(e){}
    }
  );
}

/* ========== Game Toolbar ========== */
document.getElementById('gameCloseBtn').addEventListener('click',function(){
  if(sound)sound.close();
  window.MCJS_GAME.close();
  gameOverlay.classList.remove('active');
  if(gameToolbar)gameToolbar.style.display='none';
  if(launchContent)launchContent.style.display='';
});

document.getElementById('gameFullscreenBtn').addEventListener('click',function(){
  if(sound)sound.click();
  var container=document.getElementById('gameContainer');
  if(!container)return;
  var req=container.requestFullscreen||container.webkitRequestFullscreen||container.mozRequestFullScreen||container.msRequestFullscreen;
  if(req)req.call(container).catch(function(e){console.warn('[MCJS] Fullscreen failed:',e);});
});

/* ========== Settings Panel ========== */
var settingsBtn=document.getElementById('settingsBtn');
var settingsClose=document.getElementById('settingsClose');

settingsBtn.addEventListener('click',function(){
  if(sound&&sound.unlock)sound.unlock();
  if(sound)sound.open();
  openSettings();
});

settingsClose.addEventListener('click',function(){
  if(sound)sound.close();
  closeSettings();
});

function openSettings(){
  settingsModal.classList.add('active');
  loadSettingsUI();
}

function closeSettings(){
  settingsModal.classList.remove('active');
  applySettings();
}

/* ========== Toggle Helpers ========== */
function setToggle(btn,on){
  if(!btn)return;
  if(on)btn.classList.add('active');
  else btn.classList.remove('active');
  btn.setAttribute('aria-checked',on?'true':'false');
}
function getToggle(btn){
  return !!(btn&&btn.classList.contains('active'));
}

function bindToggle(id,getter,setter){
  var btn=document.getElementById(id);
  if(!btn)return;
  setToggle(btn,getter());
  if(btn._mcjsBound)return;
  btn._mcjsBound=true;
  btn.addEventListener('click',function(){
    var next=!getToggle(btn);
    setToggle(btn,next);
    setter(next);
    if(sound)sound.toggle();
  });
  btn.addEventListener('keydown',function(e){
    if(e.key===' '||e.key==='Enter'){
      e.preventDefault();
      btn.click();
    }
  });
}

function loadSettingsUI(){
  var s=settings;

  var mirrorSelect=document.getElementById('settingMirror');
  if(mirrorSelect)mirrorSelect.value=s.mirrorIndex||0;

  var memSlider=document.getElementById('settingMemory');
  var memValue=document.getElementById('memoryValue');
  if(memSlider&&memValue){
    memSlider.value=s.memoryLimit||512;
    memValue.textContent=(s.memoryLimit||512)+' MB';
  }

  var cacheSlider=document.getElementById('settingCacheLimit');
  var cacheValue=document.getElementById('cacheValue');
  if(cacheSlider&&cacheValue){
    cacheSlider.value=s.cacheSizeLimit||2048;
    cacheValue.textContent=(s.cacheSizeLimit||2048)+' MB';
  }

  var gpuSelect=document.getElementById('settingGPU');
  if(gpuSelect)gpuSelect.value=s.gpuPrefer||'high-performance';

  var fontSelect=document.getElementById('settingFontSize');
  if(fontSelect)fontSelect.value=s.fontSize||'normal';

  var densitySelect=document.getElementById('settingCardDensity');
  if(densitySelect)densitySelect.value=s.cardDensity||'comfortable';

  bindToggle('settingFullscreen',function(){return s.fullscreenLaunch===true;},function(v){s.fullscreenLaunch=v;});
  bindToggle('settingAutoClean',function(){return s.autoClean!==false;},function(v){s.autoClean=v;});
  bindToggle('settingSaveIsolation',function(){return s.saveIsolation!==false;},function(v){s.saveIsolation=v;});
  bindToggle('settingBgImage',function(){return s.bgImage!==false;},function(v){
    s.bgImage=v;
    applyBackground();
  });
  bindToggle('settingSound',function(){return s.soundEnabled!==false;},function(v){
    s.soundEnabled=v;
    if(sound)sound.setEnabled(v);
  });
  bindToggle('settingAutoUpdateCheck',function(){return s.autoUpdateCheck!==false;},function(v){s.autoUpdateCheck=v;});
  bindToggle('settingLoadingDetail',function(){return s.loadingDetail!==false;},function(v){s.loadingDetail=v;});
  bindToggle('settingQuickLaunch',function(){return s.quickLaunch===true;},function(v){s.quickLaunch=v;});
  bindToggle('settingReduceMotion',function(){return s.reduceMotion===true;},function(v){
    s.reduceMotion=v;
    applyTheme();
  });

  updateCacheInfo();
}

function updateCacheInfo(){
  if(window.MCJS_GAME&&window.MCJS_GAME.getCacheSize){
    window.MCJS_GAME.getCacheSize().then(function(info){
      try{
        var sizeText=window.MCJS_GAME.formatBytes(info.bytes);
        var sizeEl=document.getElementById('cacheSizeText');
        var countEl=document.getElementById('cacheFileCount');
        if(sizeEl)sizeEl.textContent=sizeText;
        if(countEl)countEl.textContent=info.count+' 个文件';
      }catch(e){}
    }).catch(function(){
      try{
        var sizeEl=document.getElementById('cacheSizeText');
        var countEl=document.getElementById('cacheFileCount');
        if(sizeEl)sizeEl.textContent='无法读取';
        if(countEl)countEl.textContent='';
      }catch(e){}
    });
  }
}

function applySettings(){
  var mirrorSelect=document.getElementById('settingMirror');
  var memSlider=document.getElementById('settingMemory');
  var cacheSlider=document.getElementById('settingCacheLimit');
  var gpuSelect=document.getElementById('settingGPU');
  var fontSelect=document.getElementById('settingFontSize');
  var densitySelect=document.getElementById('settingCardDensity');

  if(mirrorSelect)settings.mirrorIndex=parseInt(mirrorSelect.value)||0;
  if(memSlider)settings.memoryLimit=parseInt(memSlider.value)||512;
  if(cacheSlider)settings.cacheSizeLimit=parseInt(cacheSlider.value)||2048;
  if(gpuSelect)settings.gpuPrefer=gpuSelect.value;
  if(fontSelect)settings.fontSize=fontSelect.value;
  if(densitySelect)settings.cardDensity=densitySelect.value;

  window.MCJS_SETTINGS=settings;
  window.MCJS_SAVE_SETTINGS(settings);

  applyBackground();
  applyTheme();
  applyFontSize();
  applyCardDensity();
}

function applyBackground(){
  if(settings.bgImage===false){
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
  var sizeMap={'small':'14px','normal':'16px','large':'18px','xlarge':'20px'};
  var px=sizeMap[settings.fontSize]||'16px';
  document.documentElement.style.fontSize=px;
}

function applyCardDensity(){
  document.body.classList.remove('density-compact','density-comfortable','density-spacious');
  var d=settings.cardDensity||'comfortable';
  if(d!=='comfortable'){
    document.body.classList.add('density-'+d);
  }
  /* Apply density styles via CSS custom property override */
  var gapMap={'compact':'8px','comfortable':'14px','spacious':'20px'};
  var padMap={'compact':'12px 14px 10px','comfortable':'18px 20px 14px','spacious':'24px 26px 18px'};
  var g=gapMap[d]||'14px';
  var p=padMap[d]||'18px 20px 14px';
  document.documentElement.style.setProperty('--card-gap',g);
  document.documentElement.style.setProperty('--card-padding',p);
}

/* Live slider updates */
function bindSliderLive(sliderId,valueId,unit,onChange){
  var slider=document.getElementById(sliderId);
  var value=document.getElementById(valueId);
  if(!slider||!value)return;
  if(slider._mcjsBound)return;
  slider._mcjsBound=true;
  slider.addEventListener('input',function(){
    value.textContent=slider.value+' '+unit;
    if(onChange)onChange(parseInt(slider.value));
  });
}

bindSliderLive('settingMemory','memoryValue','MB');
bindSliderLive('settingCacheLimit','cacheValue','MB');

/* Cache clear button */
document.getElementById('clearCacheBtn').addEventListener('click',function(){
  if(sound)sound.click();
  if(confirm('确定要清除所有游戏缓存吗？下次启动需要重新下载。')){
    window.MCJS_GAME.clearCache().then(function(){
      updateCacheInfo();
      if(sound)sound.toggle();
      alert('缓存已清除');
    }).catch(function(){
      if(sound)sound.error();
      alert('清除失败');
    });
  }
});

/* Clear save data button */
document.getElementById('clearSaveBtn').addEventListener('click',function(){
  if(sound)sound.click();
  if(confirm('确定要清除所有版本的存档数据吗？此操作不可恢复！')){
    window.MCJS_GAME.clearSaveData().then(function(){
      if(sound)sound.toggle();
      alert('存档数据已清除');
    }).catch(function(){
      if(sound)sound.error();
      alert('清除失败');
    });
  }
});

/* Reset OS-gate */
var resetOsGateBtn=document.getElementById('resetOsGateBtn');
if(resetOsGateBtn){
  resetOsGateBtn.addEventListener('click',function(){
    if(sound)sound.click();
    if(typeof window.MCJS_RESET_OS_GATE==='function')window.MCJS_RESET_OS_GATE();
    location.reload();
  });
}

/* ========== Modal Close Handlers ========== */
document.getElementById('modalClose').addEventListener('click',function(){
  if(sound)sound.close();
  launchModal.classList.remove('active');
});

launchModal.addEventListener('click',function(e){
  if(e.target===launchModal){
    if(sound)sound.close();
    launchModal.classList.remove('active');
  }
});

settingsModal.addEventListener('click',function(e){
  if(e.target===settingsModal||e.target.classList.contains('settings-backdrop')){
    if(sound)sound.close();
    closeSettings();
  }
});

/* ========== Launch Failed Dialog ========== */
var launchFailedModal=document.getElementById('launchFailedModal');
var launchFailedMsg=document.getElementById('launchFailedMsg');
var launchFailedUrl=document.getElementById('launchFailedUrl');
var launchFailedCopy=document.getElementById('launchFailedCopy');
var launchFailedOpen=document.getElementById('launchFailedOpen');
var launchFailedRetry=document.getElementById('launchFailedRetry');
var launchFailedClose=document.getElementById('launchFailedClose');
var launchFailedVersion=null;

window.addEventListener('mcjs:launch-failed',function(e){
  var detail=(e&&e.detail)||{};
  launchFailedVersion=detail.version||null;
  if(launchFailedMsg)launchFailedMsg.textContent=detail.url?('无法从任何镜像加载游戏。可手动访问下方链接:'):'无法启动游戏。';
  if(launchFailedUrl)launchFailedUrl.value=detail.url||'';
  if(launchFailedModal){
    launchFailedModal.classList.add('active');
    gameOverlay.classList.remove('active');
    if(launchContent)launchContent.style.display='';
  }
  if(sound)sound.error();
});

if(launchFailedClose)launchFailedClose.addEventListener('click',function(){
  if(sound)sound.close();
  launchFailedModal.classList.remove('active');
});
if(launchFailedModal)launchFailedModal.addEventListener('click',function(e){
  if(e.target===launchFailedModal)launchFailedModal.classList.remove('active');
});
if(launchFailedCopy)launchFailedCopy.addEventListener('click',function(){
  if(!launchFailedUrl)return;
  launchFailedUrl.select();
  try{
    var ok=document.execCommand('copy');
    if(ok){
      launchFailedCopy.textContent='已复制';
      if(sound)sound.toggle();
      setTimeout(function(){launchFailedCopy.textContent='复制链接';},1500);
    }
  }catch(e){
    if(navigator.clipboard){
      navigator.clipboard.writeText(launchFailedUrl.value).then(function(){
        launchFailedCopy.textContent='已复制';
        setTimeout(function(){launchFailedCopy.textContent='复制链接';},1500);
      }).catch(function(){});
    }
  }
});
if(launchFailedOpen)launchFailedOpen.addEventListener('click',function(){
  if(launchFailedUrl&&launchFailedUrl.value){
    if(sound)sound.click();
    window.open(launchFailedUrl.value,'_blank','noopener');
  }
});
if(launchFailedRetry)launchFailedRetry.addEventListener('click',function(){
  if(sound)sound.click();
  launchFailedModal.classList.remove('active');
  if(launchFailedVersion)launchVersion(launchFailedVersion.id);
});

/* ========== WASM Warning ========== */
function showWasmWarning(msg){
  var el=document.getElementById('wasmWarning');
  var text=document.getElementById('wasmWarningText');
  if(!el||!text)return;
  text.textContent=msg||'已自动回退到兼容版本。';
  el.style.display='flex';
  setTimeout(function(){hideWasmWarning();},6000);
}
function hideWasmWarning(){
  var el=document.getElementById('wasmWarning');
  if(el)el.style.display='none';
}
document.getElementById('wasmWarningClose')&&document.getElementById('wasmWarningClose').addEventListener('click',function(){
  hideWasmWarning();
});

/* ========== Keyboard Shortcuts ========== */
document.addEventListener('keydown',function(e){
  /* Don't capture shortcuts when typing in input fields */
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;

  if(e.key==='Escape'){
    if(settingsModal.classList.contains('active')){
      closeSettings();
    }else if(launchModal.classList.contains('active')){
      launchModal.classList.remove('active');
    }
  }
  if(e.key===','&&(e.ctrlKey||e.metaKey)){
    e.preventDefault();
    openSettings();
  }
});

/* ========== Hover sound ========== */
function attachHoverSound(root){
  var nodes=root.querySelectorAll('button,.card-launch-btn,.filter-tab,.mirror-item,.auto-launch-btn,.toolbar-btn');
  nodes.forEach(function(n){
    if(n._mcjsHoverBound)return;
    n._mcjsHoverBound=true;
    n.addEventListener('mouseenter',function(){
      if(sound)sound.hover();
    });
  });
}

/* ========== Initial setup ========== */
if(settings.bgImage===false){
  document.body.classList.add('no-bg');
}
applyTheme();
applyFontSize();
applyCardDensity();

/* ========== OS Gate ========== */
(function osGate(){
  var SUPPORTED_RE=/Windows NT|Mac OS X|Macintosh|iPhone|iPad|iPod|Android/i;
  var NAME_MAP=[
    {re:/Windows NT 10\.0/,name:'Windows 10/11'},
    {re:/Windows NT 6\.3/,name:'Windows 8.1'},
    {re:/Windows NT 6\.2/,name:'Windows 8'},
    {re:/Windows NT 6\.1/,name:'Windows 7'},
    {re:/Windows NT/,name:'Windows'},
    {re:/iPhone|iPad|iPod/,name:'iOS'},
    {re:/Android/,name:'Android'},
    {re:/Mac OS X|Macintosh/,name:'macOS'}
  ];
  function detectOS(ua){
    for(var i=0;i<NAME_MAP.length;i++){
      if(NAME_MAP[i].re.test(ua))return NAME_MAP[i].name;
    }
    if(/Linux/i.test(ua))return 'Linux';
    if(/CrOS/.test(ua))return 'Chrome OS';
    if(/BSD/.test(ua))return 'BSD';
    if(/X11/.test(ua))return 'Unix-like';
    return '未知系统';
  }
  var ua=navigator.userAgent||'';
  var osName=detectOS(ua);
  var supported=SUPPORTED_RE.test(ua);

  var ackKey='mcjs_os_gate_ack';
  try{
    var ack=localStorage.getItem(ackKey);
    if(ack==='1'||ack==='skipped'){return;}
  }catch(e){}

  if(supported)return;

  var gate=document.getElementById('osGate');
  if(!gate)return;
  var osEL=document.getElementById('osGateOs');
  if(osEL)osEL.textContent='检测到您的操作系统：'+osName+' (User-Agent 提示)';

  gate.style.display='flex';
  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';

  function close(remember){
    gate.style.display='none';
    document.documentElement.style.overflow='';
    document.body.style.overflow='';
    if(remember){
      try{localStorage.setItem(ackKey,'1');}catch(e){}
    }
  }
  var continueBtn=document.getElementById('osGateContinue');
  var leaveBtn=document.getElementById('osGateLeave');
  if(continueBtn){
    continueBtn.addEventListener('click',function(){close(true);});
  }
  if(leaveBtn){
    leaveBtn.addEventListener('click',function(){
      try{window.close();}catch(e){}
      setTimeout(function(){
        try{window.location.replace('about:blank');}catch(e){}
        document.body.innerHTML='<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f0f2f5;color:#1a1d26;font-family:sans-serif;padding:24px;text-align:center;">已放弃访问。请关闭此标签页。</div>';
      },50);
    });
  }
  document.addEventListener('keydown',function(e){
    if(gate.style.display==='none')return;
    if(e.key==='Escape'){
      if(leaveBtn)leaveBtn.click();
    }
  });
  window.MCJS_RESET_OS_GATE=function(){
    try{localStorage.removeItem(ackKey);}catch(e){}
  };
})();

/* ========== Init ========== */
(function init(){
  var total=VERSIONS.length;
  var vCountEl=document.getElementById('versionCount');
  if(vCountEl)vCountEl.textContent=total+' 个真实版本';
  var hvc=document.getElementById('heroVersionCount');
  if(hvc)hvc.textContent=total;

  renderGrid();
  attachHoverSound(document);

  detectWasmSupport();
})();

function detectWasmSupport(){
  var supported=false;
  try{
    if(typeof WebAssembly!=='undefined'){
      supported=WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,6,1,4,0,65,0,11]));
    }
  }catch(e){supported=false;}
  var sabSupported=(typeof SharedArrayBuffer!=='undefined');
  var coiSupported=typeof crossOriginIsolated!=='undefined'&&crossOriginIsolated;
  window.MCJS_WASM_SUPPORTED=supported;
  window.MCJS_SAB_SUPPORTED=sabSupported;
  window.MCJS_COI_SUPPORTED=coiSupported;

  sound=new SoundManager();
  sound.setEnabled(settings.soundEnabled!==false);

  if(!supported){
    console.warn('[MCJS] WebAssembly not fully supported - JS versions will be used as fallback.');
  }
  if(!coiSupported){
    console.info('[MCJS] Cross-Origin-Opener-Policy headers missing - some advanced features may be limited.');
  }
}

/* ========== Re-bind hover sounds ========== */
var _origRenderGrid=renderGrid;
renderGrid=function(){
  _origRenderGrid();
  attachHoverSound(grid);
};

/* ========== Service Worker ========== */
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      console.log('[MCJS] Service Worker registered');
    }).catch(function(err){
      console.warn('[MCJS] SW registration failed:',err);
    });
  });
}

})();
