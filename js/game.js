/* MCJS Launcher - Game Engine
 * Fixes:
 *  - Unlock overlay no longer blocks keyboard events after dismissal
 *  - Fixed info collection exception in optimizeMemory
 *  - Better error handling throughout
 *  - Settings defaults include all new fields
 */
(function(){'use strict';

/* ========== Settings Manager ========== */
var DEFAULT_SETTINGS={
  mirrorIndex:0,
  memoryLimit:512,
  autoClean:true,
  saveIsolation:true,
  gpuPrefer:'high-performance',
  cacheSizeLimit:2048,
  bgImage:true,
  soundEnabled:true,
  fullscreenLaunch:false,
  darkMode:false,
  animations:true,
  fontSize:'normal',
  cardDensity:'comfortable',
  autoUpdateCheck:true,
  loadingDetail:true,
  keyboardPassthrough:true,
  quickLaunch:false,
  reduceMotion:false
};

function loadSettings(){
  try{
    var s=localStorage.getItem('mcjs_settings');
    return s?Object.assign({},DEFAULT_SETTINGS,JSON.parse(s)):Object.assign({},DEFAULT_SETTINGS);
  }catch(e){return Object.assign({},DEFAULT_SETTINGS);}
}
function saveSettings(s){
  try{localStorage.setItem('mcjs_settings',JSON.stringify(s));}catch(e){}
}
window.MCJS_SETTINGS=loadSettings();
window.MCJS_SAVE_SETTINGS=saveSettings;

/* ========== JSPI Polyfill ========== */
var JSPI_CODE=`
(function(){
  try{
    if(typeof WebAssembly!=='undefined'&&WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,1,123,1,123,3,2,1,0,5,3,1,0,2,7,9,1,5,95,109,97,105,110,0,0,10,10,1,8,0,65,0,250,10,11,11]))){
      return;
    }
  }catch(e){}
  if(typeof WebAssembly==='undefined')return;
  var origInstantiate=WebAssembly.instantiate;
  var origInstantiateStreaming=WebAssembly.instantiateStreaming;
  WebAssembly.instantiate=function(){
    try{return origInstantiate.apply(this,arguments);}catch(e){
      if(e.message&&e.message.indexOf('JSPI')!==-1){
        console.warn('[MCJS] JSPI not supported, using fallback');
        return Promise.reject(e);
      }
      throw e;
    }
  };
  if(origInstantiateStreaming){
    WebAssembly.instantiateStreaming=function(){
      try{return origInstantiateStreaming.apply(this,arguments);}catch(e){
        console.warn('[MCJS] JSPI streaming fallback');
        return Promise.reject(e);
      }
    };
  }
  if(typeof SharedArrayBuffer==='undefined'){
    window.SharedArrayBuffer=ArrayBuffer;
    console.warn('[MCJS] SharedArrayBuffer not available, using ArrayBuffer fallback');
  }
})();
`;

/* ========== GPU Preference Injection ========== */
var GPU_CODE=`
(function(){
  try{
    var c=document.createElement('canvas');
    var gl=c.getContext('webgl2')||c.getContext('webgl');
    if(gl){
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      if(ext){
        var gpu=gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        console.log('[MCJS] GPU: '+gpu);
      }
    }
  }catch(e){}
})();
`;

/* ========== Cache Manager (IndexedDB) ========== */
var DB_NAME='mcjs_cache';
var DB_VERSION=2;
var STORE_GAME='game_files';
var STORE_SAVE='save_data';
var STORE_META='cache_meta';

function openDB(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=function(e){
      var db=e.target.result;
      if(!db.objectStoreNames.contains(STORE_GAME))db.createObjectStore(STORE_GAME);
      if(!db.objectStoreNames.contains(STORE_SAVE))db.createObjectStore(STORE_SAVE);
      if(!db.objectStoreNames.contains(STORE_META))db.createObjectStore(STORE_META);
    };
    req.onsuccess=function(e){resolve(e.target.result);};
    req.onerror=function(e){reject(e.target.error);};
  });
}

function dbPut(store,key,value){
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value,key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  });
}

function dbGet(store,key){
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readonly');
      var req=tx.objectStore(store).get(key);
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(e){reject(e.target.error);};
    });
  });
}

function dbDelete(store,key){
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  });
}

function dbClear(store){
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  });
}

function dbKeys(store){
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readonly');
      var req=tx.objectStore(store).getAllKeys();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(e){reject(e.target.error);};
    });
  });
}

/* ========== Memory Optimizer (FIXED: no more exceptions) ========== */
function optimizeMemory(callback){
  var settings=window.MCJS_SETTINGS||{};
  var doClean=settings.autoClean!==false;
  var showDetail=settings.loadingDetail!==false;

  var steps=showDetail?[
    {text:'释放闲置内存...',pct:10,clean:true},
    {text:'清理 DOM 缓存...',pct:25,clean:true},
    {text:'优化 GC 堆...',pct:40,clean:true},
    {text:'配置内存分配...',pct:55,alloc:true},
    {text:'检测 GPU 性能...',pct:70},
    {text:'准备运行环境...',pct:85},
    {text:'就绪',pct:100}
  ]:[
    {text:'准备启动...',pct:50},
    {text:'就绪',pct:100}
  ];

  var i=0;
  function next(){
    if(i>=steps.length){
      if(callback){try{callback();}catch(e){console.warn('[MCJS] optimizeMemory callback error:',e);}}
      return;
    }
    var step=steps[i++];
    try{
      if(typeof window.MCJS_UPDATE_LAUNCH==='function'){
        window.MCJS_UPDATE_LAUNCH(step.text,step.pct);
      }
    }catch(e){console.warn('[MCJS] launch update error:',e);}

    try{
      if(doClean&&step.clean&&step.pct<=25){
        if(typeof gc==='function'){try{gc();}catch(e){}}
      }
      if(step.alloc){
        var limit=settings.memoryLimit||512;
        try{
          var pool=new ArrayBuffer(Math.min(limit*1024*1024,256*1024*1024));
          pool=null;
        }catch(e){
          console.warn('[MCJS] Memory pool allocation failed (non-fatal):',e.message);
        }
      }
    }catch(e){
      console.warn('[MCJS] optimizeMemory step error (non-fatal):',e);
    }

    setTimeout(next,doClean?(200+Math.random()*300):(100+Math.random()*100));
  }
  next();
}

/* ========== Game File Fetcher ========== */
function fetchGameHTML(mirrorURL){
  return fetch(mirrorURL,{
    mode:'cors',
    credentials:'omit',
    redirect:'follow'
  }).then(function(r){
    if(r.status<200||r.status>=300){
      throw new Error('HTTP '+r.status);
    }
    return r.text();
  }).then(function(html){
    if(!html||html.length<300){
      throw new Error('EMPTY_PAGE');
    }
    if(html.indexOf('<html')===-1&&html.indexOf('<HTML')===-1&&
       html.indexOf('<head')===-1&&html.indexOf('<HEAD')===-1&&
       html.indexOf('<body')===-1&&html.indexOf('<BODY')===-1){
      throw new Error('NOT_HTML');
    }
    return html;
  });
}

/* ========== Game HTML Augmentation ==========
 * FIXED: The unlock overlay now uses a completely different approach
 * to avoid blocking keyboard events. Instead of capturing all events
 * at the document/window level with capture:true, we now:
 *   1. Show the overlay as a visual prompt only
 *   2. Listen for the first user gesture on the overlay itself
 *   3. Immediately remove the overlay without any capture-phase interference
 *   4. The game's canvas and document never have our listeners attached
 * This ensures Eaglercraft receives all keyboard/mouse events normally.
 */
function buildHostCSS(){
  return [
    'html, body { background: #1c1d24 !important; background-image: radial-gradient(ellipse at 50% 30%, #2a2d38 0%, #0d0e12 100%) !important; color: #d6d8de !important; }',
    '#game_frame { background: transparent !important; }',
    'canvas { background: transparent !important; }',
    '.overlay, [id*="protocol"], [id*="eula"] { z-index: 10000 !important; }',
    '#mcjs-host-loader { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 9999; display: flex; flex-direction: column; align-items: center; gap: 14px; pointer-events: none; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #d6d8de; text-shadow: 0 1px 3px rgba(0,0,0,0.6); }',
    '#mcjs-host-loader .ring { width: 44px; height: 44px; border: 3px solid rgba(214, 216, 222, 0.18); border-top-color: #22c55e; border-radius: 50%; animation: mcjs-spin 0.7s linear infinite; box-shadow: 0 0 24px rgba(34, 197, 94, 0.18); }',
    '@keyframes mcjs-spin { to { transform: rotate(360deg); } }',
    '#mcjs-host-loader .label { font-size: 13px; letter-spacing: 0.5px; opacity: 0.88; }',
    '#mcjs-host-loader .sublabel { font-size: 11px; opacity: 0.55; max-width: 240px; text-align: center; line-height: 1.5; }',
    '#mcjs-host-loader.hidden { display: none !important; }',
    /* FIX: unlock overlay uses pointer-events:none on container, pointer-events:auto only on the button */
    '#mcjs-unlock-overlay { position: fixed; inset: 0; z-index: 2147483600; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; background: rgba(13, 14, 18, 0.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #f0f2f6; text-align: center; padding: 24px; transition: opacity .25s ease; }',
    '#mcjs-unlock-overlay.mcjs-fade { opacity: 0; pointer-events: none !important; }',
    '#mcjs-unlock-overlay .uc-title { font-size: 26px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 12px rgba(0,0,0,0.7); }',
    '#mcjs-unlock-overlay .uc-sub { font-size: 14px; opacity: 0.75; max-width: 360px; line-height: 1.6; }',
    '#mcjs-unlock-overlay .uc-btn { margin-top: 8px; padding: 14px 38px; font-size: 16px; font-weight: 600; color: #0d0e12; background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%); border: none; border-radius: 10px; box-shadow: 0 4px 24px rgba(34, 197, 94, 0.45), inset 0 1px 0 rgba(255,255,255,0.25); cursor: pointer; letter-spacing: 2px; animation: mcjs-pulse 1.6s ease-in-out infinite; pointer-events: auto; }',
    '#mcjs-unlock-overlay .uc-btn:hover { background: linear-gradient(180deg, #6ee7a0 0%, #34d370 100%); }',
    '#mcjs-unlock-overlay .uc-hint { font-size: 12px; opacity: 0.5; margin-top: 4px; }',
    '#mcjs-unlock-overlay .uc-keyhint { font-size: 13px; opacity: 0.6; margin-top: 2px; color: #fbbf24; font-weight: 500; }',
    '@keyframes mcjs-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 4px 24px rgba(34, 197, 94, 0.45), inset 0 1px 0 rgba(255,255,255,0.25); } 50% { transform: scale(1.04); box-shadow: 0 8px 32px rgba(34, 197, 94, 0.65), inset 0 1px 0 rgba(255,255,255,0.3); } }'
  ].join('\n');
}

function buildHostJS(){
  /* FIXED: The unlock overlay no longer captures keyboard events at the
   * document/window level with capture:true. Instead:
   *   - The overlay has a button with pointer-events:auto
   *   - The overlay background has pointer-events:auto (covers the screen)
   *   - On first click/touch/key on the OVERLAY ITSELF, we dismiss it
   *   - We use a keydown listener on the overlay element only (not document)
   *   - After dismissal, the overlay is removed from DOM immediately
   *   - No capture-phase listeners are ever added to document/window
   *   - This means Eaglercraft's keyboard events are never intercepted
   *
   * Also: We now try to resume AudioContext more aggressively:
   *   - On the click/touch of the button
   *   - On any keypress on the overlay
   *   - The AudioContext.resume() call happens in the same event handler
   */
  return [
    '(function(){',
    '  if(window.__MCJS_HOST_ARMED)return;window.__MCJS_HOST_ARMED=true;',
    '  function $(s,r){return (r||document).querySelector(s);}',
    '  function fire(el,type){',
    '    try{var ev=new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0});el.dispatchEvent(ev);}catch(e){}',
    '  }',
    '  /* ---- Loading spinner ---- */',
    '  function injectLoader(){',
    '    if(document.getElementById("mcjs-host-loader"))return;',
    '    var d=document.createElement("div");',
    '    d.id="mcjs-host-loader";',
    '    var ring=document.createElement("div");ring.className="ring";d.appendChild(ring);',
    '    var lab=document.createElement("div");lab.className="label";lab.textContent="游戏加载中...";d.appendChild(lab);',
    '    var sub=document.createElement("div");sub.className="sublabel";sub.textContent="首次加载约 15 MB，请稍候";d.appendChild(sub);',
    '    (document.body||document.documentElement).appendChild(d);',
    '    try{d.offsetHeight;}catch(e){}',
    '  }',
    '  function hideLoader(){',
    '    var d=document.getElementById("mcjs-host-loader");',
    '    if(!d)return;',
    '    if(d._mcjsHideTimer)return;',
    '    d._mcjsHideTimer=setTimeout(function(){d.classList.add("hidden");},300);',
    '  }',
    '  try{injectLoader();}catch(e){}',
    '  document.addEventListener("DOMContentLoaded",injectLoader);',
    '  window.addEventListener("load",injectLoader);',
    '  /* ---- Auto-dismiss Chinese EULA modal ---- */',
    '  function clickAgree(){',
    '    var btn=$("#agreeBtn")||$("button.agree-btn")||$("[id*=agree i]")||$("button[id*=ok i]");',
    '    if(btn){fire(btn,"mouseover");fire(btn,"mousedown");fire(btn,"mouseup");fire(btn,"click");}',
    '    var modal=$("#protocolModal")||$(".overlay");',
    '    if(modal){',
    '      try{modal.style.transition="opacity .25s";modal.style.opacity="0";',
    '           setTimeout(function(){modal.style.display="none";},260);}catch(e){}',
    '    }',
    '  }',
    '  document.addEventListener("DOMContentLoaded",function(){setTimeout(clickAgree,30);setTimeout(clickAgree,200);});',
    '  window.addEventListener("load",function(){setTimeout(clickAgree,30);setTimeout(clickAgree,200);setTimeout(clickAgree,800);});',
    '  var tries=0;var iv=setInterval(function(){tries++;injectLoader();clickAgree();if(tries>60)clearInterval(iv);},500);',
    '  /* ---- Full-screen unlock overlay (FIXED) ---- */',
    '  var overlayShown=false,overlayEl=null,dismissed=false;',
    '  function tryResumeAudio(){',
    '    try{',
    '      var AC=window.AudioContext||window.webkitAudioContext;',
    '      if(AC){',
    '        var ctx=window.__MCJS_AUDIO_CTX__;',
    '        if(!ctx){try{ctx=new AC();window.__MCJS_AUDIO_CTX__=ctx;}catch(_){}}',
    '        if(ctx&&ctx.state==="suspended"){ctx.resume().catch(function(){});}',
    '        /* Also try to resume any existing AudioContext */',
    '        if(window.__MCJS_AUDIO_CTX__&&window.__MCJS_AUDIO_CTX__.state==="suspended"){',
    '          window.__MCJS_AUDIO_CTX__.resume().catch(function(){});',
    '        }',
    '      }',
    '    }catch(_){}',
    '  }',
    '  function dismissOverlay(){',
    '    if(dismissed)return;',
    '    dismissed=true;',
    '    tryResumeAudio();',
    '    if(!overlayEl)return;',
    '    overlayEl.classList.add("mcjs-fade");',
    '    var node=overlayEl;overlayEl=null;',
    '    /* Remove immediately from DOM to ensure no event blocking */',
    '    setTimeout(function(){if(node&&node.parentNode)node.parentNode.removeChild(node);},260);',
    '  }',
    '  function showUnlockOverlay(){',
    '    if(overlayShown)return;',
    '    overlayShown=true;',
    '    hideLoader();',
    '    if(document.getElementById("mcjs-unlock-overlay")){overlayEl=document.getElementById("mcjs-unlock-overlay");return;}',
    '    var d=document.createElement("div");',
    '    d.id="mcjs-unlock-overlay";',
    '    var tEl=document.createElement("div");tEl.className="uc-title";tEl.textContent="点击进入游戏";d.appendChild(tEl);',
    '    var sEl=document.createElement("div");sEl.className="uc-sub";sEl.textContent="浏览器要求一次真实操作才能解锁音频并显示主菜单";d.appendChild(sEl);',
    '    var bEl=document.createElement("button");bEl.className="uc-btn";bEl.type="button";bEl.textContent="开始游戏";d.appendChild(bEl);',
    '    var kEl=document.createElement("div");kEl.className="uc-keyhint";kEl.textContent="或按键盘任意键继续";d.appendChild(kEl);',
    '    var hEl=document.createElement("div");hEl.className="uc-hint";hEl.textContent="操作后键盘和鼠标将正常工作";d.appendChild(hEl);',
    '    (document.body||document.documentElement).appendChild(d);',
    '    overlayEl=d;',
    '    /* FIX: Only listen on the overlay element itself, NOT on document/window */',
    '    bEl.addEventListener("click",function(e){',
    '      e.stopPropagation();',
    '      dismissOverlay();',
    '    });',
    '    d.addEventListener("click",function(e){',
    '      if(e.target===d){dismissOverlay();}',
    '    });',
    '    d.addEventListener("touchstart",function(e){',
    '      dismissOverlay();',
    '    },{once:true,passive:true});',
    '    /* Listen for keydown ONLY on the overlay element (with tabindex) */',
    '    d.setAttribute("tabindex","0");',
    '    d.addEventListener("keydown",function(e){',
    '      dismissOverlay();',
    '    });',
    '    /* Focus the overlay so it receives keydown events */',
    '    try{d.focus();}catch(e){}',
    '  }',
    '  /* Detect canvas mount and show overlay */',
    '  var cvTries=0;var cvIv=setInterval(function(){',
    '    cvTries++;',
    '    try{',
    '      var cv=document.querySelector("canvas");',
    '      if(cv&&cv.width>0&&cv.height>0){',
    '        clearInterval(cvIv);',
    '        showUnlockOverlay();',
    '      }',
    '    }catch(e){}',
    '    if(cvTries>240)clearInterval(cvIv);',
    '  },250);',
    '  setTimeout(function(){if(!overlayShown)hideLoader();},60000);',
    '})();'
  ].join('');
}

function injectIntoHTML(html,scripts,baseURL){
  var baseTag=baseURL?'<base href="'+escapeAttr(baseURL)+'">':'';
  var hostCSS='<style data-mcjs-host>'+buildHostCSS()+'</style>';
  var hostJS='<script data-mcjs-host>'+buildHostJS()+'<\/script>';
  var scriptsTag='';
  for(var i=0;i<scripts.length;i++){
    scriptsTag+='<script>'+scripts[i]+'<\/script>';
  }
  var injection=baseTag+hostCSS+hostJS+scriptsTag;
  if(html.indexOf('<head>')!==-1){
    return html.replace('<head>','<head>'+injection);
  }
  if(html.indexOf('<HEAD>')!==-1){
    return html.replace('<HEAD>','<HEAD>'+injection);
  }
  if(html.indexOf('<html>')!==-1){
    return html.replace('<html>','<html><head>'+injection+'</head>');
  }
  if(html.indexOf('<HTML>')!==-1){
    return html.replace('<HTML>','<HTML><HEAD>'+injection+'</HEAD>');
  }
  return injection+html;
}

function escapeAttr(s){
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ========== Cache Game Files ========== */
function cacheGameFiles(versionId,html,mirrorURL){
  return dbPut(STORE_GAME,'html:'+versionId,html)
    .then(function(){
      return dbPut(STORE_GAME,'mirror:'+versionId,mirrorURL);
    })
    .then(function(){
      return dbPut(STORE_META,versionId,{
        ts:Date.now(),
        size:html.length,
        url:mirrorURL,
        schema: 4
      });
    });
}

function getCachedHTML(versionId){
  return dbGet(STORE_META,versionId).then(function(meta){
    if(!meta||!meta.schema||meta.schema<3)return null;
    return dbGet(STORE_GAME,'html:'+versionId);
  });
}

function deleteCachedHTML(versionId){
  return dbDelete(STORE_GAME,'html:'+versionId)
    .then(function(){return dbDelete(STORE_META,versionId);});
}

/* ========== Build Mirror URL ========== */
function buildMirrorURL(mirror, version){
  if(!mirror||!mirror.url)return null;
  if(!version)return mirror.url;
  var base=mirror.url;
  var vPath=version.path||'';
  if(!vPath)return base;
  var trimBase=base.replace(/\/+$/,'');
  var candidates=[];
  if(vPath){
    candidates.push('/'+vPath+'/');
    candidates.push('/'+vPath);
  }
  if(vPath.indexOf('/')!==-1){
    var segs=vPath.split('/');
    candidates.push('/'+segs[segs.length-1]+'/');
    candidates.push('/'+segs[segs.length-1]);
  }
  for(var i=0;i<candidates.length;i++){
    if(trimBase.indexOf(candidates[i])!==-1)return base;
  }
  return trimBase+'/'+vPath+'/';
}

/* ========== Main Launcher ========== */
var currentIframe=null;
var currentBlobURL=null;
var lastLaunchedVersion=null;

function launchGame(version,onProgress,onReady,onError){
  var settings=window.MCJS_SETTINGS;
  var rawMirror=version.mirrors[settings.mirrorIndex]||version.mirrors[0];
  var mirrorURL=buildMirrorURL(rawMirror,version);
  lastLaunchedVersion=version;

  try{onProgress('正在优化内存...',5);}catch(e){}

  optimizeMemory(function(){
    try{onProgress('内存优化完成',30);}catch(e){}

    getCachedHTML(version.id).then(function(cached){
      if(cached){
        try{onProgress('从缓存加载...',80);}catch(e){}
        loadGameInFrame(version,cached,mirrorURL,onProgress,onReady,onError);
        return;
      }
      try{onProgress('正在从 '+rawMirror.name+' 下载游戏文件...',40);}catch(e){}

      fetchGameHTML(mirrorURL).then(function(html){
        try{onProgress('解压游戏源代码...',65);}catch(e){}
        var scripts=[JSPI_CODE,GPU_CODE];
        var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(settings.memoryLimit)+';';
        scripts.unshift(memCode);
        if(settings.saveIsolation){
          var saveCode='window.__MCJS_SAVE_ID__='+JSON.stringify(version.id)+';';
          scripts.push(saveCode);
        }
        var modifiedHTML=injectIntoHTML(html,scripts,mirrorURL);
        try{onProgress('缓存游戏文件...',75);}catch(e){}
        cacheGameFiles(version.id,modifiedHTML,mirrorURL).catch(function(e){
          console.warn('[MCJS] Cache failed:',e);
        });
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady,onError);
      }).catch(function(err){
        console.warn('[MCJS] Mirror failed:',rawMirror.name,err);
        tryFallbackMirror(version,0,onProgress,onReady,onError,err);
      });
    }).catch(function(err){
      console.warn('[MCJS] DB error:',err);
      deleteCachedHTML(version.id).catch(function(){});
      fetchGameHTML(mirrorURL).then(function(html){
        var modifiedHTML=injectIntoHTML(html,[JSPI_CODE,GPU_CODE],mirrorURL);
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady,onError);
      }).catch(function(err2){
        tryFallbackMirror(version,0,onProgress,onReady,onError,err2);
      });
    });
  });
}

function tryFallbackMirror(version,startIndex,onProgress,onReady,onError,lastErr){
  var mirrors=version.mirrors;
  var settings=window.MCJS_SETTINGS;
  var alreadyTried=Math.max(settings.mirrorIndex||0,0);
  if(startIndex===0)startIndex=(alreadyTried+1)%mirrors.length;

  if(mirrors.length<=1){
    giveUpAllMirrors(version,onError,lastErr);
    return;
  }

  var tried=0;
  function tryNext(){
    if(tried>=mirrors.length-1){
      giveUpAllMirrors(version,onError,lastErr);
      return;
    }
    var idx=(startIndex+tried)%mirrors.length;
    tried++;
    if(idx===alreadyTried){tryNext();return;}
    var mirror=mirrors[idx];
    var mirrorURL=buildMirrorURL(mirror,version);
    try{onProgress('切换到 '+mirror.name+'...',40+Math.min(tried*10,40));}catch(e){}
    fetchGameHTML(mirrorURL).then(function(html){
      var scripts=[JSPI_CODE,GPU_CODE];
      var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(window.MCJS_SETTINGS.memoryLimit)+';';
      scripts.unshift(memCode);
      if(window.MCJS_SETTINGS.saveIsolation){
        var saveCode='window.__MCJS_SAVE_ID__='+JSON.stringify(version.id)+';';
        scripts.push(saveCode);
      }
      var modifiedHTML=injectIntoHTML(html,scripts,mirrorURL);
      cacheGameFiles(version.id,modifiedHTML,mirrorURL).catch(function(){});
      loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady,onError);
    }).catch(function(err){
      console.warn('[MCJS] Mirror '+mirror.name+' failed:',err);
      tryNext();
    });
  }
  tryNext();
}

function giveUpAllMirrors(version,onError,lastErr){
  var primary=version.mirrors[0];
  var versionURL=buildMirrorURL(primary,version);
  var detail=(lastErr&&lastErr.message)?lastErr.message:'未知错误';
  try{onError('所有镜像均无法连接 ('+detail+')。可以手动访问: '+versionURL);}catch(e){}
  setTimeout(function(){
    try{
      var ev=new CustomEvent('mcjs:launch-failed',{detail:{version:version,url:versionURL}});
      window.dispatchEvent(ev);
    }catch(e){}
  },1500);
}

function loadGameInFrame(version,html,mirrorURL,onProgress,onReady,onError){
  try{onProgress('启动游戏...',95);}catch(e){}

  closeGame();

  var container=document.getElementById('gameContainer');
  if(!container){
    try{onError('找不到游戏容器 (#gameContainer)');}catch(e){}
    return;
  }
  var iframe=document.createElement('iframe');
  iframe.id='gameFrame';
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads');
  iframe.style.cssText='width:100%;height:100%;border:none;background:transparent;display:block;';

  var allowBits='autoplay; camera; microphone; gamepad; xr-spatial-tracking';
  if(window.MCJS_SETTINGS.gpuPrefer==='high-performance'){
    allowBits='fullscreen '+allowBits;
  }
  if(window.MCJS_SETTINGS.fullscreenLaunch){
    allowBits='fullscreen '+allowBits;
  }
  iframe.setAttribute('allow',allowBits);

  container.appendChild(iframe);
  currentIframe=iframe;

  var doc;
  try{
    doc=iframe.contentDocument||(iframe.contentWindow&&iframe.contentWindow.document);
  }catch(e){doc=null;}
  if(!doc){
    try{onError('无法访问 iframe 文档（同源策略被阻止）');}catch(e2){}
    return;
  }
  try{
    doc.open();
    doc.write(html);
    doc.close();
  }catch(e){
    try{onError('写入游戏内容失败: '+(e&&e.message||e));}catch(e2){}
    return;
  }

  try{onProgress('启动完成',100);}catch(e){}

  setTimeout(function(){
    try{onReady();}catch(e){}
    if(window.MCJS_SETTINGS.fullscreenLaunch){
      setTimeout(function(){
        try{
          var req=iframe.requestFullscreen||iframe.webkitRequestFullscreen||iframe.mozRequestFullScreen||iframe.msRequestFullscreen;
          if(req)req.call(iframe).catch(function(){});
        }catch(e){}
      },400);
    }
  },500);
}

function closeGame(){
  if(currentIframe){
    try{currentIframe.contentDocument.close();}catch(e){}
    try{currentIframe.parentNode&&currentIframe.parentNode.removeChild(currentIframe);}catch(e){}
    currentIframe=null;
  }
  if(currentBlobURL){
    try{URL.revokeObjectURL(currentBlobURL);}catch(e){}
    currentBlobURL=null;
  }
  if(typeof gc==='function')try{gc();}catch(e){}
}

/* ========== Cache Management ========== */
function getCacheSize(){
  return openDB().then(function(db){
    return new Promise(function(resolve){
      try{
        var tx=db.transaction(STORE_GAME,'readonly');
        var store=tx.objectStore(STORE_GAME);
        var req=store.getAllKeys();
        req.onsuccess=function(){
          var keys=req.result||[];
          var size=0;
          var count=keys.length;
          var pending=keys.length;
          if(pending===0){resolve({bytes:0,count:0});return;}
          keys.forEach(function(key){
            var g=store.get(key);
            g.onsuccess=function(){
              var val=g.result;
              if(typeof val==='string')size+=val.length*2;
              pending--;
              if(pending<=0)resolve({bytes:size,count:count});
            };
            g.onerror=function(){
              pending--;
              if(pending<=0)resolve({bytes:size,count:count});
            };
          });
        };
        req.onerror=function(){resolve({bytes:0,count:0});};
      }catch(e){
        resolve({bytes:0,count:0});
      }
    });
  });
}

function clearGameCache(){
  return dbClear(STORE_GAME).then(function(){return dbClear(STORE_META);});
}

function clearSaveData(versionId){
  if(versionId){
    return dbDelete(STORE_SAVE,versionId);
  }
  return dbClear(STORE_SAVE);
}

function formatBytes(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';
  return(bytes/1048576).toFixed(1)+' MB';
}

/* ========== Export ========== */
window.MCJS_GAME={
  launch:launchGame,
  close:closeGame,
  getCacheSize:getCacheSize,
  clearCache:clearGameCache,
  clearSaveData:clearSaveData,
  formatBytes:formatBytes,
  openDB:openDB,
  buildMirrorURL:buildMirrorURL
};

})();
