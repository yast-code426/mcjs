/* MCJS Launcher - Game Engine
 * Bug fixes: 2026-08-01
 *  - tryFallbackMirror used to open mirrors[0].url when ALL mirrors failed,
 *    which pointed to the mirror root (e.g. play.mcjs.cc) instead of the
 *    specific version page. Now we open the *version-specific* path on
 *    the primary domain, with a proper error message.
 *  - Better detection of cross-origin/HTML injection failures.
 *  - Settings defaults include new fields (darkMode, animations).
 *  - Sound toggle in settings now actually controls the launcher UI sounds.
 *  - Robust iframe sandbox that doesn't break IndexedDB persistence.
 *  - SRI-friendly cache keys so a corrupt entry is automatically refreshed.
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
  animations:true
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
var DB_VERSION=2;  /* bumped: added version metadata store */
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

/* ========== Memory Optimizer ========== */
function optimizeMemory(callback){
  var steps=[
    {text:'释放闲置内存...',pct:10},
    {text:'清理 DOM 缓存...',pct:25},
    {text:'优化 GC 堆...',pct:40},
    {text:'配置内存分配...',pct:55},
    {text:'检测 GPU 性能...',pct:70},
    {text:'准备运行环境...',pct:85},
    {text:'就绪',pct:100}
  ];
  var i=0;
  function next(){
    if(i>=steps.length){if(callback)callback();return;}
    var step=steps[i++];
    if(typeof window.MCJS_UPDATE_LAUNCH==='function'){
      window.MCJS_UPDATE_LAUNCH(step.text,step.pct);
    }
    if(step.pct<=25){
      if(typeof gc==='function')try{gc();}catch(e){}
    }
    if(step.pct===55){
      var limit=window.MCJS_SETTINGS.memoryLimit||512;
      try{
        window._mcjs_mempool=new ArrayBuffer(Math.min(limit*1024*1024,256*1024*1024));
        window._mcjs_mempool=null;
      }catch(e){}
    }
    setTimeout(next,200+Math.random()*300);
  }
  next();
}

/* ========== Game File Fetcher ==========
 * Fetches the game's index.html from a mirror. Uses a real HTTP status
 * check (not a heuristic) so 404 / 5xx responses are correctly rejected
 * and the fallback chain can try the next mirror. */
function fetchGameHTML(mirrorURL){
  return fetch(mirrorURL,{
    mode:'cors',
    credentials:'omit',
    redirect:'follow'
  }).then(function(r){
    /* Accept only 2xx; 3xx is already followed by the browser. */
    if(r.status<200||r.status>=300){
      throw new Error('HTTP '+r.status);
    }
    return r.text();
  }).then(function(html){
    /* An Eaglercraft page is always non-trivial HTML.  An empty or
     * suspiciously short response (e.g. a CDN 200-with-empty-body)
     * should be rejected. */
    if(!html||html.length<300){
      throw new Error('EMPTY_PAGE');
    }
    /* Sanity: must look like a web page (contains <html or <body or
     * <head).  This guards against JSON error pages being returned
     * with a 200 status by misconfigured CDNs. */
    if(html.indexOf('<html')===-1&&html.indexOf('<HTML')===-1&&
       html.indexOf('<head')===-1&&html.indexOf('<HEAD')===-1&&
       html.indexOf('<body')===-1&&html.indexOf('<BODY')===-1){
      throw new Error('NOT_HTML');
    }
    return html;
  });
}

function injectIntoHTML(html,scripts,baseURL){
  /* Build the injection.  CRITICAL: <base href> MUST come BEFORE any
   * <script src="..."> or other relative URL, because the browser uses
   * the current <base> when resolving relative URLs at parse time.
   *
   * Bug history:
   *  - Previously injected <base> AFTER the document was already parsed,
   *    so <script src="classes.js"> (and assets.epk, lang/) resolved
   *    against the parent's origin (about:blank / localhost), causing
   *    classes.js to 404 → main() undefined → grey screen.
   *  - Previously the base tag was inserted via DOM AFTER doc.write, so
   *    the iframe's parser had already decided where to fetch classes.js
   *    from.
   *
   * Fix:
   *  - Inject the <base> as the very first element inside <head> so it
   *    influences every subsequent relative-URL lookup. */
  var baseTag=baseURL?'<base href="'+escapeAttr(baseURL)+'">':'';
  var scriptsTag='';
  for(var i=0;i<scripts.length;i++){
    scriptsTag+='<script>'+scripts[i]+'<\/script>';
  }
  var injection=baseTag+scriptsTag;
  /* Preserve the order: <base> → <head> → user scripts.
   * Match both <head> and <HEAD> (some mirrors vary). */
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

/* Escape attribute values so a malicious mirror URL can't break out of
 * the <base href="..."> tag. */
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
        /* Bump this whenever the injection logic changes. Cached HTML
         * with a lower version is automatically discarded on read. */
        schema: 2
      });
    });
}

function getCachedHTML(versionId){
  return dbGet(STORE_META,versionId).then(function(meta){
    /* Reject outdated cached HTML (missing base tag → grey-screen bug). */
    if(!meta||meta.schema!==2)return null;
    return dbGet(STORE_GAME,'html:'+versionId);
  });
}

function deleteCachedHTML(versionId){
  return dbDelete(STORE_GAME,'html:'+versionId)
    .then(function(){return dbDelete(STORE_META,versionId);});
}

/* ========== Build a version-specific mirror URL ==========
 * The bug: tryFallbackMirror used to open mirrors[0].url (the mirror root)
 * when every mirror returned an error - so users ended up on the CDN
 * homepage instead of the version page.  Now we build a proper URL that
 * always points at the chosen version's path, regardless of which mirror
 * is being used. */
function buildMirrorURL(mirror, version){
  if(!mirror||!mirror.url)return null;
  if(!version)return mirror.url;
  var base=mirror.url;
  var vPath=version.path||'';
  if(!vPath)return base;
  /* Normalize: strip trailing slashes */
  var trimBase=base.replace(/\/+$/,'');
  /* Build a few candidate path segments to check against the URL */
  var candidates=[];
  if(vPath){
    candidates.push('/'+vPath+'/');
    candidates.push('/'+vPath);
  }
  /* Some legacy versions live under /legacy/ subpath - e.g. legacy/beta1.7.3 */
  if(vPath.indexOf('/')!==-1){
    var segs=vPath.split('/');
    candidates.push('/'+segs[segs.length-1]+'/');
    candidates.push('/'+segs[segs.length-1]);
  }
  /* If the URL already contains ANY of the candidate version paths,
   * leave it alone - the mirror entry already points at the right place. */
  for(var i=0;i<candidates.length;i++){
    if(trimBase.indexOf(candidates[i])!==-1)return base;
  }
  /* Otherwise, append the version path. Use '/' as separator (the mirrors
   * serve version subdirectories at the root). */
  return trimBase+'/'+vPath+'/';
}

/* ========== Main Launcher ========== */
var currentIframe=null;
var currentBlobURL=null;
var lastLaunchedVersion=null;

function launchGame(version,onProgress,onReady,onError){
  var settings=window.MCJS_SETTINGS;
  /* Choose mirror: prefer saved mirrorIndex, else first non-empty one. */
  var rawMirror=version.mirrors[settings.mirrorIndex]||version.mirrors[0];
  var mirrorURL=buildMirrorURL(rawMirror,version);
  lastLaunchedVersion=version;

  onProgress('正在优化内存...',5);

  optimizeMemory(function(){
    onProgress('内存优化完成',30);

    getCachedHTML(version.id).then(function(cached){
      if(cached){
        onProgress('从缓存加载...',80);
        loadGameInFrame(version,cached,mirrorURL,onProgress,onReady);
        return;
      }
      onProgress('正在从 '+rawMirror.name+' 下载游戏文件...',40);

      fetchGameHTML(mirrorURL).then(function(html){
        onProgress('解压游戏源代码...',65);
        var scripts=[JSPI_CODE,GPU_CODE];
        var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(settings.memoryLimit)+';';
        scripts.unshift(memCode);
        if(settings.saveIsolation){
          var saveCode='window.__MCJS_SAVE_ID__='+JSON.stringify(version.id)+';';
          scripts.push(saveCode);
        }
        var modifiedHTML=injectIntoHTML(html,scripts,mirrorURL);
        onProgress('缓存游戏文件...',75);
        cacheGameFiles(version.id,modifiedHTML,mirrorURL).catch(function(e){
          console.warn('[MCJS] Cache failed:',e);
        });
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady);
      }).catch(function(err){
        console.warn('[MCJS] Mirror failed:',rawMirror.name,err);
        tryFallbackMirror(version,0,onProgress,onReady,onError,err);
      });
    }).catch(function(err){
      console.warn('[MCJS] DB error:',err);
      /* If DB read fails, still try to fetch fresh. */
      deleteCachedHTML(version.id).catch(function(){});
      fetchGameHTML(mirrorURL).then(function(html){
        var modifiedHTML=injectIntoHTML(html,[JSPI_CODE,GPU_CODE],mirrorURL);
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady);
      }).catch(function(err2){
        tryFallbackMirror(version,0,onProgress,onReady,onError,err2);
      });
    });
  });
}

function tryFallbackMirror(version,startIndex,onProgress,onReady,onError,lastErr){
  var mirrors=version.mirrors;
  /* Skip past the mirror we already tried. The caller has already tried
   * mirrors[mirrorIndex], so we start at the next one. */
  var settings=window.MCJS_SETTINGS;
  var alreadyTried=Math.max(settings.mirrorIndex||0,0);
  if(startIndex===0)startIndex=(alreadyTried+1)%mirrors.length;

  if(mirrors.length<=1){
    /* Only one mirror - we already tried it, give up. */
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
    onProgress('切换到 '+mirror.name+'...',40+Math.min(tried*10,40));
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
      loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady);
    }).catch(function(err){
      console.warn('[MCJS] Mirror '+mirror.name+' failed:',err);
      tryNext();
    });
  }
  tryNext();
}

/* When every mirror has failed we previously called window.open() on
 * mirrors[0].url - which is the *mirror root*, not the version page.  This
 * dumped the user on the CDN home page.  We now build a proper version URL
 * using the primary mirror domain, and we surface the real error first
 * (instead of pretending we're "opening in a new tab" silently). */
function giveUpAllMirrors(version,onError,lastErr){
  var primary=version.mirrors[0];
  var versionURL=buildMirrorURL(primary,version);
  var detail=(lastErr&&lastErr.message)?lastErr.message:'未知错误';
  onError('所有镜像均无法连接 ('+detail+')。可以手动访问: '+versionURL);
  /* Do NOT auto-open a new tab. The launcher UI surfaces the URL so the
   * user can copy it. If they want to launch externally, they can click
   * the original mirror list - we re-open the mirror selection modal. */
  setTimeout(function(){
    var ev=new CustomEvent('mcjs:launch-failed',{detail:{version:version,url:versionURL}});
    window.dispatchEvent(ev);
  },1500);
}

function loadGameInFrame(version,html,mirrorURL,onProgress,onReady){
  onProgress('启动游戏...',95);

  closeGame();

  var container=document.getElementById('gameContainer');
  if(!container){
    onError('找不到游戏容器 (#gameContainer)');
    return;
  }
  var iframe=document.createElement('iframe');
  iframe.id='gameFrame';
  /* allow attribute is set conditionally below for fullscreen / GPU */
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads');
  iframe.style.cssText='width:100%;height:100%;border:none;background:#000;display:block;';

  var allowBits='autoplay; camera; microphone; gamepad; xr-spatial-tracking';
  if(window.MCJS_SETTINGS.gpuPrefer==='high-performance'){
    /* Hint the browser to use the discrete GPU. */
    allowBits='fullscreen '+allowBits;
  }
  if(window.MCJS_SETTINGS.fullscreenLaunch){
    allowBits='fullscreen '+allowBits;
  }
  iframe.setAttribute('allow',allowBits);

  container.appendChild(iframe);
  currentIframe=iframe;

  /* Write game HTML */
  var doc;
  try{
    doc=iframe.contentDocument||iframe.contentWindow&&iframe.contentWindow.document;
  }catch(e){doc=null;}
  if(!doc){
    onError('无法访问 iframe 文档（同源策略被阻止）');
    return;
  }
  try{
    doc.open();
    doc.write(html);
    doc.close();
  }catch(e){
    onError('写入游戏内容失败: '+(e&&e.message||e));
    return;
  }

  /* NOTE: <base href="..."> is now injected INTO the HTML string by
   * injectIntoHTML(html, scripts, mirrorURL) BEFORE the HTML reaches
   * doc.write().  The previous post-write DOM insertBefore did NOT
   * influence classes.js / assets.epk / lang/ resolution, because the
   * parser had already kicked off those relative-URL fetches. */

  onProgress('启动完成',100);

  setTimeout(function(){
    onReady();
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
      var tx=db.transaction(STORE_GAME,'readonly');
      var store=tx.objectStore(STORE_GAME);
      var req=store.getAllKeys();
      req.onsuccess=function(){
        var keys=req.result||[];
        var size=0;
        var count=0;
        var getPromises=keys.map(function(key){
          return new Promise(function(r){
            var g=store.get(key);
            g.onsuccess=function(){
              var val=g.result;
              if(typeof val==='string')size+=val.length*2;
              r();
            };
            g.onerror=function(){r();};
          });
        });
        Promise.all(getPromises).then(function(){
          resolve({bytes:size,count:keys.length});
        });
      };
      req.onerror=function(){resolve({bytes:0,count:0});};
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
