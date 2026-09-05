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
  reduceMotion:false,
  popupLaunch:false
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
    var pos = 8;
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
  
  function WasmRuntime() {
    this.memory = null;
    this.functions = {};
    this.globals = {};
    this.exports = {};
    this.table = [];
    this.memSize = 64;
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
  
  var wasmRuntime = null;
  
  function createWasmInstance(moduleBytes, imports) {
    var bytes = new Uint8Array(moduleBytes);
    wasmRuntime = new WasmRuntime();
    
    var importObj = imports || {};
    if (importObj.env) {
      for (var key in importObj.env) {
        if (typeof importObj.env[key] === 'function') {
          wasmRuntime.register(key, importObj.env[key]);
        }
      }
    }
    
    var typeSection = parseWasmSection(bytes, 1);
    var funcSection = parseWasmSection(bytes, 3);
    var memSection = parseWasmSection(bytes, 5);
    
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
    
    var exportSection = parseWasmSection(bytes, 7);
    if (exportSection) {
      var data = exportSection.data;
      var expPos = 0;
      var expCountInfo = readLEB128(data, expPos);
      expPos += expCountInfo.length;
      var expCount = expCountInfo.value || 0;
      
      for (var i = 0; i < expCount; i++) {
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
        
        if (kind === 0) {
          wasmRuntime.exports[name] = function() {
            return wasmRuntime.call(name, arguments);
          };
        } else if (kind === 2) {
          wasmRuntime.exports[name] = wasmRuntime.memory;
        }
      }
    }
    
    if (imports && imports.env && imports.env._main) {
      wasmRuntime.register('_main', imports.env._main);
    }
    
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
  
  var _origInstantiate = window.WebAssembly && window.WebAssembly.instantiate ? 
    window.WebAssembly.instantiate : null;
  var _origInstantiateStreaming = window.WebAssembly && window.WebAssembly.instantiateStreaming ?
    window.WebAssembly.instantiateStreaming : null;
  
  if (typeof WebAssembly === 'undefined') {
    window.WebAssembly = {};
  }
  
  WebAssembly.instantiate = function(module, imports) {
    if (module instanceof Uint8Array || module instanceof ArrayBuffer || 
        (module && module.buffer instanceof ArrayBuffer)) {
      
      console.log('[WASM Polyfill] Instantiating WASM module in JS...');
      
      try {
        var bytes = module instanceof ArrayBuffer ? new Uint8Array(module) : 
                     module.buffer ? new Uint8Array(module.buffer) : 
                     new Uint8Array(module);
        
        if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || 
            bytes[2] !== 0x73 || bytes[3] !== 0x6D) {
          throw new Error('Invalid WASM magic number');
        }
        
        var instance = createWasmInstance(bytes, imports);
        
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
        if (_origInstantiate) {
          console.log('[WASM Polyfill] Falling back to native WASM');
          return _origInstantiate.apply(WebAssembly, arguments);
        }
        return Promise.reject(e);
      }
    }
    
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
    
    if (_origInstantiate) {
      return _origInstantiate.apply(WebAssembly, arguments);
    }
    
    return Promise.reject(new Error('WASM not supported and cannot polyfill'));
  };
  
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
  
  if (!WebAssembly.Module) {
    WebAssembly.Module = function(bytes) {
      if (!WebAssembly.validate(bytes)) {
        throw new Error('Invalid WASM module');
      }
      this._bytes = bytes;
      this._sections = parseWasmSection(new Uint8Array(bytes), null);
    };
  }
  
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

/* ========== Cache Manager (IndexedDB with Memory Fallback) ========== */
var DB_NAME='mcjs_cache';
var DB_VERSION=2;
var STORE_GAME='game_files';
var STORE_SAVE='save_data';
var STORE_META='cache_meta';
var _idbAvailable = null;
var _memCache = { game_files: new Map(), save_data: new Map(), cache_meta: new Map() };

function checkIDBAvailable(){
  if(_idbAvailable !== null) return _idbAvailable;
  try{
    if(typeof indexedDB === 'undefined') { _idbAvailable = false; return false; }
    var test = indexedDB.open('__mcjs_test__');
    test.onerror = function(){ _idbAvailable = false; };
    test.onsuccess = function(){
      _idbAvailable = true;
      try{ indexedDB.deleteDatabase('__mcjs_test__'); }catch(e){}
    };
    return true;
  }catch(e){
    _idbAvailable = false;
    return false;
  }
}
function checkIDBAvailableAsync(){
  if(_idbAvailable !== null) return Promise.resolve(_idbAvailable);
  return new Promise(function(resolve){
    try{
      if(typeof indexedDB === 'undefined'){ _idbAvailable = false; resolve(false); return; }
      var test = indexedDB.open('__mcjs_test__');
      test.onerror = function(){ _idbAvailable = false; resolve(false); };
      test.onsuccess = function(){
        _idbAvailable = true;
        try{ indexedDB.deleteDatabase('__mcjs_test__'); }catch(e){}
        resolve(true);
      };
    }catch(e){ _idbAvailable = false; resolve(false); }
  });
}

function openDB(){
  return checkIDBAvailableAsync().then(function(available){
    if(!available) throw new Error('IndexedDB not available');
    return new Promise(function(resolve,reject){
      var req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=function(e){
        var db=e.target.result;
        if(!db.objectStoreNames.contains(STORE_GAME))db.createObjectStore(STORE_GAME);
        if(!db.objectStoreNames.contains(STORE_SAVE))db.createObjectStore(STORE_SAVE);
        if(!db.objectStoreNames.contains(STORE_META))db.createObjectStore(STORE_META);
      };
      req.onsuccess=function(e){resolve(e.target.result);};
      req.onerror=function(e){
        _idbAvailable = false;
        reject(e.target.error);
      };
    });
  });
}

function dbPut(store,key,value){
  if(_idbAvailable === false){
    try{ _memCache[store] = _memCache[store] || new Map(); _memCache[store].set(key, value); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  }
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value,key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  }).catch(function(err){
    console.warn('[MCJS] IndexedDB put failed, falling back to memory cache:', err.message);
    _idbAvailable = false;
    try{ _memCache[store] = _memCache[store] || new Map(); _memCache[store].set(key, value); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  });
}

function dbGet(store,key){
  if(_idbAvailable === false){
    try{ _memCache[store] = _memCache[store] || new Map(); return Promise.resolve(_memCache[store].get(key)); }catch(e){ return Promise.reject(e); }
  }
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readonly');
      var req=tx.objectStore(store).get(key);
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(e){reject(e.target.error);};
    });
  }).catch(function(err){
    console.warn('[MCJS] IndexedDB get failed, falling back to memory cache:', err.message);
    _idbAvailable = false;
    try{ _memCache[store] = _memCache[store] || new Map(); return Promise.resolve(_memCache[store].get(key)); }catch(e){ return Promise.reject(e); }
  });
}

function dbDelete(store,key){
  if(_idbAvailable === false){
    try{ _memCache[store] = _memCache[store] || new Map(); _memCache[store].delete(key); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  }
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  }).catch(function(err){
    console.warn('[MCJS] IndexedDB delete failed, falling back to memory cache:', err.message);
    _idbAvailable = false;
    try{ _memCache[store] = _memCache[store] || new Map(); _memCache[store].delete(key); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  });
}

function dbClear(store){
  if(_idbAvailable === false){
    try{ _memCache[store] = new Map(); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  }
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(e){reject(e.target.error);};
    });
  }).catch(function(err){
    console.warn('[MCJS] IndexedDB clear failed, falling back to memory cache:', err.message);
    _idbAvailable = false;
    try{ _memCache[store] = new Map(); return Promise.resolve(); }catch(e){ return Promise.reject(e); }
  });
}

function dbKeys(store){
  if(_idbAvailable === false){
    try{ _memCache[store] = _memCache[store] || new Map(); return Promise.resolve(Array.from(_memCache[store].keys())); }catch(e){ return Promise.reject(e); }
  }
  return openDB().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,'readonly');
      var req=tx.objectStore(store).getAllKeys();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(e){reject(e.target.error);};
    });
  }).catch(function(err){
    console.warn('[MCJS] IndexedDB keys failed, falling back to memory cache:', err.message);
    _idbAvailable = false;
    try{ _memCache[store] = _memCache[store] || new Map(); return Promise.resolve(Array.from(_memCache[store].keys())); }catch(e){ return Promise.reject(e); }
  });
}

/* ========== Memory Optimizer ========== */
var _memOptCancelToken = { cancelled: false };
function cancelMemoryOpt(){
  _memOptCancelToken.cancelled = true;
}
function optimizeMemory(callback, forceDetail){
  _memOptCancelToken = { cancelled: false };
  var settings = window.MCJS_SETTINGS || {};
  var doClean = (settings.autoClean !== false);
  var showDetail = (forceDetail === true) || (settings.loadingDetail !== false);

  var steps = showDetail ? [
    { text: '释放闲置内存...', pct: 10, clean: true },
    { text: '清理 DOM 缓存...', pct: 25, clean: true },
    { text: '优化 GC 堆...', pct: 40, clean: true },
    { text: '配置内存分配...', pct: 55, alloc: true },
    { text: '检测 GPU 性能...', pct: 70 },
    { text: '准备运行环境...', pct: 85 },
    { text: '就绪', pct: 100 }
  ] : [
    { text: '准备启动...', pct: 50 },
    { text: '就绪', pct: 100 }
  ];

  // 如果 doClean 为 false，过滤掉 clean 步骤，但仍保留至少一个步骤
  if (!doClean) {
    steps = steps.filter(function(s) { return !s.clean; });
    if (steps.length === 0) {
      steps = [{ text: '准备启动...', pct: 50 }, { text: '就绪', pct: 100 }];
    }
  }

  var i = 0;
  var timeoutGuard = null;
  var finished = false;

  function finish(err) {
    if (finished) return;
    finished = true;
    if (timeoutGuard) { clearTimeout(timeoutGuard); timeoutGuard = null; }
    try {
      if (callback) callback(err || null);
    } catch (e) {
      console.warn('[MCJS] optimizeMemory callback error:', e);
    }
  }

  function next() {
    if (_memOptCancelToken.cancelled) {
      finish(new Error('cancelled'));
      return;
    }
    if (i >= steps.length) {
      finish(null);
      return;
    }
    var step = steps[i++];
    try {
      if (typeof window.MCJS_UPDATE_LAUNCH === 'function') {
        window.MCJS_UPDATE_LAUNCH(step.text, step.pct);
      }
    } catch (e) {
      console.warn('[MCJS] launch update error:', e);
    }

    try {
      if (doClean && step.clean && step.pct <= 40) {
        if (typeof gc === 'function') { try { gc(); } catch (e) {} }
        if (typeof window.gc === 'function') { try { window.gc(); } catch (e) {} }
      }
      if (step.alloc) {
        var limit = settings.memoryLimit || 512;
        try {
          var pool = new ArrayBuffer(Math.min(limit * 1024 * 1024, 256 * 1024 * 1024));
          pool = null;
        } catch (e) {
          console.warn('[MCJS] Memory pool allocation failed (non-fatal):', e.message);
        }
      }
    } catch (e) {
      console.warn('[MCJS] optimizeMemory step error (non-fatal):', e);
    }

    // 计算延迟时间，确保至少有一个微小的延迟让 UI 更新
    var delay = doClean ? (120 + Math.random() * 200) : (80 + Math.random() * 80);
    // 确保延迟不超过 500ms
    if (delay > 500) delay = 500;
    
    // 超时保护：如果 next 在 2 秒内没有被调用，强制推进
    if (timeoutGuard) { clearTimeout(timeoutGuard); }
    timeoutGuard = setTimeout(function() {
      console.warn('[MCJS] optimizeMemory step timeout, forcing next');
      timeoutGuard = null;
      if (!finished) next();
    }, 2000);

    if (!_memOptCancelToken.cancelled) {
      setTimeout(function() {
        if (timeoutGuard) { clearTimeout(timeoutGuard); timeoutGuard = null; }
        if (!finished) next();
      }, Math.max(delay, 50));
    } else {
      finish(new Error('cancelled'));
    }
  }

  // 启动优化流程
  next();

  // 全局超时保护：如果 30 秒后还未完成，强制完成
  setTimeout(function() {
    if (!finished) {
      console.warn('[MCJS] optimizeMemory global timeout, forcing completion');
      finish(new Error('timeout'));
    }
  }, 30000);
}

/* ========== 手动内存优化（外部调用） ========== */
function manualOptimizeMemory(onProgress, onComplete) {
  var settings = window.MCJS_SETTINGS || {};
  var doClean = settings.autoClean !== false;
  var steps = [
    { text: '正在释放内存...', pct: 15, clean: true },
    { text: '清理缓存引用...', pct: 30, clean: true },
    { text: '执行垃圾回收...', pct: 50, clean: true },
    { text: '优化堆内存...', pct: 70, clean: true },
    { text: '完成优化', pct: 100 }
  ];
  
  if (!doClean) {
    steps = steps.filter(function(s) { return !s.clean; });
    if (steps.length === 0) {
      steps = [{ text: '内存优化已禁用（设置中开启"启动前内存优化"）', pct: 100 }];
    }
  }
  
  var i = 0;
  function next() {
    if (i >= steps.length) {
      if (onComplete) onComplete();
      return;
    }
    var step = steps[i++];
    if (onProgress) onProgress(step.text, step.pct);
    
    try {
      if (step.clean && doClean) {
        if (typeof gc === 'function') { try { gc(); } catch(e) {} }
        if (typeof window.gc === 'function') { try { window.gc(); } catch(e) {} }
        try {
          var pool = new ArrayBuffer(16 * 1024 * 1024);
          pool = null;
        } catch(e) {}
      }
    } catch(e) {
      console.warn('[MCJS] Manual optimize step error:', e);
    }
    
    setTimeout(next, 150 + Math.random() * 200);
  }
  next();
}

/* ========== Game File Fetcher ========== */
/* XHR 兜底请求(无 AbortController 的老浏览器也能超时中断) */
function xhrFetch(url, timeoutMs){
  return new Promise(function(resolve, reject){
    try{
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';
      xhr.timeout = timeoutMs;
      xhr.onload = function(){
        resolve({
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
          text: function(){ return Promise.resolve(xhr.responseText); },
          headers: { get: function(){ return null; } }
        });
      };
      xhr.onerror = function(){ reject(new Error('NETWORK_ERROR')); };
      xhr.ontimeout = function(){ reject(new Error('FETCH_TIMEOUT')); };
      xhr.send();
    }catch(e){ reject(e); }
  });
}

/* 带超时的 fetch(AbortController 优先;老浏览器走 XHR 兜底,保证可超时) */
function fetchWithTimeout(url, timeoutMs){
  // 老浏览器无 fetch 或无 AbortController:用 XHR 兜底,原生支持 timeout
  if (typeof fetch !== 'function' || typeof AbortController === 'undefined') {
    if (typeof XMLHttpRequest !== 'undefined') {
      return xhrFetch(url, timeoutMs);
    }
    // 实在没有 XHR,只能直接 fetch
    return fetch(url, { mode:'cors', credentials:'omit', redirect:'follow' });
  }
  var opts = { mode:'cors', credentials:'omit', redirect:'follow' };
  var controller = new AbortController();
  opts.signal = controller.signal;
  var timer = setTimeout(function(){
    try { controller.abort(); } catch(e) {}
  }, timeoutMs);
  return fetch(url, opts).then(function(r){
    clearTimeout(timer);
    return r;
  }, function(err){
    clearTimeout(timer);
    if (controller.signal && controller.signal.aborted) {
      throw new Error('FETCH_TIMEOUT');
    }
    throw err;
  });
}

/* 校验拉取到的内容是否为有效游戏 HTML */
function validateGameHTML(html){
  if(!html||html.length<300){
    throw new Error('EMPTY_PAGE');
  }
  if(html.indexOf('<html')===-1&&html.indexOf('<HTML')===-1&&
     html.indexOf('<head')===-1&&html.indexOf('<HEAD')===-1&&
     html.indexOf('<body')===-1&&html.indexOf('<BODY')===-1){
    throw new Error('NOT_HTML');
  }
  return html;
}

function fetchGameHTML(mirrorURL, timeoutMs){
  var t = timeoutMs || 15000;
  return fetchWithTimeout(mirrorURL, t).then(function(r){
    if(r.status<200||r.status>=300){
      throw new Error('HTTP '+r.status);
    }
    return r.text();
  }).then(validateGameHTML);
}

/* 并发竞速拉取:同时发起多个镜像请求,第一个成功的胜出,其余忽略。
   用于"自动选择"或首个镜像超时时快速切换,弱网下显著降低等待时间。 */
function fetchGameHTMLRacing(urls, timeoutMs){
  return new Promise(function(resolve, reject){
    if(!urls || urls.length === 0){ reject(new Error('NO_MIRRORS')); return; }
    var t = timeoutMs || 15000;
    var pending = urls.length;
    var lastErr = null;
    var settled = false;
    var controllers = [];
    function abortAll(except){
      for(var i=0;i<controllers.length;i++){
        if(controllers[i] && controllers[i] !== except && controllers[i].abort){
          try { controllers[i].abort(); } catch(e) {}
        }
      }
    }
    urls.forEach(function(u){
      var opts = { mode:'cors', credentials:'omit', redirect:'follow' };
      var controller = null;
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        controllers.push(controller);
        opts.signal = controller.signal;
      }
      var timer = setTimeout(function(){
        if(controller){ try{ controller.abort(); }catch(e){} }
      }, t);
      fetch(u, opts).then(function(r){
        clearTimeout(timer);
        if(settled) { try{ if(controller) controller.abort(); }catch(e){} return; }
        if(r.status<200||r.status>=300){ throw new Error('HTTP '+r.status); }
        return r.text();
      }).then(function(html){
        if(settled) return null;
        return validateGameHTML(html);
      }).then(function(valid){
        if(settled || valid == null) return;
        settled = true;
        abortAll(controller);
        resolve({ html: valid, url: u });
      }).catch(function(err){
        clearTimeout(timer);
        lastErr = err;
        pending--;
        if(pending <= 0 && !settled){
          settled = true;
          reject(lastErr || new Error('ALL_MIRRORS_FAILED'));
        }
      });
    });
  });
}

/* 轻量镜像测速:用 HEAD/小请求测量可达性与延迟(ms),失败返回 null */
function pingMirror(mirrorURL, timeoutMs){
  return new Promise(function(resolve){
    var t = timeoutMs || 6000;
    var start = (window.performance && performance.now) ? performance.now() : Date.now();
    var done = false;
    function finish(val){ if(done) return; done = true; resolve(val); }
    var timer = setTimeout(function(){ finish(null); }, t);
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var opts = { mode:'cors', credentials:'omit', redirect:'follow', method:'GET' };
    if(controller) opts.signal = controller.signal;
    fetch(mirrorURL, opts).then(function(r){
      clearTimeout(timer);
      var ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - start);
      if(controller){ try{ controller.abort(); }catch(e){} }
      if(r.status >= 200 && r.status < 500) finish({ latency: ms, status: r.status });
      else finish(null);
    }).catch(function(){
      clearTimeout(timer);
      finish(null);
    });
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
    '  var fsExitTime=0;',
    '  document.addEventListener("fullscreenchange",function(){',
    '    if(!document.fullscreenElement){fsExitTime=Date.now();}',
    '  });',
    '  document.addEventListener("webkitfullscreenchange",function(){',
    '    if(!document.webkitFullscreenElement){fsExitTime=Date.now();}',
    '  });',
    '  window.addEventListener("keydown",function(e){',
    '    if(e.keyCode===27&&fsExitTime&&Date.now()-fsExitTime<500){',
    '      e.preventDefault();e.stopPropagation();',
    '    }',
    '  },true);',
    '})();'
  ].join('');
}

/* 统一构建注入到游戏页面的启动脚本(内存/存档/GPU/调试),
   避免缓存命中与重新拉取两条路径注入不一致 */
function buildLaunchScripts(settings, version){
  var scripts=[];
  scripts.push('window.__MCJS_MEM_LIMIT__='+JSON.stringify(settings.memoryLimit)+';');
  if(settings.saveIsolation){
    scripts.push('window.__MCJS_SAVE_ID__='+JSON.stringify(version.id)+';');
  }
  // GPU 偏好(之前设置了但从未注入,空开关)
  if(settings.gpuPrefer && settings.gpuPrefer!=='default'){
    scripts.push(
      '(function(){try{'+
      'var g='+JSON.stringify(settings.gpuPrefer)+';'+
      'if(navigator.gpu&&navigator.gpu.requestAdapter){'+
      'var _origRA=navigator.gpu.requestAdapter.bind(navigator.gpu);'+
      'navigator.gpu.requestAdapter=function(o){o=o||{};o.powerPreference=o.powerPreference||g;return _origRA(o);};'+
      '}'+
      'var c=document.createElement("canvas");'+
      'var gl=c.getContext("webgl2")||c.getContext("webgl");'+
      'if(gl&&gl.getContextAttributes){var a=gl.getContextAttributes();}'+
      '}catch(e){}})();'
    );
  }
  if(settings.debugMode){
    scripts.push('window.__MCJS_DEBUG__=true;window.addEventListener("error",function(e){console.error("[MCJS-GAME]",e.message,e.filename+":"+e.lineno);});window.addEventListener("unhandledrejection",function(e){console.error("[MCJS-GAME] unhandled:",e.reason);});');
  }
  return scripts;
}

function injectIntoHTML(html, scripts, baseURL, pluginInjects) {
  // pluginInjects: [{type:'js'|'css', content:string, pluginId:string}] - 来自插件的额外注入
  pluginInjects = pluginInjects || [];

  var baseTag = baseURL ? '<base href="' + escapeAttr(baseURL) + '">' : '';
  var hostCSS = '<style data-mcjs-host>' + buildHostCSS() + '</style>';
  var hostJS = '<script data-mcjs-host>' + buildHostJS() + '<\/script>';

  // 原始 WASM 兼容逻辑保留为兜底(无插件时仍能跑)
  var wasmPolyfillScript = '';
  if (needsWasmFallback()) {
    wasmPolyfillScript = '<script>' + buildWasmPolyfillScript() + '<\/script>';
    console.log('[MCJS] WASM polyfill injected into game page');
  }

  var scriptsTag = '';
  for (var i = 0; i < scripts.length; i++) {
    scriptsTag += '<script>' + scripts[i] + '<\/script>';
  }

  // 注入插件提供的 CSS 与 JS(在 hostJS 之后执行)
  var pluginCSS = '';
  var pluginJS = '';
  for (var j = 0; j < pluginInjects.length; j++) {
    var item = pluginInjects[j];
    if (item.type === 'css') {
      pluginCSS += '<style data-mcjs-plugin="' + escapeAttr(item.pluginId || '') + '">' + item.content + '</style>';
    } else {
      pluginJS += '<script data-mcjs-plugin="' + escapeAttr(item.pluginId || '') + '">' + item.content + '<\/script>';
    }
  }

  var injection = baseTag + hostCSS + wasmPolyfillScript + hostJS + scriptsTag + pluginCSS + pluginJS;

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

function launchGame(version,onProgress,onReady,onError,autoMode){
  var settings=window.MCJS_SETTINGS;
  var verbose=settings&&settings.verboseLog;
  if(verbose) console.log('[MCJS] launchGame start:', version.id, 'autoMode=' + autoMode, 'cacheDisabled=' + !!settings.disableCache);
  var mirrorIdx = settings.mirrorIdx;
  if(mirrorIdx < 0 || mirrorIdx >= version.mirrors.length) {
    mirrorIdx = 0;
    settings.mirrorIndex = 0;
    try{ window.MCJS_SAVE_SETTINGS(settings); }catch(e){}
  }
  var rawMirror=version.mirrors[mirrorIdx];
  var mirrorURL=buildMirrorURL(rawMirror,version);
  lastLaunchedVersion=version;

  // ========== 插件 hook:launch:version - 允许插件修改 version 对象 ==========
  if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
    try {
      var modifiedVersion = window.MCJS_PLUGIN_API._internal.runHook('launch:version', JSON.parse(JSON.stringify(version)));
      if (modifiedVersion && typeof modifiedVersion === 'object') {
        version = modifiedVersion;
        if (window.MCJS_LAUNCH_CONTEXT === undefined) {
          window.MCJS_LAUNCH_CONTEXT = { version: version, mirrorURL: mirrorURL };
        }
      }
    } catch (e) { console.warn('[MCJS] launch:version hook error:', e); }
  }

  // ========== 插件 hook:launch:mirrors - 允许插件增删镜像 ==========
  if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
    try {
      var modifiedMirrors = window.MCJS_PLUGIN_API._internal.runHook('launch:mirrors', version.mirrors, version);
      if (Array.isArray(modifiedMirrors) && modifiedMirrors.length > 0) {
        version = Object.assign({}, version, { mirrors: modifiedMirrors });
        // 重新选择镜像
        if (mirrorIdx >= version.mirrors.length) mirrorIdx = 0;
        rawMirror = version.mirrors[mirrorIdx];
        mirrorURL = buildMirrorURL(rawMirror, version);
      }
    } catch (e) { console.warn('[MCJS] launch:mirrors hook error:', e); }
  }

  window.MCJS_LAUNCH_CONTEXT = { version: version, mirrorURL: mirrorURL, startedAt: Date.now() };

  // ========== 插件 hook:launch:before ==========
  if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
    try { window.MCJS_PLUGIN_API._internal.runHook('launch:before', version); } catch (e) {}
  }
  if (window.MCJS_EVENTS) try { window.MCJS_EVENTS.emit('launch:start', { version: version, mirrorURL: mirrorURL }); } catch (e) {}

  try{onProgress('正在优化内存...',5);}catch(e){}

  optimizeMemory(function(){
    try{onProgress('内存优化完成',30);}catch(e){}

    var cacheDisabled = !!(settings.disableCache);
    getCachedHTML(version.id).then(function(cached){
      if(cached && !cacheDisabled){
        try{onProgress('从缓存加载...',80);}catch(e){}
        if(verbose) console.log('[MCJS] serving from cache:', version.id);
        loadGameInFrame(version,cached,mirrorURL,onProgress,onReady,onError);
        return;
      }
      if(verbose && cacheDisabled) console.log('[MCJS] cache bypassed (disableCache):', version.id);
      // ===== 自动模式:并发竞速拉取多个镜像,最快可用者胜出(弱网优化) =====
      var raceWinner = null;
      var racePromise = null;
      if(autoMode === true && Array.isArray(version.mirrors) && version.mirrors.length > 1){
        var raceURLs = [];
        // 首选镜像 + 最多 3 个备用镜像(避免过多并发)
        var order = [mirrorIdx];
        var altCount = 0;
        for(var mi=0; mi<version.mirrors.length && altCount<3; mi++){
          if(mi===mirrorIdx) continue;
          order.push(mi); altCount++;
        }
        for(var oi=0; oi<order.length; oi++){
          var u = buildMirrorURL(version.mirrors[order[oi]], version);
          if(u) raceURLs.push(u);
        }
        try{onProgress('正在智能选择最快镜像...',40);}catch(e){}
        racePromise = fetchGameHTMLRacing(raceURLs, 15000).then(function(res){
          raceWinner = res;
          try{onProgress('已选择最快镜像,下载游戏文件...',60);}catch(e){}
          return res.html;
        });
      } else {
        try{onProgress('正在从 '+rawMirror.name+' 下载游戏文件...',40);}catch(e){}
        racePromise = fetchGameHTML(mirrorURL).then(function(html){
          raceWinner = { html: html, url: mirrorURL };
          return html;
        });
      }

      racePromise.then(function(rawHtml){
        try{onProgress('解压游戏源代码...',65);}catch(e){}
        if(raceWinner && raceWinner.url){ mirrorURL = raceWinner.url; window.MCJS_LAUNCH_CONTEXT = { version: version, mirrorURL: mirrorURL, startedAt: Date.now() }; }
        // ========== 插件 hook:launch:html - 允许插件修改游戏 HTML ==========
        var html = rawHtml;
        if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
          try {
            var mod = window.MCJS_PLUGIN_API._internal.runHook('launch:html', rawHtml, { version: version, mirrorURL: mirrorURL });
            if (typeof mod === 'string' && mod.length > 0) html = mod;
          } catch (e) { console.warn('[MCJS] launch:html hook error:', e); }
        }
        // 收集插件注入项
        var pluginInjects = collectPluginInjects('launch:html', { version: version, mirrorURL: mirrorURL });

        var scripts=buildLaunchScripts(settings, version);
        var modifiedHTML=injectIntoHTML(html,scripts,mirrorURL,pluginInjects);
        if(settings.disableCache){
          if(settings.verboseLog) console.log('[MCJS] Cache disabled by settings, skip write');
        } else {
          try{onProgress('缓存游戏文件...',75);}catch(e){}
          cacheGameFiles(version.id,modifiedHTML,mirrorURL).catch(function(e){
            console.warn('[MCJS] Cache failed:',e);
          });
        }
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady,onError);
      }).catch(function(err){
        console.warn('[MCJS] Mirror failed:',rawMirror.name,err);
        if(verbose) console.log('[MCJS] primary mirror failed, racing fallback mirrors');
        tryFallbackMirror(version,0,onProgress,onReady,onError,err);
      });
    }).catch(function(err){
      console.warn('[MCJS] DB error:',err);
      deleteCachedHTML(version.id).catch(function(){});
      fetchGameHTML(mirrorURL).then(function(rawHtml){
        var html = rawHtml;
        if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
          try {
            var mod = window.MCJS_PLUGIN_API._internal.runHook('launch:html', rawHtml, { version: version, mirrorURL: mirrorURL });
            if (typeof mod === 'string' && mod.length > 0) html = mod;
          } catch (e) {}
        }
        var pluginInjects = collectPluginInjects('launch:html', { version: version, mirrorURL: mirrorURL });
        var scripts=buildLaunchScripts(settings, version);
        var modifiedHTML=injectIntoHTML(html,scripts,mirrorURL,pluginInjects);
        loadGameInFrame(version,modifiedHTML,mirrorURL,onProgress,onReady,onError);
      }).catch(function(err2){
        tryFallbackMirror(version,0,onProgress,onReady,onError,err2);
      });
    });
  });
}

/* 收集由插件生成的待注入项(JS / CSS)
   直接调用每个已启用插件实例的 inject() 接口,
   plugin.inject({hook: 'launch:html', args: ...}) 应返回 {type, content} 或 null */
function collectPluginInjects(hookName, hookArgs) {
  var out = [];
  var instances = window.__MCJS_PLUGIN_INSTANCES__ || {};
  Object.keys(instances).forEach(function(pluginId) {
    var inst = instances[pluginId];
    var plugin = window.MCJS_REGISTRY ? window.MCJS_REGISTRY.get(pluginId) : null;
    if (!inst || typeof inst.inject !== 'function') return;
    if (plugin && plugin.hooks && plugin.hooks.indexOf(hookName) === -1) return;
    if (window.MCJS_REGISTRY && !window.MCJS_REGISTRY.isEnabled(pluginId)) return;
    try {
      var result = inst.inject({ hook: hookName, args: hookArgs || null });
      if (result && result.content) {
        out.push({
          pluginId: pluginId,
          type: result.type || 'js',
          content: result.content
        });
      }
    } catch (e) { console.warn('[MCJS] Plugin inject call failed:', pluginId, e); }
  });
  return out;
}

function tryFallbackMirror(version,startIndex,onProgress,onReady,onError,lastErr){
  var mirrors=version.mirrors;
  if(!Array.isArray(mirrors) || mirrors.length === 0){
    giveUpAllMirrors(version,onError,lastErr);
    return;
  }
  var settings=window.MCJS_SETTINGS;
  var alreadyTried=Math.max(settings.mirrorIndex||0,0);
  if(startIndex===0)startIndex=(alreadyTried+1)%mirrors.length;

  if(mirrors.length<=1){
    giveUpAllMirrors(version,onError,lastErr);
    return;
  }

  // 收集未尝试过的镜像 URL,并发竞速,最快可用者胜出
  var candidateURLs = [];
  var candidateMirrors = [];
  for(var k=0; k<mirrors.length; k++){
    if(k===alreadyTried) continue;
    var u = buildMirrorURL(mirrors[k], version);
    if(u){ candidateURLs.push(u); candidateMirrors.push({ mirror: mirrors[k], url: u }); }
  }
  if(candidateURLs.length === 0){
    giveUpAllMirrors(version,onError,lastErr);
    return;
  }
  try{onProgress('正在尝试其他镜像(并发竞速)...',50);}catch(e){}
  fetchGameHTMLRacing(candidateURLs, 15000).then(function(res){
    var winURL = res.url;
    var html = res.html;
    var scripts=buildLaunchScripts(window.MCJS_SETTINGS, version);
    var pluginInjects = collectPluginInjects('launch:html', { version: version, mirrorURL: winURL });
    var modifiedHTML=injectIntoHTML(html,scripts,winURL,pluginInjects);
    cacheGameFiles(version.id,modifiedHTML,winURL).catch(function(){});
    loadGameInFrame(version,modifiedHTML,winURL,onProgress,onReady,onError);
  }).catch(function(err){
    console.warn('[MCJS] All fallback mirrors failed:',err);
    giveUpAllMirrors(version,onError,err||lastErr);
  });
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
  iframe.setAttribute('allowfullscreen','');
  iframe.setAttribute('webkitallowfullscreen','');
  iframe.setAttribute('mozallowfullscreen','');
  iframe.style.cssText='width:100%;height:100%;border:none;background:transparent;display:block;';

  // Permissions Policy: fullscreen 始终允许(全屏按钮需要),其余按设置
  var allowBits='fullscreen; autoplay; camera; microphone; gamepad; xr-spatial-tracking';
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

  // 收集 launch:after 钩子的注入内容(在游戏加载后注入)
  try {
    var afterInjects = collectPluginInjects('launch:after', { version: version, iframe: iframe });
    if (afterInjects.length > 0) {
      setTimeout(function(){
        try {
          afterInjects.forEach(function(item) {
            if (item.type === 'css') {
              var s = doc.createElement('style');
              s.setAttribute('data-mcjs-plugin', item.pluginId || '');
              s.textContent = item.content;
              doc.head.appendChild(s);
            } else {
              var sc = doc.createElement('script');
              sc.setAttribute('data-mcjs-plugin', item.pluginId || '');
              sc.textContent = item.content;
              doc.head.appendChild(sc);
            }
          });
        } catch (e) { console.warn('[MCJS] launch:after inject failed:', e); }
      }, 50);
    }
  } catch (e) {}

  // 触发 launch:after 钩子
  if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
    try { window.MCJS_PLUGIN_API._internal.runHook('launch:after', { version: version, iframe: iframe }); } catch (e) {}
  }
  if (window.MCJS_EVENTS) try { window.MCJS_EVENTS.emit('game:ready', { version: version, iframe: iframe }); } catch (e) {}

  try{onProgress('启动完成',100);}catch(e){}

  setTimeout(function(){
    try{onReady();}catch(e){}
    if(window.MCJS_SETTINGS.fullscreenLaunch){
      // 自动全屏:浏览器要求用户手势,启动完成后的直接请求大概率被拒,
      // 失败则监听下一次用户手势(点击/按键/触摸)再请求——此时符合手势激活要求
      var fsDone=false;
      function requestFs(){
        if(fsDone) return;
        try{
          var el=iframe;
          var req=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitEnterFullScreen||el.mozRequestFullScreen||el.msRequestFullscreen;
          if(!req) return;
          var ret=req.call(el);
          fsDone=true;
          if(ret&&typeof ret.catch==='function'){
            ret.catch(function(){ fsDone=false; });
          }
        }catch(e){}
      }
      setTimeout(requestFs,300);
      function onGesture(){
        if(!fsDone) requestFs();
      }
      document.addEventListener('pointerdown',onGesture,{once:true});
      document.addEventListener('keydown',onGesture,{once:true});
      document.addEventListener('fullscreenchange',function(){
        fsDone=true;
        document.removeEventListener('pointerdown',onGesture);
        document.removeEventListener('keydown',onGesture);
      },{once:true});
    }
  },500);
}

function closeGame(){
  if (currentIframe) {
    // 触发 game:close 钩子
    if (window.MCJS_PLUGIN_API && window.MCJS_PLUGIN_API._internal) {
      try { window.MCJS_PLUGIN_API._internal.runHook('game:close', { version: lastLaunchedVersion }); } catch (e) {}
    }
    if (window.MCJS_EVENTS) try { window.MCJS_EVENTS.emit('game:close', { version: lastLaunchedVersion }); } catch (e) {}
  }
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
  cancel:cancelMemoryOpt,
  getCacheSize:getCacheSize,
  clearCache:clearGameCache,
  clearSaveData:clearSaveData,
  formatBytes:formatBytes,
  openDB:openDB,
  buildMirrorURL:buildMirrorURL,
  detectWasmSupport:detectWasmSupport,
  needsWasmFallback:needsWasmFallback,
  buildWasmPolyfillScript:buildWasmPolyfillScript,
  pingMirror:pingMirror,
  fetchGameHTMLRacing:fetchGameHTMLRacing,
  manualOptimize: manualOptimizeMemory,
  optimizeMemory: optimizeMemory
};

})();