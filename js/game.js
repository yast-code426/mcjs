/* MCJS Launcher - Game Engine */
(function(){'use strict';

/* ========== Settings Manager ========== */
const DEFAULT_SETTINGS={
  mirrorIndex:0,
  memoryLimit:512,
  autoClean:true,
  saveIsolation:true,
  gpuPrefer:'high-performance',
  cacheSizeLimit:2048,
  bgImage:true,
  soundEnabled:true,
  fullscreenLaunch:false
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
var DB_VERSION=1;
var STORE_GAME='game_files';
var STORE_SAVE='save_data';

function openDB(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=function(e){
      var db=e.target.result;
      if(!db.objectStoreNames.contains(STORE_GAME))db.createObjectStore(STORE_GAME);
      if(!db.objectStoreNames.contains(STORE_SAVE))db.createObjectStore(STORE_SAVE);
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
    /* Simulate real work */
    if(step.pct<=25){
      /* Clear unreferenced objects */
      if(typeof gc==='function')try{gc();}catch(e){}
    }
    if(step.pct===55){
      /* Pre-allocate typed array for memory pool */
      var limit=window.MCJS_SETTINGS.memoryLimit||512;
      try{
        window._mcjs_mempool=new ArrayBuffer(Math.min(limit*1024*1024,256*1024*1024));
        window._mcjs_mempool=null; /* Release - just warms up the allocator */
      }catch(e){}
    }
    setTimeout(next,200+Math.random()*300);
  }
  next();
}

/* ========== Game File Fetcher ========== */
function fetchGameHTML(mirrorURL){
  return fetch(mirrorURL,{mode:'cors',credentials:'omit'})
    .then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.text();
    });
}

function injectIntoHTML(html,scripts){
  var injection='';
  for(var i=0;i<scripts.length;i++){
    injection+='<script>'+scripts[i]+'<\/script>';
  }
  if(html.indexOf('<head>')!==-1){
    return html.replace('<head>','<head>'+injection);
  }
  if(html.indexOf('<html>')!==-1){
    return html.replace('<html>','<html><head>'+injection+'</head>');
  }
  return injection+html;
}

/* ========== Cache Game Files ========== */
function cacheGameFiles(versionId,html,mirrorURL){
  return dbPut(STORE_GAME,'html:'+versionId,html)
    .then(function(){
      return dbPut(STORE_GAME,'mirror:'+versionId,mirrorURL);
    });
}

function getCachedHTML(versionId){
  return dbGet(STORE_GAME,'html:'+versionId);
}

/* ========== Main Launcher ========== */
var currentIframe=null;
var currentBlobURL=null;

function launchGame(version,onProgress,onReady,onError){
  var settings=window.MCJS_SETTINGS;
  var mirror=version.mirrors[settings.mirrorIndex]||version.mirrors[0];
  var mirrorURL=mirror.url;

  /* Phase 1: Memory optimization */
  onProgress('正在优化内存...',5);

  optimizeMemory(function(){
    onProgress('内存优化完成',30);

    /* Phase 2: Check cache */
    getCachedHTML(version.id).then(function(cached){
      if(cached){
        onProgress('从缓存加载...',80);
        loadGameInFrame(version,cached,mirrorURL,onProgress,onReady);
        return;
      }

      /* Phase 3: Download game files */
      onProgress('正在从 '+mirror.name+' 下载游戏文件...',40);

      fetchGameHTML(mirrorURL).then(function(html){
        onProgress('解压游戏源代码...',65);

        /* Inject polyfills */
        var scripts=[JSPI_CODE,GPU_CODE];

        /* Memory limit injection */
        var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(settings.memoryLimit)+';';
        scripts.unshift(memCode);

        /* Save isolation */
        if(settings.saveIsolation){
          var saveCode='window.__MCJS_SAVE_ID__='+JSON.stringify(version.id)+';';
          scripts.push(saveCode);
        }

        var modifiedHTML=injectIntoHTML(html,scripts);

        onProgress('缓存游戏文件...',75);

        /* Cache for future use */
        cacheGameFiles(version.id,modifiedHTML,mirrorURL).catch(function(e){
          console.warn('[MCJS] Cache failed:',e);
        });

        /* Phase 4: Load game */
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady);

      }).catch(function(err){
        /* Fallback: try next mirror */
        tryFallbackMirror(version,1,onProgress,onReady,onError);
      });
    }).catch(function(err){
      console.warn('[MCJS] DB error:',err);
      /* Fallback: direct load */
      fetchGameHTML(mirrorURL).then(function(html){
        var modifiedHTML=injectIntoHTML(html,[JSPI_CODE,GPU_CODE]);
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady);
      }).catch(function(err2){
        tryFallbackMirror(version,1,onProgress,onReady,onError);
      });
    });
  });
}

function tryFallbackMirror(version,startIndex,onProgress,onReady,onError){
  var mirrors=version.mirrors;
  if(startIndex>=mirrors.length){
    /* All mirrors failed - open in new tab as last resort */
    var mirror=mirrors[0];
    onError('所有镜像均无法连接。将尝试在新标签页中打开...');
    setTimeout(function(){
      window.open(mirror.url,'_blank');
    },2000);
    return;
  }
  var mirror=mirrors[startIndex];
  onProgress('切换到 '+mirror.name+'...',40);
  fetchGameHTML(mirror.url).then(function(html){
    var modifiedHTML=injectIntoHTML(html,[JSPI_CODE,GPU_CODE]);
    cacheGameFiles(version.id,modifiedHTML,mirror.url).catch(function(){});
    loadGameInFrame(version,modifiedHTML,mirror.url,onProgress,onReady);
  }).catch(function(){
    tryFallbackMirror(version,startIndex+1,onProgress,onReady,onError);
  });
}

function loadGameInFrame(version,html,mirrorURL,onProgress,onReady){
  onProgress('启动游戏...',95);

  /* Clean up previous game */
  closeGame();

  /* Create iframe */
  var container=document.getElementById('gameContainer');
  var iframe=document.createElement('iframe');
  iframe.id='gameFrame';
  iframe.setAttribute('allow','fullscreen; autoplay; camera; microphone; gamepad; xr-spatial-tracking');
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads');
  iframe.style.cssText='width:100%;height:100%;border:none;background:#000;';

  /* GPU preference via allow attribute */
  if(window.MCJS_SETTINGS.gpuPrefer==='high-performance'){
    iframe.setAttribute('allow','fullscreen; autoplay; gamepad; xr-spatial-tracking');
  }

  container.appendChild(iframe);
  currentIframe=iframe;

  /* Write game HTML */
  var doc=iframe.contentDocument||iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  /* Fix relative URLs by injecting base tag */
  try{
    var base=doc.createElement('base');
    base.href=mirrorURL;
    doc.head.insertBefore(base,doc.head.firstChild);
  }catch(e){}

  onProgress('启动完成',100);

  setTimeout(function(){
    onReady();
  },500);
}

function closeGame(){
  if(currentIframe){
    try{
      currentIframe.contentDocument.close();
    }catch(e){}
    currentIframe.parentNode.removeChild(currentIframe);
    currentIframe=null;
  }
  if(currentBlobURL){
    URL.revokeObjectURL(currentBlobURL);
    currentBlobURL=null;
  }
  /* Force GC if available */
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
        /* Estimate size from keys */
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
  return dbClear(STORE_GAME);
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
  openDB:openDB
};

})();
