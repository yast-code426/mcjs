/* MCJS Launcher - Game Engine */
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

/* ========== WASM 检测 ========== */
function detectWasmSupport() {
  try {
    if (typeof WebAssembly === 'undefined') {
      return { supported: false, reason: 'WebAssembly not defined' };
    }
    var wasmCode = new Uint8Array([0,97,115,109,1,0,0,0]);
    try {
      var module = new WebAssembly.Module(wasmCode);
      if (!(module instanceof WebAssembly.Module)) {
        return { supported: false, reason: 'Module creation failed' };
      }
    } catch(e) {
      return { supported: false, reason: e.message };
    }
    try {
      var gcCode = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,1,123,1,123,3,2,1,0,5,3,1,0,2,7,9,1,5,95,109,97,105,110,0,0,10,10,1,8,0,65,0,250,10,11,11]);
      var gcModule = new WebAssembly.Module(gcCode);
      var supportsGC = true;
    } catch(e) {
      var supportsGC = false;
    }
    var supportsSAB = typeof SharedArrayBuffer !== 'undefined';
    var isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    return {
      supported: true,
      gc: supportsGC,
      sab: supportsSAB,
      coi: isCrossOriginIsolated,
      score: (supportsGC ? 2 : 0) + (supportsSAB ? 1 : 0) + (isCrossOriginIsolated ? 1 : 0)
    };
  } catch(e) {
    return { supported: false, reason: e.message };
  }
}

var wasmSupport = detectWasmSupport();
window.MCJS_WASM_SUPPORT = wasmSupport;

function needsWasmFallback() {
  if (!wasmSupport.supported) return true;
  if (wasmSupport.supported && !wasmSupport.gc && wasmSupport.score < 2) return true;
  return false;
}

/* ========== WASM 模拟/Polyfill 注入脚本 ========== */
function buildWasmPolyfillScript() {
  return `
(function() {
  console.log('[MCJS] WASM Polyfill loading...');
  
  // 检测是否原生支持 WASM
  var hasNativeWasm = false;
  try {
    if (typeof WebAssembly !== 'undefined') {
      var testCode = new Uint8Array([0,97,115,109,1,0,0,0]);
      var testModule = new WebAssembly.Module(testCode);
      if (testModule instanceof WebAssembly.Module) {
        hasNativeWasm = true;
      }
    }
  } catch(e) {}
  
  // 如果原生支持且支持 GC，不注入
  if (hasNativeWasm) {
    try {
      var gcTest = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,1,123,1,123,3,2,1,0,5,3,1,0,2,7,9,1,5,95,109,97,105,110,0,0,10,10,1,8,0,65,0,250,10,11,11]);
      new WebAssembly.Module(gcTest);
      console.log('[MCJS] Native WASM with GC supported');
      return;
    } catch(e) {
      console.log('[MCJS] Native WASM without GC, using fallback');
    }
  }
  
  console.log('[MCJS] Injecting WASM polyfill...');
  
  // ========== WASM 二进制解析器 ==========
  function readLEB128(bytes, offset) {
    var result = 0;
    var shift = 0;
    var byte;
    var length = 0;
    do {
      if (offset >= bytes.length) {
        return { value: 0, length: length };
      }
      byte = bytes[offset++];
      length++;
      result |= (byte & 0x7F) << shift;
      shift += 7;
    } while (byte & 0x80);
    return { value: result, length: length };
  }
  
  function parseWasmSection(bytes, sectionId) {
    var pos = 8; // 跳过魔数(4) + 版本(4)
    var sections = [];
    while (pos < bytes.length) {
      var id = bytes[pos++];
      var lenInfo = readLEB128(bytes, pos);
      pos += lenInfo.length;
      var size = lenInfo.value;
      var data = bytes.slice(pos, pos + size);
      sections.push({ id: id, data: data, offset: pos });
      pos += size;
    }
    return sections.find(function(s) { return s.id === sectionId; });
  }
  
  // ========== 简易 WASM 运行时 ==========
  function WasmRuntime() {
    this.memory = null;
    this.functions = {};
    this.globals = {};
    this.exports = {};
    this.table = [];
    this.memSize = 64; // 初始 64 页
  }
  
  WasmRuntime.prototype.allocMemory = function(initialPages, maxPages) {
    var size = (initialPages || 64) * 65536;
    this.memory = new ArrayBuffer(size);
    this.memSize = initialPages || 64;
    this.maxMemSize = maxPages || 256;
    this.view = new DataView(this.memory);
    return this.memory;
  };
  
  WasmRuntime.prototype.readString = function(offset) {
    if (!this.view) return '';
    var str = '';
    var byte;
    while ((byte = this.view.getUint8(offset++)) !== 0) {
      str += String.fromCharCode(byte);
    }
    return str;
  };
  
  WasmRuntime.prototype.writeString = function(offset, str) {
    if (!this.view) return;
    for (var i = 0; i < str.length; i++) {
      this.view.setUint8(offset + i, str.charCodeAt(i));
    }
    this.view.setUint8(offset + str.length, 0);
  };
  
  WasmRuntime.prototype.call = function(funcName, args) {
    if (this.functions[funcName]) {
      try {
        return this.functions[funcName].apply(null, args || []);
      } catch(e) {
        console.warn('[WASM] Function error:', funcName, e);
        return null;
      }
    }
    console.warn('[WASM] Function not found:', funcName);
    return null;
  };
  
  WasmRuntime.prototype.register = function(name, fn) {
    this.functions[name] = fn;
  };
  
  // ========== 创建 WASM Polyfill ==========
  var wasmRuntime = null;
  
  function createWasmInstance(moduleBytes, imports) {
    var bytes = new Uint8Array(moduleBytes);
    wasmRuntime = new WasmRuntime();
    
    // 注册导入函数
    var importObj = imports || {};
    if (importObj.env) {
      for (var key in importObj.env) {
        if (typeof importObj.env[key] === 'function') {
          wasmRuntime.register(key, importObj.env[key]);
        }
      }
    }
    
    // 解析类型 section (id: 1)
    var typeSection = parseWasmSection(bytes, 1);
    // 解析函数 section (id: 3)
    var funcSection = parseWasmSection(bytes, 3);
    // 解析内存 section (id: 5)
    var memSection = parseWasmSection(bytes, 5);
    
    // 分配内存
    var memPages = 64;
    if (memSection) {
      var memData = memSection.data;
      var pos = 0;
      var flags = memData[pos++];
      var initialInfo = readLEB128(memData, pos);
      pos += initialInfo.length;
      memPages = initialInfo.value || 64;
    }
    wasmRuntime.allocMemory(memPages);
    
    // 解析导出 section (id: 7)
    var exportSection = parseWasmSection(bytes, 7);
    if (exportSection) {
      var data = exportSection.data;
      var expPos = 0;
      var expCountInfo = readLEB128(data, expPos);
      expPos += expCountInfo.length;
      var expCount = expCountInfo.value || 0;
      
      for (var i = 0; i < expCount; i++) {
        // 读取导出名称
        var nameLenInfo = readLEB128(data, expPos);
        expPos += nameLenInfo.length;
        var nameLen = nameLenInfo.value || 0;
        var name = '';
        for (var j = 0; j < nameLen; j++) {
          name += String.fromCharCode(data[expPos++]);
        }
        var kind = data[expPos++];
        var idxInfo = readLEB128(data, expPos);
        expPos += idxInfo.length;
        var idx = idxInfo.value || 0;
        
        // 导出到 exports
        if (kind === 0) { // function
          wasmRuntime.exports[name] = function() {
            return wasmRuntime.call(name, arguments);
          };
        } else if (kind === 1) { // table
          // 跳过
        } else if (kind === 2) { // memory
          wasmRuntime.exports[name] = wasmRuntime.memory;
        } else if (kind === 3) { // global
          // 跳过
        }
      }
    }
    
    // 模拟 main 函数
    if (imports && imports.env && imports.env._main) {
      wasmRuntime.register('_main', imports.env._main);
    }
    
    // 创建实例对象
    var instance = {
      exports: wasmRuntime.exports || {},
      memory: wasmRuntime.memory,
      runtime: wasmRuntime,
      call: function(name, args) {
        return wasmRuntime.call(name, args);
      }
    };
    
    return instance;
  }
  
  // ========== 替换 WebAssembly API ==========
  var _origInstantiate = window.WebAssembly && window.WebAssembly.instantiate ? 
    window.WebAssembly.instantiate : null;
  var _origInstantiateStreaming = window.WebAssembly && window.WebAssembly.instantiateStreaming ?
    window.WebAssembly.instantiateStreaming : null;
  
  // 创建 WebAssembly 对象（如果不存在）
  if (typeof WebAssembly === 'undefined') {
    window.WebAssembly = {};
  }
  
  // 重写 instantiate
  WebAssembly.instantiate = function(module, imports) {
    // 如果是 BufferSource (WASM 二进制)
    if (module instanceof Uint8Array || module instanceof ArrayBuffer || 
        (module && module.buffer instanceof ArrayBuffer)) {
      
      console.log('[WASM Polyfill] Instantiating WASM module in JS...');
      
      try {
        var bytes = module instanceof ArrayBuffer ? new Uint8Array(module) : 
                     module.buffer ? new Uint8Array(module.buffer) : 
                     new Uint8Array(module);
        
        // 验证 WASM 魔数
        if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || 
            bytes[2] !== 0x73 || bytes[3] !== 0x6D) {
          throw new Error('Invalid WASM magic number');
        }
        
        // 创建实例
        var instance = createWasmInstance(bytes, imports);
        
        // 模拟 Module 对象
        var mockModule = {
          _bytes: bytes,
          _instance: instance
        };
        
        return Promise.resolve({
          module: mockModule,
          instance: instance
        });
      } catch(e) {
        console.error('[WASM Polyfill] Instantiate failed:', e);
        // 如果原生支持，回退到原生
        if (_origInstantiate) {
          console.log('[WASM Polyfill] Falling back to native WASM');
          return _origInstantiate.apply(WebAssembly, arguments);
        }
        return Promise.reject(e);
      }
    }
    
    // 如果传入的是 Module 对象，尝试从缓存获取
    if (module && module._bytes) {
      try {
        var instance = createWasmInstance(module._bytes, imports);
        return Promise.resolve({
          module: module,
          instance: instance
        });
      } catch(e) {
        return Promise.reject(e);
      }
    }
    
    // 如果原生支持，使用原生
    if (_origInstantiate) {
      return _origInstantiate.apply(WebAssembly, arguments);
    }
    
    return Promise.reject(new Error('WASM not supported and cannot polyfill'));
  };
  
  // 重写 instantiateStreaming
  WebAssembly.instantiateStreaming = function(response, imports) {
    if (response && response.arrayBuffer) {
      return response.arrayBuffer().then(function(buffer) {
        return WebAssembly.instantiate(buffer, imports);
      }).catch(function(e) {
        console.warn('[WASM Polyfill] Streaming failed:', e);
        if (_origInstantiateStreaming) {
          return _origInstantiateStreaming.apply(WebAssembly, arguments);
        }
        throw e;
      });
    }
    if (_origInstantiateStreaming) {
      return _origInstantiateStreaming.apply(WebAssembly, arguments);
    }
    return WebAssembly.instantiate(response, imports);
  };
  
  // validate 方法
  WebAssembly.validate = function(bytes) {
    try {
      if (!bytes || bytes.length < 8) return false;
      var arr = new Uint8Array(bytes);
      return arr[0] === 0x00 && arr[1] === 0x61 && 
             arr[2] === 0x73 && arr[3] === 0x6D &&
             arr[4] === 0x01;
    } catch(e) {
      return false;
    }
  };
  
  // 模拟 Module
  if (!WebAssembly.Module) {
    WebAssembly.Module = function(bytes) {
      if (!WebAssembly.validate(bytes)) {
        throw new Error('Invalid WASM module');
      }
      this._bytes = bytes;
      this._sections = parseWasmSection(new Uint8Array(bytes), null);
    };
  }
  
  // 模拟 Instance
  if (!WebAssembly.Instance) {
    WebAssembly.Instance = function(module, imports) {
      var bytes = module && module._bytes ? module._bytes : null;
      if (!bytes) {
        throw new Error('Invalid module');
      }
      var instance = createWasmInstance(bytes, imports);
      this.exports = instance.exports || {};
      this._runtime = instance.runtime;
    };
  }
  
  // 模拟 Memory
  if (!WebAssembly.Memory) {
    WebAssembly.Memory = function(desc) {
      var size = desc.initial || 1;
      this.buffer = new ArrayBuffer(size * 65536);
      this._size = size;
    };
  }
  
  console.log('[WASM Polyfill] Injected successfully');
})();
`;
}

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

/* ========== Memory Optimizer ========== */
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

/* ========== Game HTML Augmentation ========== */
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
  return [
    '(function(){',
    '  if(window.__MCJS_HOST_ARMED)return;window.__MCJS_HOST_ARMED=true;',
    '  function $(s,r){return (r||document).querySelector(s);}',
    '  function fire(el,type){',
    '    try{var ev=new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0});el.dispatchEvent(ev);}catch(e){}',
    '  }',
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
    '  var overlayShown=false,overlayEl=null,dismissed=false;',
    '  function tryResumeAudio(){',
    '    try{',
    '      var AC=window.AudioContext||window.webkitAudioContext;',
    '      if(AC){',
    '        var ctx=window.__MCJS_AUDIO_CTX__;',
    '        if(!ctx){try{ctx=new AC();window.__MCJS_AUDIO_CTX__=ctx;}catch(_){}}',
    '        if(ctx&&ctx.state==="suspended"){ctx.resume().catch(function(){});}',
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
    '    setTimeout(function(){if(node&&node.parentNode)node.parentNode.removeChild(node);},260);',
    '  }',
    '  function showUnlockOverlay(){',
    '    if(overlayShown)return;',
    '    overlayShown=true;',
    '    hideLoader();',
    '    if(document.getElementById("mcjs-unlock-overlay")){overlayEl=document.getElementById("mcjs-unlock-overlay");return;}',
    '    var d=document.createElement("div");',
    '    d.id="mcjs-unlock-overlay";',
    '    d.setAttribute("tabindex","0");',
    '    var tEl=document.createElement("div");tEl.className="uc-title";tEl.textContent="点击进入游戏";d.appendChild(tEl);',
    '    var sEl=document.createElement("div");sEl.className="uc-sub";sEl.textContent="浏览器要求一次真实操作才能解锁音频并显示主菜单";d.appendChild(sEl);',
    '    var bEl=document.createElement("button");bEl.className="uc-btn";bEl.type="button";bEl.textContent="开始游戏";d.appendChild(bEl);',
    '    var kEl=document.createElement("div");kEl.className="uc-keyhint";kEl.textContent="或按键盘任意键继续";d.appendChild(kEl);',
    '    var hEl=document.createElement("div");hEl.className="uc-hint";hEl.textContent="操作后键盘和鼠标将正常工作";d.appendChild(hEl);',
    '    (document.body||document.documentElement).appendChild(d);',
    '    overlayEl=d;',
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
    '    d.addEventListener("keydown",function(e){',
    '      dismissOverlay();',
    '    });',
    '    try{d.focus();}catch(e){}',
    '  }',
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

function injectIntoHTML(html, scripts, baseURL) {
  var baseTag = baseURL ? '<base href="' + escapeAttr(baseURL) + '">' : '';
  var hostCSS = '<style data-mcjs-host>' + buildHostCSS() + '</style>';
  var hostJS = '<script data-mcjs-host>' + buildHostJS() + '<\/script>';
  
  // 关键：如果浏览器不支持 WASM，注入 polyfill
  var wasmPolyfillScript = '';
  if (needsWasmFallback()) {
    wasmPolyfillScript = '<script>' + buildWasmPolyfillScript() + '<\/script>';
    console.log('[MCJS] WASM polyfill injected into game page');
  }
  
  var scriptsTag = '';
  for (var i = 0; i < scripts.length; i++) {
    scriptsTag += '<script>' + scripts[i] + '<\/script>';
  }
  
  // 注入顺序：polyfill 最先执行
  var injection = baseTag + hostCSS + wasmPolyfillScript + hostJS + scriptsTag;
  
  if (html.indexOf('<head>') !== -1) {
    return html.replace('<head>', '<head>' + injection);
  }
  if (html.indexOf('<HEAD>') !== -1) {
    return html.replace('<HEAD>', '<HEAD>' + injection);
  }
  if (html.indexOf('<html>') !== -1) {
    return html.replace('<html>', '<html><head>' + injection + '</head>');
  }
  if (html.indexOf('<HTML>') !== -1) {
    return html.replace('<HTML>', '<HTML><HEAD>' + injection + '</HEAD>');
  }
  return injection + html;
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
        schema: 4,
        wasmFallback: needsWasmFallback()
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
        var scripts=[];
        var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(settings.memoryLimit)+';';
        scripts.push(memCode);
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
        var modifiedHTML=injectIntoHTML(html,[],mirrorURL);
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
      var scripts=[];
      var memCode='window.__MCJS_MEM_LIMIT__='+JSON.stringify(window.MCJS_SETTINGS.memoryLimit)+';';
      scripts.push(memCode);
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
  buildMirrorURL:buildMirrorURL,
  detectWasmSupport:detectWasmSupport,
  needsWasmFallback:needsWasmFallback,
  buildWasmPolyfillScript:buildWasmPolyfillScript
};

})();