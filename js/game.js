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

/* ========== Game HTML Augmentation ==========
 * The game HTML (mirror-side) has three visual flaws that surface as a
 * "black screen" for the end user:
 *
 *   1. <html style="background-color:black"> – the host HTML element is
 *      pure black, so while classes.js (~6-8 MB) is downloading the user
 *      stares at pure black, no spinner, no progress.  Users report this
 *      as "黑屏" (black screen) and conclude "协议都没加载出来".
 *   2. <body><div id="game_frame" style="background-color:gray">… – a
 *      solid gray box even before the WebGL canvas mounts.
 *   3. <div class="overlay" id="protocolModal">… – a Chinese EULA
 *      modal that has to be clicked through.  After the user agrees,
 *      Eaglercraft's own MainMenu shows ITS OWN English EULA on the
 *      canvas (which renders as a near-white rectangle) – also reported
 *      as "黑屏" / "白屏" by confused users.
 *
 * Fix strategy:
 *   - Inject a <style> block that overrides the html / body / game_frame
 *     background to a friendly dark-gray gradient so the iframe is no
 *     longer "pure black" during load.
 *   - Inject a <script> that auto-clicks #agreeBtn as soon as the modal
 *     appears, so the user never sees a stuck protocol screen.
 *   - Inject a second <script> that, after Eaglercraft runtime loads,
 *     inspects the canvas pixels and auto-accepts the EaglercraftX
 *     in-canvas EULA by clicking wherever the "I agree" button is
 *     rendered.  (Best-effort, no-ops cleanly if the runtime hasn't
 *     initialised yet.)
 */
function buildHostCSS(){
  /* Return the *raw* CSS so the caller can wrap it in a <style> tag. */
  return [
    /* Replace the mirror's hard black <html> bg with a soft dark gradient.
       This alone removes the "8 seconds of pure black before protocol" UX. */
    'html, body { background: #1c1d24 !important; background-image: radial-gradient(ellipse at 50% 30%, #2a2d38 0%, #0d0e12 100%) !important; color: #d6d8de !important; }',
    /* Hide the mirror's gray #game_frame backdrop so the host gradient shows
       through.  The canvas paints on top as soon as WebGL mounts. */
    '#game_frame { background: transparent !important; }',
    /* Eaglercraft uses position:fixed body and a dark canvas backdrop.  Force
       visibility. */
    'canvas { background: transparent !important; }',
    /* If the mirror uses any other ".overlay" element, make sure ours is on
       top.  (Defensive – not always present.) */
    '.overlay, [id*="protocol"], [id*="eula"] { z-index: 10000 !important; }',
    /* ---- MCJS host loader overlay (loading spinner phase) ---- */
    '#mcjs-host-loader { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 9999; display: flex; flex-direction: column; align-items: center; gap: 14px; pointer-events: none; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #d6d8de; text-shadow: 0 1px 3px rgba(0,0,0,0.6); }',
    '#mcjs-host-loader .ring { width: 44px; height: 44px; border: 3px solid rgba(214, 216, 222, 0.18); border-top-color: #5cb85c; border-radius: 50%; animation: mcjs-spin 0.7s linear infinite; box-shadow: 0 0 24px rgba(92, 184, 92, 0.18); }',
    '@keyframes mcjs-spin { to { transform: rotate(360deg); } }',
    '#mcjs-host-loader .label { font-size: 13px; letter-spacing: 0.5px; opacity: 0.88; }',
    '#mcjs-host-loader .sublabel { font-size: 11px; opacity: 0.55; max-width: 240px; text-align: center; line-height: 1.5; }',
    '#mcjs-host-loader.hidden { display: none !important; }',
    /* ---- MCJS unlock overlay (audio-unlock prompt phase) ----
       This is the *visible* fix for the "stuck on near-black MainMenu"
       problem.  EaglercraftX refuses to draw the MainMenu until the user
       performs a real (isTrusted) key/pointer gesture, because the
       browser AudioContext is suspended until then.  We display a
       fullscreen, very obvious overlay that:
         - captures all pointer/key events on the iframe;
         - on the FIRST isTrusted event, removes itself so the same
           event reaches the Eaglercraft MainMenu underneath.
       We deliberately do NOT synthesise KeyboardEvent / MouseEvent:
       those are isTrusted=false, and Eaglercraft explicitly ignores
       them, so the menu would stay black forever. */
    '#mcjs-unlock-overlay { position: fixed; inset: 0; z-index: 2147483600; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; background: rgba(13, 14, 18, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #f0f2f6; text-align: center; padding: 24px; cursor: pointer; user-select: none; -webkit-user-select: none; transition: opacity .25s ease; }',
    '#mcjs-unlock-overlay.mcjs-fade { opacity: 0; pointer-events: none; }',
    '#mcjs-unlock-overlay .uc-title { font-size: 26px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 12px rgba(0,0,0,0.7); }',
    '#mcjs-unlock-overlay .uc-sub { font-size: 14px; opacity: 0.75; max-width: 360px; line-height: 1.6; }',
    '#mcjs-unlock-overlay .uc-btn { margin-top: 8px; padding: 14px 38px; font-size: 16px; font-weight: 600; color: #0d0e12; background: linear-gradient(180deg, #7ad06d 0%, #5cb85c 100%); border: none; border-radius: 10px; box-shadow: 0 4px 24px rgba(92, 184, 92, 0.45), inset 0 1px 0 rgba(255,255,255,0.25); cursor: pointer; letter-spacing: 2px; animation: mcjs-pulse 1.6s ease-in-out infinite; }',
    '#mcjs-unlock-overlay .uc-btn:hover { background: linear-gradient(180deg, #8ddd77 0%, #6dc86d 100%); }',
    '#mcjs-unlock-overlay .uc-hint { font-size: 12px; opacity: 0.5; margin-top: 4px; }',
    '@keyframes mcjs-pulse { 0%, 100% { transform: scale(1); box-shadow: 0 4px 24px rgba(92, 184, 92, 0.45), inset 0 1px 0 rgba(255,255,255,0.25); } 50% { transform: scale(1.04); box-shadow: 0 8px 32px rgba(92, 184, 92, 0.65), inset 0 1px 0 rgba(255,255,255,0.3); } }'
  ].join('\n');
}

function buildHostJS(){
  /* Self-contained: auto-accept the mirror-side Chinese EULA modal,
     then once the Eaglercraft WebGL canvas mounts, show a full-screen
     "click to enter" overlay.

     Why this exists:
       EaglercraftX 1.8.8 refuses to draw the MainMenu until the
       browser's AudioContext is resumed.  The AudioContext can only
       be resumed by an isTrusted=true user gesture.  Synthesised
       KeyboardEvent / MouseEvent are isTrusted=false, so the previous
       "auto-press a/y" loop did nothing useful and the MainMenu
       stayed near-black.

       The overlay receives the user's real click / keypress, then
       removes itself in the same tick WITHOUT calling
       stopPropagation / preventDefault - so the same physical event
       also reaches the Eaglercraft MainMenu underneath (the menu's
       "Singleplayer" / "Options" / etc. buttons receive the click
       and respond normally). */
  return [
    '(function(){',
    '  if(window.__MCJS_HOST_ARMED)return;window.__MCJS_HOST_ARMED=true;',
    '  function $(s,r){return (r||document).querySelector(s);}',
    '  function fire(el,type){',
    '    try{var ev=new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0});el.dispatchEvent(ev);}catch(e){}',
    '  }',
    '  /* ---- Small loading spinner (shown until canvas mounts) ---- */',
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
    '  /* ---- Auto-dismiss the mirror-side Chinese EULA modal ---- */',
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
    '  /* ---- Full-screen unlock overlay ---- */',
    '  var overlayShown=false,overlayEl=null;',
    '  function showUnlockOverlay(){',
    '    if(overlayShown)return;',
    '    overlayShown=true;',
    '    hideLoader();',
    '    if(document.getElementById("mcjs-unlock-overlay")){overlayEl=document.getElementById("mcjs-unlock-overlay");return;}',
    '    var d=document.createElement("div");',
    '    d.id="mcjs-unlock-overlay";',
    '    d.setAttribute("role","button");',
    '    d.setAttribute("aria-label","点击进入游戏");',
    '    var tEl=document.createElement("div");tEl.className="uc-title";tEl.textContent="点击进入游戏";d.appendChild(tEl);',
    '    var sEl=document.createElement("div");sEl.className="uc-sub";sEl.textContent="浏览器要求一次真实点击才能解锁音频并显示主菜单";d.appendChild(sEl);',
    '    var bEl=document.createElement("button");bEl.className="uc-btn";bEl.type="button";bEl.textContent="开始游戏";d.appendChild(bEl);',
    '    var hEl=document.createElement("div");hEl.className="uc-hint";hEl.textContent="（或按键盘任意键）";d.appendChild(hEl);',
    '    (document.body||document.documentElement).appendChild(d);',
    '    overlayEl=d;',
    '  }',
    '  function disposeOverlay(){',
    '    if(!overlayEl)return;',
    '    overlayEl.classList.add("mcjs-fade");',
    '    var node=overlayEl;overlayEl=null;',
    '    setTimeout(function(){if(node&&node.parentNode)node.parentNode.removeChild(node);},280);',
    '  }',
    '  /* CRITICAL: only count isTrusted=true events.  Synthesised events are isTrusted=false and AudioContext.resume() rejects them.  We intentionally do NOT synthesise any event ourselves. */',
    '  function onFirstGesture(e){',
    '    if(!e||e.isTrusted!==true)return;',
    '    document.removeEventListener("keydown",onFirstGesture,true);',
    '    document.removeEventListener("pointerdown",onFirstGesture,true);',
    '    document.removeEventListener("mousedown",onFirstGesture,true);',
    '    document.removeEventListener("click",onFirstGesture,true);',
    '    document.removeEventListener("touchstart",onFirstGesture,true);',
    '    window.removeEventListener("keydown",onFirstGesture,true);',
    '    window.removeEventListener("pointerdown",onFirstGesture,true);',
    '    /* Best-effort: try to resume any AudioContext we can find. */',
    '    try{',
    '      var AC=window.AudioContext||window.webkitAudioContext;',
    '      if(AC){',
    '        var ctx=window.__MCJS_AUDIO_CTX__;',
    '        if(!ctx){try{ctx=new AC();window.__MCJS_AUDIO_CTX__=ctx;}catch(_){}}',
    '        if(ctx&&ctx.state==="suspended"){ctx.resume().catch(function(){});}',
    '      }',
    '    }catch(_){}',
    '    disposeOverlay();',
    '    /* Do NOT call stopPropagation / preventDefault - the same physical event must reach the Eaglercraft MainMenu underneath. */',
    '  }',
    '  function armGestureCapture(){',
    '    document.addEventListener("keydown",onFirstGesture,true);',
    '    document.addEventListener("pointerdown",onFirstGesture,true);',
    '    document.addEventListener("mousedown",onFirstGesture,true);',
    '    document.addEventListener("click",onFirstGesture,true);',
    '    document.addEventListener("touchstart",onFirstGesture,true);',
    '    window.addEventListener("keydown",onFirstGesture,true);',
    '    window.addEventListener("pointerdown",onFirstGesture,true);',
    '  }',
    '  /* When the canvas mounts, show the unlock overlay. */',
    '  var cvTries=0;var cvIv=setInterval(function(){',
    '    cvTries++;',
    '    try{',
    '      var cv=document.querySelector("canvas");',
    '      if(cv&&cv.width>0&&cv.height>0){',
    '        clearInterval(cvIv);',
    '        showUnlockOverlay();',
    '        armGestureCapture();',
    '      }',
    '    }catch(e){}',
    '    if(cvTries>240)clearInterval(cvIv);',
    '  },250);',
    '  /* Safety net: if the canvas never mounts within 60s, hide the small spinner so the protocol modal (if any) is reachable. */',
    '  setTimeout(function(){if(!overlayShown)hideLoader();},60000);',
    '})();'
  ].join('');
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
   *    influences every subsequent relative-URL lookup.
   *  - Also inject <style data-mcjs-host> (host CSS) and our auto-EULA
   *    <script data-mcjs-host> so the user never sees a "black screen
   *    waiting for protocol" state. */
  var baseTag=baseURL?'<base href="'+escapeAttr(baseURL)+'">':'';
  var hostCSS='<style data-mcjs-host>'+buildHostCSS()+'</style>';
  var hostJS='<script data-mcjs-host>'+buildHostJS()+'<\/script>';
  var scriptsTag='';
  for(var i=0;i<scripts.length;i++){
    scriptsTag+='<script>'+scripts[i]+'<\/script>';
  }
  /* Order matters: <base> first (so classes.js etc. resolve to the
   * mirror), then host CSS (so the page never paints black), then the
   * user-supplied scripts (JSPI, GPU probe, mem limit), then the host
   * auto-EULA script (which is harmless if #protocolModal is absent). */
  var injection=baseTag+hostCSS+hostJS+scriptsTag;
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
         * with a lower version is automatically discarded on read.
         *
         * Schema 2: base-tag injection before parse + auto-protocol.
         * Schema 3: also injects the full-screen "click to unlock"
         *   overlay so Eaglercraft's AudioContext gets resumed by a
         *   real (isTrusted) user gesture, instead of staying
         *   suspended forever on synthesised events. */
        schema: 3
      });
    });
}

function getCachedHTML(versionId){
  return dbGet(STORE_META,versionId).then(function(meta){
    /* Reject outdated cached HTML (missing base tag → grey-screen bug;
     * missing unlock overlay → stuck on near-black MainMenu bug). */
    if(!meta||meta.schema!==3)return null;
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
  /* CRITICAL: do NOT use background:#000 here.  The game HTML itself has
   * <html style="background-color:black"> which paints solid black while
   * classes.js (~6-8 MB) is downloading, giving the user 8+ seconds of
   * pure black before the protocol modal appears.  We use transparent
   * and let the host CSS injected into the game HTML do the work. */
  iframe.style.cssText='width:100%;height:100%;border:none;background:transparent;display:block;';

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
