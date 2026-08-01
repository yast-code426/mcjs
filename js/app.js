/* MCJS Launcher - Main Application */
(function(){'use strict';

/* ========== DOM References ========== */
var grid=document.getElementById('versionGrid');
var searchInput=document.getElementById('searchInput');
var filterTabs=document.querySelectorAll('.filter-tab');
var launchModal=document.getElementById('launchModal');
var settingsModal=document.getElementById('settingsModal');
var gameOverlay=document.getElementById('gameOverlay');
var gameToolbar=document.getElementById('gameToolbar');
var gameTitle=document.getElementById('gameTitle');
var gameFrame=document.getElementById('gameFrame');
var launchText=document.getElementById('launchText');
var launchDetail=document.getElementById('launchDetail');
var launchProgress=document.getElementById('launchProgress');

/* ========== State ========== */
var currentFilter='all';
var searchQuery='';
var settings=window.MCJS_SETTINGS||{};

/* ========== Feature Labels ========== */
var FEATURE_LABELS={
  '多人联机':{icon:'N',text:'多人联机'},
  '触屏支持':{icon:'T',text:'触屏支持'},
  '光影渲染':{icon:'S',text:'光影渲染'},
  '高帧率':{icon:'F',text:'高帧率'},
  '单人游戏':{icon:'P',text:'单人游戏'},
  '导出存档':{icon:'E',text:'导出存档'},
  '单机':{icon:'P',text:'单机'},
  '局域网':{icon:'L',text:'局域网'},
  '远程联机':{icon:'R',text:'远程联机'}
};

var BADGE_MAP={
  'recommended':{cls:'badge-recommended',text:'推荐'},
  'beta':{cls:'badge-beta',text:'测试版'},
  'legacy':{cls:'badge-legacy',text:'经典版'},
  'new-beta':{cls:'badge-new',text:'新版测试'}
};

/* ========== Rendering ========== */
function escapeHtml(str){
  var div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

function renderCard(ver){
  var badge=BADGE_MAP[ver.type]||BADGE_MAP.legacy;
  
  var tags=ver.features.map(function(f){
    var label=FEATURE_LABELS[f]||{icon:'?',text:f};
    return '<span class="tag"><span class="tag-icon">'+label.icon+'</span>'+label.text+'</span>';
  }).join('');

  // 👇 新增：联机与整合包标识
  if (ver.multiplayer) {
    tags += '<span class="tag" style="color: var(--accent-green); font-weight: 600;">🌐 可联机</span>';
  }
  if (ver.modpack) {
    tags += '<span class="tag" style="color: var(--accent-purple); font-weight: 600;">📦 整合包</span>';
  }

  var langTags=ver.lang.map(function(l){
    return '<span class="tag lang-tag">'+l+'</span>';
  }).join('');

  var detailLines=ver.detail?ver.detail.split('\n').map(function(line){
    return line.trim()?'<div class="card-detail-line">'+escapeHtml(line)+'</div>':'';
  }).join(''):'';

  return '<div class="version-card" data-type="'+ver.type+'" data-id="'+ver.id+'">'+
    '<div class="card-header">'+
      '<div class="card-title">'+escapeHtml(ver.name)+'</div>'+
      '<span class="card-badge '+badge.cls+'">'+badge.text+'</span>'+
    '</div>'+
    '<div class="card-meta">'+escapeHtml(ver.version)+'<br>作者：'+escapeHtml(ver.author)+'</div>'+
    '<div class="card-detail">'+detailLines+'</div>'+
    '<div class="card-tags">'+tags+langTags+
      '<span class="tag engine-tag">'+ver.engine+'</span>'+
    '</div>'+
    '<div class="card-footer">'+
      '<span class="card-size">'+ver.size+'</span>'+
      '<button class="card-launch-btn" data-id="'+ver.id+'">启动</button>'+
    '</div>'+
  '</div>';
}

function renderGrid(){
  var filtered=VERSIONS.filter(function(ver){
    if(currentFilter!=='all'){
      if(currentFilter==='wasm'){
        if(ver.engine!=='WASM')return false;
      }else if(currentFilter==='stable'){
        if(ver.type!=='recommended')return false;
      }else if(currentFilter==='online'){ // 👈 新增联机过滤器
        if(!ver.multiplayer)return false;
      }else if(currentFilter==='modpack'){ // 👈 新增整合包过滤器
        if(!ver.modpack)return false;
      }else{
        if(ver.type!==currentFilter)return false;
      }
    }
    if(searchQuery){
      var q=searchQuery.toLowerCase();
      return ver.name.toLowerCase().indexOf(q)!==-1||
             ver.version.toLowerCase().indexOf(q)!==-1||
             ver.author.toLowerCase().indexOf(q)!==-1||
             ver.engine.toLowerCase().indexOf(q)!==-1;
    }
    return true;
  });

  if(filtered.length===0){
    grid.innerHTML='<div class="empty-state"><p>没有找到匹配的版本</p></div>';
  }else{
    grid.innerHTML=filtered.map(renderCard).join('');
  }
}

/* ========== Filter & Search ========== */
filterTabs.forEach(function(tab){
  tab.addEventListener('click',function(){
    filterTabs.forEach(function(t){t.classList.remove('active');});
    tab.classList.add('active');
    currentFilter=tab.getAttribute('data-filter');
    renderGrid();
  });
});

searchInput.addEventListener('input',function(){
  searchQuery=searchInput.value.trim();
  renderGrid();
});

/* ========== Launch System ========== */
grid.addEventListener('click',function(e){
  var btn=e.target.closest('.card-launch-btn');
  var card=e.target.closest('.version-card');
  var target=btn||card;
  if(!target)return;
  var id=btn?btn.getAttribute('data-id'):target.getAttribute('data-id');
  if(id)launchVersion(id);
});

function launchVersion(id){
  var ver=VERSIONS.find(function(v){return v.id===id;});
  if(!ver)return;

  gameTitle.textContent=ver.name;
  launchModal.classList.add('active');
  launchText.textContent='正在准备启动...';
  launchDetail.textContent='选择镜像或直接启动';
  launchProgress.style.width='0%';

  /* Show mirror selection + auto-launch option */
  renderMirrorSelection(ver);
}

function renderMirrorSelection(ver){
  var container=document.getElementById('mirrorList');
  var html='<div class="auto-launch-btn" id="autoLaunchBtn">'+
    '<span class="auto-launch-icon">&#9654;</span>'+
    '<div><div class="auto-launch-name">自动选择 (推荐镜像)</div>'+
    '<div class="auto-launch-desc">使用默认镜像直接启动</div></div>'+
  '</div>';

  html+=ver.mirrors.map(function(m,i){
    return '<div class="mirror-item" data-mirror="'+i+'">'+
      '<div class="mirror-item-name">'+escapeHtml(m.name)+'</div>'+
      '<div class="mirror-item-url">'+escapeHtml(m.url)+'</div>'+
    '</div>';
  }).join('');

  container.innerHTML=html;

  /* Auto launch */
  document.getElementById('autoLaunchBtn').addEventListener('click',function(){
    startGameLaunch(ver);
  });

  /* Manual mirror selection */
  container.querySelectorAll('.mirror-item').forEach(function(el){
    el.addEventListener('click',function(){
      var idx=parseInt(el.getAttribute('data-mirror'));
      settings.mirrorIndex=idx;
      window.MCJS_SAVE_SETTINGS(settings);
      startGameLaunch(ver);
    });
  });
}

function startGameLaunch(ver){
  launchModal.classList.remove('active');

  /* Show game overlay */
  gameOverlay.classList.add('active');
  launchText.textContent='正在优化内存...';
  launchDetail.textContent='请稍候...';
  launchProgress.style.width='0%';

  /* Update launch progress */
  window.MCJS_UPDATE_LAUNCH=function(text,pct){
    launchText.textContent=text;
    launchProgress.style.width=pct+'%';
  };

  /* Launch game */
  window.MCJS_GAME.launch(ver,
    function(text,pct){
      launchText.textContent=text;
      launchProgress.style.width=pct+'%';
    },
    function(){
      /* Game ready - hide loading, show frame */
      setTimeout(function(){
        document.querySelector('.launch-content').style.display='none';
        gameToolbar.style.display='flex';
      },500);
    },
    function(err){
      launchText.textContent=err;
      launchDetail.textContent='请检查网络连接后重试';
      launchProgress.style.width='0%';
    }
  );
}

/* ========== Game Toolbar ========== */
document.getElementById('gameCloseBtn').addEventListener('click',function(){
  window.MCJS_GAME.close();
  gameOverlay.classList.remove('active');
  gameToolbar.style.display='none';
  document.querySelector('.launch-content').style.display='';
});

document.getElementById('gameFullscreenBtn').addEventListener('click',function(){
  var container=document.getElementById('gameContainer');
  if(container.requestFullscreen)container.requestFullscreen();
  else if(container.webkitRequestFullscreen)container.webkitRequestFullscreen();
});

/* ========== Settings Panel ========== */
var settingsBtn=document.getElementById('settingsBtn');
var settingsClose=document.getElementById('settingsClose');

settingsBtn.addEventListener('click',function(){
  openSettings();
});

settingsClose.addEventListener('click',function(){
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

function loadSettingsUI(){
  var s=settings;
  /* Mirror selection */
  var mirrorSelect=document.getElementById('settingMirror');
  mirrorSelect.value=s.mirrorIndex||0;

  /* Memory limit */
  var memSlider=document.getElementById('settingMemory');
  var memValue=document.getElementById('memoryValue');
  memSlider.value=s.memoryLimit||512;
  memValue.textContent=(s.memoryLimit||512)+' MB';
  memSlider.addEventListener('input',function(){
    memValue.textContent=memSlider.value+' MB';
  });

  /* Auto clean */
  document.getElementById('settingAutoClean').checked=s.autoClean!==false;

  /* Save isolation */
  document.getElementById('settingSaveIsolation').checked=s.saveIsolation!==false;

  /* GPU preference */
  document.getElementById('settingGPU').value=s.gpuPrefer||'high-performance';

  /* Cache limit */
  var cacheSlider=document.getElementById('settingCacheLimit');
  var cacheValue=document.getElementById('cacheValue');
  cacheSlider.value=s.cacheSizeLimit||2048;
  cacheValue.textContent=(s.cacheSizeLimit||2048)+' MB';
  cacheSlider.addEventListener('input',function(){
    cacheValue.textContent=cacheSlider.value+' MB';
  });

  /* Background image */
  document.getElementById('settingBgImage').checked=s.bgImage!==false;

  /* Sound */
  document.getElementById('settingSound').checked=s.soundEnabled!==false;

  /* Fullscreen launch */
  document.getElementById('settingFullscreen').checked=s.fullscreenLaunch===true;

  /* Cache info */
  updateCacheInfo();
}

function updateCacheInfo(){
  if(window.MCJS_GAME&&window.MCJS_GAME.getCacheSize){
    window.MCJS_GAME.getCacheSize().then(function(info){
      var sizeText=window.MCJS_GAME.formatBytes(info.bytes);
      document.getElementById('cacheSizeText').textContent=sizeText;
      document.getElementById('cacheFileCount').textContent=info.count+' 个文件';
    }).catch(function(){
      document.getElementById('cacheSizeText').textContent='无法读取';
      document.getElementById('cacheFileCount').textContent='';
    });
  }
}

function applySettings(){
  settings.mirrorIndex=parseInt(document.getElementById('settingMirror').value)||0;
  settings.memoryLimit=parseInt(document.getElementById('settingMemory').value)||512;
  settings.autoClean=document.getElementById('settingAutoClean').checked;
  settings.saveIsolation=document.getElementById('settingSaveIsolation').checked;
  settings.gpuPrefer=document.getElementById('settingGPU').value;
  settings.cacheSizeLimit=parseInt(document.getElementById('settingCacheLimit').value)||2048;
  settings.bgImage=document.getElementById('settingBgImage').checked;
  settings.soundEnabled=document.getElementById('settingSound').checked;
  settings.fullscreenLaunch=document.getElementById('settingFullscreen').checked;
  window.MCJS_SETTINGS=settings;
  window.MCJS_SAVE_SETTINGS(settings);

  /* Apply background image toggle */
  if(settings.bgImage){
    document.body.classList.remove('no-bg');
  }else{
    document.body.classList.add('no-bg');
  }
}

/* Cache clear button */
document.getElementById('clearCacheBtn').addEventListener('click',function(){
  if(confirm('确定要清除所有游戏缓存吗？下次启动需要重新下载。')){
    window.MCJS_GAME.clearCache().then(function(){
      updateCacheInfo();
      alert('缓存已清除');
    }).catch(function(){
      alert('清除失败');
    });
  }
});

/* Clear save data button */
document.getElementById('clearSaveBtn').addEventListener('click',function(){
  if(confirm('确定要清除所有版本的存档数据吗？此操作不可恢复！')){
    window.MCJS_GAME.clearSaveData().then(function(){
      alert('存档数据已清除');
    }).catch(function(){
      alert('清除失败');
    });
  }
});

/* ========== Modal Close Handlers ========== */
document.getElementById('modalClose').addEventListener('click',function(){
  launchModal.classList.remove('active');
});

launchModal.addEventListener('click',function(e){
  if(e.target===launchModal)launchModal.classList.remove('active');
});

settingsModal.addEventListener('click',function(e){
  if(e.target===settingsModal)closeSettings();
});

/* ========== Keyboard Shortcuts ========== */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(settingsModal.classList.contains('active')){
      closeSettings();
    }else if(launchModal.classList.contains('active')){
      launchModal.classList.remove('active');
    }else if(gameOverlay.classList.contains('active')){
      /* Don't close game on ESC - user might be playing */
    }
  }
  /* Ctrl+, for settings */
  if(e.key===','&&(e.ctrlKey||e.metaKey)){
    e.preventDefault();
    openSettings();
  }
});

/* ========== Background Image Toggle ========== */
if(settings.bgImage===false){
  document.body.classList.add('no-bg');
}

/* ========== Init ========== */
document.getElementById('versionCount').textContent=VERSIONS.length+' 个版本';
renderGrid();

/* ========== Register Service Worker ========== */
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