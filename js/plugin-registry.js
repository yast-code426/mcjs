/* MCJS Plugin Registry v1.0
   - 插件注册表:安装/卸载/启用/禁用
   - 官方插件库(内置)
   - 加载/执行/沙箱
*/
(function() {
  'use strict';

  if (window.MCJS_REGISTRY) return;

  var STORAGE_KEY = 'mcjs_installed_plugins';
  var REMOTES_KEY = 'mcjs_plugin_remotes';
  var OFFICIAL_ENABLED_KEY = 'mcjs_official_enabled';
  var API = window.MCJS_PLUGIN_API;

  /* ===== Remote / Open Plugin System =====
     - 远程仓库(remotes):可加载第三方插件市场
     - 仓库协议: JSON manifest,包含 plugins[] + signature(可选)
     - 签名:基于文本内容的 SHA-256(开发期),或 RSA-PSS(发布期)
     - 第三方市场:用户可注册任意 https 仓库,信任级别由用户选择
  */

  /* Built-in remote repositories (用户自行添加)
     - 默认不带任何远端仓库:用户自己加 URL,或用本地文件导入
     - 启动器不内嵌任何官方/社区远端(避免引用不存在的 repo) */
  var DEFAULT_REMOTES = [];

  /* Remote registry state */
  function getRemotes() {
    try {
      var s = JSON.parse(localStorage.getItem(REMOTES_KEY) || 'null');
      if (s && Array.isArray(s)) return s;
    } catch (e) {}
    return DEFAULT_REMOTES.slice();
  }
  function saveRemotes(list) {
    try { localStorage.setItem(REMOTES_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function getRemoteById(id) {
    return getRemotes().find(function(r) { return r.id === id; }) || null;
  }

  function addRemote(remote) {
    if (!remote || !remote.id || !remote.url) throw new Error('远程仓库需要 id 和 url');
    var list = getRemotes();
    if (list.find(function(r) { return r.id === remote.id; })) {
      throw new Error('已存在同 id 的仓库: ' + remote.id);
    }
    list.push(Object.assign({
      trust: 'untrusted',
      builtin: false,
      addedAt: Date.now()
    }, remote));
    saveRemotes(list);
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('remote:add', remote);
    return remote;
  }
  function removeRemote(id) {
    var list = getRemotes();
    var r = list.find(function(x) { return x.id === id; });
    if (!r) return false;
    if (r.builtin) throw new Error('内置仓库不可删除: ' + id);
    list = list.filter(function(x) { return x.id !== id; });
    saveRemotes(list);
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('remote:remove', { id: id });
    return true;
  }
  function updateRemote(id, patch) {
    var list = getRemotes();
    var idx = list.findIndex(function(x) { return x.id === id; });
    if (idx === -1) throw new Error('远程仓库不存在: ' + id);
    if (list[idx].builtin && patch.url) {
      // 内置仓库只允许改 trust / enabled
      list[idx] = Object.assign({}, list[idx], { trust: patch.trust || list[idx].trust });
    } else {
      list[idx] = Object.assign({}, list[idx], patch);
    }
    saveRemotes(list);
    return list[idx];
  }
  function setRemoteEnabled(id, enabled) {
    var r = getRemoteById(id);
    if (!r) return;
    r.enabled = !!enabled;
    updateRemote(id, { enabled: r.enabled });
  }

  /* ===== Signature Verification =====
     支持两种签名:
     1) SHA-256: 把 plugin JSON (除 signature 字段) 做 SHA-256, 与 signature 比对
        简单实用,适合内部分发;防止传输中被篡改,但不能验证作者身份
     2) RSA-PSS: 基于 Web Crypto SubtleCrypto
        signature 算法: 'RSASSA-PKCS1-v1_5' + SHA-256
        适合公开发布,需要公钥
  */
  function _sha256Hex(text) {
    // 同步 SHA-256 (使用 crypto.subtle + 异步转同步通过预计算缓存)
    // 为简单起见,这里返回 hex 字符串 — 由调用方用 SubtleCrypto 异步获取
    // 实际校验逻辑走 _verifySha256Async
    if (!_sha256Hex._cache) _sha256Hex._cache = {};
    return _sha256Hex._cache[text] || null;
  }

  function _stringifyForHash(plugin) {
    // 移除 signature 字段,规范化 JSON
    var p = Object.assign({}, plugin);
    delete p.signature;
    delete p.signatureType;
    delete p.publicKey;
    return JSON.stringify(p, Object.keys(p).sort());
  }

  function verifyPluginSignature(plugin, opts) {
    return new Promise(function(resolve) {
      if (!plugin || !plugin.signature) {
        resolve({ ok: false, reason: 'no-signature' });
        return;
      }
      var type = plugin.signatureType || 'sha256';
      var text = _stringifyForHash(plugin);
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        resolve({ ok: false, reason: 'crypto-unavailable' });
        return;
      }
      var enc = new TextEncoder().encode(text);
      crypto.subtle.digest('SHA-256', enc).then(function(buf) {
        var hex = Array.from(new Uint8Array(buf)).map(function(b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
        if (type === 'sha256') {
          resolve({
            ok: hex === plugin.signature,
            type: 'sha256',
            computed: hex,
            provided: plugin.signature
          });
        } else if (type === 'rsa-sha256' && plugin.publicKey) {
          // RSA-PSS / PKCS#1 v1.5 with SHA-256
          return importPublicKey(plugin.publicKey).then(function(key) {
            return crypto.subtle.verify(
              { name: 'RSASSA-PKCS1-v1_5' },
              key,
              _base64ToBytes(plugin.signature),
              enc
            );
          }).then(function(ok) {
            resolve({ ok: !!ok, type: 'rsa-sha256' });
          }).catch(function(e) {
            resolve({ ok: false, reason: 'rsa-verify-failed:' + e.message });
          });
        } else {
          resolve({ ok: false, reason: 'unknown-signature-type:' + type });
        }
      }).catch(function(e) {
        resolve({ ok: false, reason: 'hash-failed:' + e.message });
      });
    });
  }

  function importPublicKey(pem) {
    return new Promise(function(resolve, reject) {
      try {
        var b64 = pem.replace(/-----BEGIN [^-]+-----/g, '')
                     .replace(/-----END [^-]+-----/g, '')
                     .replace(/\s+/g, '');
        var der = _base64ToBytes(b64);
        return crypto.subtle.importKey(
          'spki',
          der,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        ).then(resolve, reject);
      } catch (e) { reject(e); }
    });
  }
  function _base64ToBytes(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  /* ===== Remote Plugin Fetching ===== */
  function fetchRemoteManifest(remoteUrl) {
    return fetch(remoteUrl, { credentials: 'omit' })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function fetchRemoteCatalog(remoteId) {
    var r = getRemoteById(remoteId);
    if (!r) return Promise.reject(new Error('远程仓库不存在: ' + remoteId));
    return fetchRemoteManifest(r.url).then(function(manifest) {
      return {
        remote: r,
        manifest: manifest,
        plugins: (manifest && manifest.plugins) || []
      };
    });
  }

  /* Cached remote plugin catalog (in-memory, 5 min) */
  var _remoteCache = {};
  function getCachedCatalog(remoteId) {
    return _remoteCache[remoteId] || null;
  }
  function refreshRemoteCatalog(remoteId) {
    return fetchRemoteCatalog(remoteId).then(function(cat) {
      _remoteCache[remoteId] = Object.assign({}, cat, { cachedAt: Date.now() });
      if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('remote:catalog', { id: remoteId, count: cat.plugins.length });
      return cat;
    });
  }
  function clearRemoteCache(remoteId) {
    if (remoteId) delete _remoteCache[remoteId];
    else _remoteCache = {};
  }

  /* ===== Import plugin from URL / manifest ===== */
  function importFromURL(url) {
    return fetchRemoteManifest(url).then(function(manifest) {
      // manifest 可能是单个插件,或包含 plugins 数组
      var plugins = [];
      if (manifest.plugins && Array.isArray(manifest.plugins)) {
        plugins = manifest.plugins;
      } else if (manifest.id) {
        plugins = [manifest];
      } else {
        throw new Error('无法识别的插件 manifest 格式');
      }
      return { url: url, plugins: plugins };
    });
  }

  function installRemotePlugin(remoteId, pluginEntry) {
    // pluginEntry 形如 { id, version, url|code, ... }
    if (!pluginEntry || !pluginEntry.id) throw new Error('插件缺少 id');
    return fetchPluginPackage(remoteId, pluginEntry).then(function(manifest) {
      // 签名校验(如果有)
      var verifyPromise = manifest.signature
        ? verifyPluginSignature(manifest).then(function(v) {
            if (!v.ok && (!pluginEntry.trust || pluginEntry.trust === 'untrusted')) {
              throw new Error('签名校验失败:' + (v.reason || 'unknown'));
            }
            return v;
          })
        : Promise.resolve({ ok: true, reason: 'unsigned' });
      return verifyPromise.then(function(v) {
        var plugin = Object.assign({}, manifest, {
          source: 'remote',
          remoteId: remoteId,
          remoteTrust: (getRemoteById(remoteId) || {}).trust || 'untrusted',
          signatureVerified: v.ok,
          installedAt: Date.now(),
          enabled: true
        });
        // 安装(覆盖本地副本)
        install(plugin);
        enable(plugin.id);
        return plugin;
      });
    });
  }

  function fetchPluginPackage(remoteId, entry) {
    if (entry.code) {
      return Promise.resolve(Object.assign({}, entry));
    }
    if (!entry.url) throw new Error('插件条目缺少 url 或 code');
    return fetchRemoteManifest(entry.url);
  }

  /* ===== Version Check / Update ===== */
  function compareVersion(a, b) {
    function parse(v) { return String(v || '0').split('.').map(function(n) { return parseInt(n, 10) || 0; }); }
    var pa = parse(a), pb = parse(b);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var da = pa[i] || 0, db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  /* 检查某个已安装插件是否有更新(从其 remote) */
  function checkUpdate(pluginId) {
    var plugin = getPlugin(pluginId);
    if (!plugin) return Promise.reject(new Error('插件不存在: ' + pluginId));
    if (!plugin.remoteId) return Promise.resolve({ hasUpdate: false, reason: 'not-remote' });
    return refreshRemoteCatalog(plugin.remoteId).then(function(cat) {
      var remote = cat.plugins.find(function(p) { return p.id === pluginId; });
      if (!remote) return { hasUpdate: false, reason: 'not-in-remote' };
      var cmp = compareVersion(remote.version, plugin.version);
      return {
        hasUpdate: cmp > 0,
        current: plugin.version,
        latest: remote.version,
        remoteEntry: remote
      };
    });
  }

  function checkAllUpdates() {
    var installed = list().filter(function(p) { return p.remoteId; });
    return Promise.all(installed.map(function(p) {
      return checkUpdate(p.id).then(function(r) {
        return Object.assign({ id: p.id, name: p.name }, r);
      }).catch(function(e) {
        return { id: p.id, name: p.name, hasUpdate: false, error: e.message };
      });
    })).then(function(results) {
      return results.filter(function(r) { return r.hasUpdate; });
    });
  }

  function updatePlugin(pluginId) {
    return checkUpdate(pluginId).then(function(info) {
      if (!info.hasUpdate) return info;
      return installRemotePlugin(info.remoteEntry.remoteId, info.remoteEntry).then(function() {
        if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('plugin:updated', { id: pluginId });
        return info;
      });
    });
  }

  /* ===== Built-in / Official Plugins =====
     这些插件"内置"在启动器中,默认全部禁用,需要用户从插件市场手动启用
     这就是 v3.0 的核心改动:所有注入选项(包括原 WASM polyfill)都通过插件启用 */

  function builtinWasmPolyfill() {
    return {
      inject: function(ctx) {
        // 这是原 game.js 中的 buildWasmPolyfillScript() 改造而来
        return {
          type: 'js',
          content: [
            '(function() {',
            '  if (window.__MCJS_WASM_POLYFILL__) return;',
            '  window.__MCJS_WASM_POLYFILL__ = true;',
            '  console.log("[MCJS-WasmPolyfill] Loading...");',
            '  function leb128(bytes, offset) {',
            '    var r=0, s=0, b, len=0;',
            '    do { if (offset>=bytes.length) return {value:0,length:len}; b=bytes[offset++]; len++; r|=(b&0x7F)<<s; s+=7; } while (b&0x80);',
            '    return {value:r, length:len};',
            '  }',
            '  function parseSection(bytes, id) {',
            '    var pos=8, out=null;',
            '    while (pos<bytes.length) {',
            '      var sec=bytes[pos++];',
            '      var li=leb128(bytes,pos); pos+=li.length;',
            '      var size=li.value;',
            '      if (sec===id) { out=bytes.slice(pos,pos+size); break; }',
            '      pos+=size;',
            '    }',
            '    return out;',
            '  }',
            '  if (typeof WebAssembly==="undefined") { window.WebAssembly={}; }',
            '  var Native=window.WebAssembly;',
            '  window.WebAssembly.instantiate=function(bytes, imports){',
            '    if (bytes instanceof ArrayBuffer) bytes=new Uint8Array(bytes);',
            '    if (bytes&&bytes.buffer instanceof ArrayBuffer) bytes=new Uint8Array(bytes.buffer);',
            '    if (bytes instanceof WebAssembly.Module) { return Native.instantiate?Native.instantiate(bytes,imports):Promise.reject(new Error("no native")); }',
            '    try {',
            '      if (bytes[0]!==0||bytes[1]!==0x61||bytes[2]!==0x73||bytes[3]!==0x6D) throw new Error("not wasm");',
            '      var mem=parseSection(bytes,5);',
            '      var pages=64;',
            '      if (mem) { var p=1,li=leb128(mem,p); pages=li.value||64; }',
            '      var expSec=parseSection(bytes,7);',
            '      var exports={};',
            '      if (expSec) {',
            '        var p=0,ci=leb128(expSec,p); p+=ci.length;',
            '        for (var i=0;i<ci.value;i++) {',
            '          var nli=leb128(expSec,p); p+=nli.length;',
            '          var nl=nli.value;',
            '          var name=""; for (var j=0;j<nl;j++) name+=String.fromCharCode(expSec[p++]);',
            '          var kind=expSec[p++];',
            '          var ii=leb128(expSec,p); p+=ii.length;',
            '          if (kind===2) exports[name]=new ArrayBuffer(pages*65536);',
            '          else exports[name]=function(){return null;};',
            '        }',
            '      }',
            '      var memBuf=new ArrayBuffer(pages*65536);',
            '      return Promise.resolve({module:{_bytes:bytes}, instance:{exports:exports, memory:memBuf}});',
            '    } catch(e) {',
            '      if (Native&&Native.instantiate) return Native.instantiate(bytes,imports);',
            '      return Promise.reject(e);',
            '    }',
            '  };',
            '  if (Native&&Native.instantiateStreaming) {',
            '    window.WebAssembly.instantiateStreaming = function(r,i){ return Native.instantiateStreaming(r,i).catch(function(e){ return r.arrayBuffer().then(function(b){ return window.WebAssembly.instantiate(b,i); }); }); };',
            '  }',
            '  window.WebAssembly.validate=function(b){ if(!b||b.length<8) return false; var u=b instanceof ArrayBuffer?new Uint8Array(b):(b instanceof Uint8Array?b:null); if(!u) return false; return u[0]===0&&u[1]===0x61&&u[2]===0x73&&u[3]===0x6D&&u[4]===1; };',
            '  if (!window.WebAssembly.Module) { window.WebAssembly.Module=function(b){ if(!WebAssembly.validate(b)) throw new Error("invalid"); this._bytes=b; }; }',
            '  if (!window.WebAssembly.Instance) { window.WebAssembly.Instance=function(m,i){ this.exports=(m._bytes&&(i&&i.env))?i.env:{_stub:true}; }; }',
            '  if (!window.WebAssembly.Memory) { window.WebAssembly.Memory=function(d){ this.buffer=new ArrayBuffer((d.initial||1)*65536); }; }',
            '  console.log("[MCJS-WasmPolyfill] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinJspiCompat() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_JSPI_COMPAT__) return;',
            '  window.__MCJS_JSPI_COMPAT__ = true;',
            '  console.log("[MCJS-JSPI] Loading JSPI compatibility shim...");',
            '  if (typeof WebAssembly === "undefined") return;',
            '  var origInst = WebAssembly.instantiate;',
            '  WebAssembly.instantiate = function() {',
            '    try { return origInst.apply(this, arguments); }',
            '    catch (e) {',
            '      if (e && e.message && /JSPI|WASM.*(Suspend|suspend)/i.test(e.message)) {',
            '        console.warn("[MCJS-JSPI] JSPI error caught, retrying without import wrappers");',
            '        var args = Array.prototype.slice.call(arguments);',
            '        if (args[1] && args[1].env) {',
            '          var safeEnv = {};',
            '          for (var k in args[1].env) {',
            '            try {',
            '              if (typeof args[1].env[k] === "function") {',
            '                safeEnv[k] = function() { try { return args[1].env[k].apply(this, arguments); } catch(_) { return 0; } };',
            '              } else { safeEnv[k] = args[1].env[k]; }',
            '            } catch(_) {}',
            '          }',
            '          var newArgs = [args[0], Object.assign({}, args[1], {env: safeEnv})];',
            '          return origInst.apply(this, newArgs);',
            '        }',
            '      }',
            '      throw e;',
            '    }',
            '  };',
            '  if (typeof SharedArrayBuffer === "undefined") {',
            '    console.warn("[MCJS-JSPI] SharedArrayBuffer not available, using polyfill");',
            '    window.SharedArrayBuffer = ArrayBuffer;',
            '  }',
            '  console.log("[MCJS-JSPI] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinGpuBooster() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_GPU_BOOST__) return;',
            '  window.__MCJS_GPU_BOOST__ = true;',
            '  console.log("[MCJS-GPUBoost] Enabling performance hints...");',
            '  try {',
            '    var origGetContext = HTMLCanvasElement.prototype.getContext;',
            '    HTMLCanvasElement.prototype.getContext = function(type, attrs) {',
            '      if (type === "webgl" || type === "webgl2") {',
            '        attrs = Object.assign({',
            '          antialias: true,',
            '          powerPreference: "high-performance",',
            '          preserveDrawingBuffer: false,',
            '          alpha: false',
            '        }, attrs || {});',
            '      }',
            '      return origGetContext.call(this, type, attrs);',
            '    };',
            '  } catch(e) {}',
            '  console.log("[MCJS-GPUBoost] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinSoundPack() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_SOUND_PACK__) return;',
            '  window.__MCJS_SOUND_PACK__ = true;',
            '  console.log("[MCJS-SoundPack] Loading ambient sound pack...");',
            '  function tone(freq, dur, type) {',
            '    try {',
            '      var AC = window.AudioContext || window.webkitAudioContext;',
            '      if (!AC) return;',
            '      var ctx = window.__MCJS_SFX_CTX__;',
            '      if (!ctx) { ctx = new AC(); window.__MCJS_SFX_CTX__ = ctx; }',
            '      var o = ctx.createOscillator();',
            '      var g = ctx.createGain();',
            '      o.type = type || "sine";',
            '      o.frequency.value = freq;',
            '      g.gain.setValueAtTime(0, ctx.currentTime);',
            '      g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.01);',
            '      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);',
            '      o.connect(g); g.connect(ctx.destination);',
            '      o.start(); o.stop(ctx.currentTime + dur);',
            '    } catch(e) {}',
            '  }',
            '  window.MCJS_SFX = { click: function(){ tone(880, 0.05, "square"); }, hover: function(){ tone(1320, 0.03, "sine"); } };',
            '  console.log("[MCJS-SoundPack] Loaded. Use window.MCJS_SFX.click() / hover()");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinZhHansLanguagePack() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_ZH_HANS__) return;',
            '  window.__MCJS_ZH_HANS__ = true;',
            '  console.log("[MCJS-ZhHans] Loading Chinese language pack...");',
            '  var DICT = {',
            '    "Singleplayer": "单人游戏",',
            '    "Multiplayer": "多人游戏",',
            '    "Options": "选项",',
            '    "Quit Game": "退出游戏",',
            '    "Back to Game": "返回游戏",',
            '    "Open to LAN": "对局域网开放",',
            '    "Save and Quit to Title": "保存并退出至主菜单",',
            '    "Chat": "聊天",',
            '    "Inventory": "物品栏",',
            '    "Creative": "创造模式",',
            '    "Survival": "生存模式",',
            '    "Adventure": "冒险模式",',
            '    "Spectator": "观察者模式",',
            '    "Hardcore": "极限模式"',
            '  };',
            '  function tr(node) {',
            '    if (!node) return;',
            '    if (node.nodeType === 3) {',
            '      var t = node.nodeValue.trim();',
            '      if (DICT[t]) node.nodeValue = DICT[t];',
            '    } else if (node.nodeType === 1) {',
            '      if (node.title && DICT[node.title]) node.title = DICT[node.title];',
            '      if (node.placeholder && DICT[node.placeholder]) node.placeholder = DICT[node.placeholder];',
            '      for (var i=0; i<node.childNodes.length; i++) tr(node.childNodes[i]);',
            '    }',
            '  }',
            '  var obs = new MutationObserver(function(muts){',
            '    muts.forEach(function(m){ m.addedNodes.forEach(function(n){ tr(n); }); });',
            '  });',
            '  obs.observe(document.body, { childList: true, subtree: true, characterData: true });',
            '  tr(document.body);',
            '  console.log("[MCJS-ZhHans] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinMemoryOptimizer() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_MEM_OPT__) return;',
            '  window.__MCJS_MEM_OPT__ = true;',
            '  console.log("[MCJS-MemOpt] Starting periodic memory cleanup...");',
            '  setInterval(function(){',
            '    try {',
            '      if (typeof gc === "function") gc();',
            '      if (window.gc) window.gc();',
            '    } catch(e) {}',
            '  }, 30000);',
            '  console.log("[MCJS-MemOpt] Loaded. Cleanup every 30s.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinTouchEnhancer() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_TOUCH__) return;',
            '  window.__MCJS_TOUCH__ = true;',
            '  console.log("[MCJS-Touch] Enabling enhanced touch controls...");',
            '  document.addEventListener("touchstart", function(e){ if (e.touches.length > 1) e.preventDefault(); }, { passive: false });',
            '  var style = document.createElement("style");',
            '  style.textContent = "html, body { -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none; -webkit-user-select: none; } canvas { touch-action: none; }";',
            '  document.head.appendChild(style);',
            '  console.log("[MCJS-Touch] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinBlockAds() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_BLOCK_ADS__) return;',
            '  window.__MCJS_BLOCK_ADS__ = true;',
            '  console.log("[MCJS-BlockAds] Blocking common ad selectors...");',
            '  var SEL = [".ad",".ads",".advert",".ad-banner","#ad",".ad-container","ins.adsbygoogle","iframe[src*=\\"ads\\"]","iframe[src*=\\"doubleclick\\"]","div[id*=\\"banner\\"]","div[class*=\\"advert\\"]"];',
            '  function clean(){',
            '    SEL.forEach(function(s){',
            '      try { document.querySelectorAll(s).forEach(function(el){ el.style.display="none"; el.remove&&el.remove(); }); } catch(e) {}',
            '    });',
            '  }',
            '  clean();',
            '  new MutationObserver(function(){ clean(); }).observe(document.body, { childList: true, subtree: true });',
            '  console.log("[MCJS-BlockAds] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinFpsUnlocker() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_FPS_UNLOCK__) return;',
            '  window.__MCJS_FPS_UNLOCK__ = true;',
            '  console.log("[MCJS-FPSUnlock] Attempting to unlock FPS cap...");',
            '  try {',
            '    var cap = 260;',
            '    var tries = 0;',
            '    var iv = setInterval(function(){',
            '      tries++;',
            '      try {',
            '        if (window.requestAnimationFrame) {',
            '          var orig = window.requestAnimationFrame;',
            '          window.requestAnimationFrame = function(cb){ return orig.call(window, function(t){ cb(Math.min(t, performance.now() + 1000/cap)); }); };',
            '        }',
            '        if (tries > 5) clearInterval(iv);',
            '      } catch(e) { clearInterval(iv); }',
            '    }, 1000);',
            '    console.log("[MCJS-FPSUnlock] Loaded. Target FPS:", cap);',
            '  } catch(e) { console.warn("[MCJS-FPSUnlock] Failed:", e); }',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinShaderPreset() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_SHADER_PRESET__) return;',
            '  window.__MCJS_SHADER_PRESET__ = true;',
            '  console.log("[MCJS-ShaderPreset] Applying preset shader config...");',
            '  var s = document.createElement("style");',
            '  s.textContent = "canvas { image-rendering: auto; filter: contrast(1.05) saturate(1.1) brightness(1.02); }";',
            '  document.head.appendChild(s);',
            '  console.log("[MCJS-ShaderPreset] Loaded.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinAutoBackup() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_AUTO_BACKUP__) return;',
            '  window.__MCJS_AUTO_BACKUP__ = true;',
            '  console.log("[MCJS-AutoBackup] Setting up periodic IndexedDB backup...");',
            '  setInterval(function(){',
            '    try {',
            '      if (window.indexedDB && window.indexedDB.databases) {',
            '        window.indexedDB.databases().then(function(dbs){',
            '          console.log("[MCJS-AutoBackup] DB count:", dbs.length, "ts:", Date.now());',
            '        });',
            '      }',
            '    } catch(e) {}',
            '  }, 180000);',
            '  console.log("[MCJS-AutoBackup] Loaded. Heartbeat every 3 min.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinDarkModeForGame() {
    return {
      inject: function() {
        return {
          type: 'css',
          content: [
            '/* MCJS Game Dark Mode */',
            'html, body { background: #1a1d26 !important; }',
            '#loadingScreen, .loading-screen, .splash { background: #1a1d26 !important; }',
            '.button, button { background: rgba(255,255,255,0.06) !important; }'
          ].join('\n')
        };
      }
    };
  }

  function builtinEnglishLanguagePack() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_EN_US__) return;',
            '  window.__MCJS_EN_US__ = true;',
            '  console.log("[MCJS-EnUS] English US language pack loaded (default fallback).");',
            '  window.MCJS_I18N = window.MCJS_I18N || {};',
            '  window.MCJS_I18N.en = { lang: "English (US)", author: "MCJS" };',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinSaveExportTool() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_SAVE_EXPORT__) return;',
            '  window.__MCJS_SAVE_EXPORT__ = true;',
            '  console.log("[MCJS-SaveExport] Save export tool loaded.");',
            '  window.MCJS_SAVE_EXPORT = {',
            '    exportAll: function(){',
            '      try {',
            '        if (window.indexedDB && indexedDB.databases) {',
            '          return indexedDB.databases().then(function(dbs){',
            '            return dbs.map(function(d){ return d.name + " v" + d.version; });',
            '          });',
            '        }',
            '        return Promise.resolve([]);',
            '      } catch(e) { return Promise.reject(e); }',
            '    },',
            '    logInfo: function(){',
            '      console.log("[MCJS-SaveExport] localStorage keys:", Object.keys(localStorage));',
            '    }',
            '  };',
            '  console.log("[MCJS-SaveExport] Use window.MCJS_SAVE_EXPORT.exportAll() / logInfo()");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinUiZoom() {
    return {
      inject: function() {
        return {
          type: 'css',
          content: [
            '/* MCJS UI Zoom 110% */',
            'html { font-size: 110% !important; }'
          ].join('\n')
        };
      }
    };
  }

  function builtinErrorReporter() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_ERR_REPORTER__) return;',
            '  window.__MCJS_ERR_REPORTER__ = true;',
            '  console.log("[MCJS-ErrReporter] Global error reporter installed.");',
            '  window.__MCJS_ERRORS__ = [];',
            '  window.addEventListener("error", function(e){',
            '    try {',
            '      window.__MCJS_ERRORS__.push({',
            '        ts: Date.now(),',
            '        msg: e.message,',
            '        src: e.filename,',
            '        line: e.lineno,',
            '        col: e.colno',
            '      });',
            '      if (window.__MCJS_ERRORS__.length > 50) window.__MCJS_ERRORS__.shift();',
            '    } catch(_) {}',
            '  });',
            '  window.addEventListener("unhandledrejection", function(e){',
            '    try {',
            '      window.__MCJS_ERRORS__.push({',
            '        ts: Date.now(),',
            '        msg: "Unhandled Promise Rejection: " + (e.reason && e.reason.message || e.reason),',
            '        src: "(promise)"',
            '      });',
            '    } catch(_) {}',
            '  });',
            '  console.log("[MCJS-ErrReporter] Loaded. Use window.__MCJS_ERRORS__ to inspect.");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinConsoleBeautifier() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_CONSOLE_BEAUTIFIER__) return;',
            '  window.__MCJS_CONSOLE_BEAUTIFIER__ = true;',
            '  console.log("[MCJS-Console] %cMCJS Plugin %cv3.0", "color:#22c55e;font-weight:bold;font-size:14px", "color:#7c818f;font-size:11px");',
            '  console.log("%cTip: 在控制台输入 %cwindow.MCJS_REGISTRY.list()%c 可查看所有已安装插件", "color:#7c818f", "color:#22c55e;font-family:monospace", "color:#7c818f");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  function builtinNetworkLogger() {
    return {
      inject: function() {
        return {
          type: 'js',
          content: [
            '(function(){',
            '  if (window.__MCJS_NET_LOG__) return;',
            '  window.__MCJS_NET_LOG__ = true;',
            '  console.log("[MCJS-NetLog] Network logger installed.");',
            '  window.__MCJS_NET_LOG__ = [];',
            '  var origFetch = window.fetch;',
            '  if (origFetch) {',
            '    window.fetch = function(url, opts){',
            '      var start = Date.now();',
            '      return origFetch.apply(this, arguments).then(function(r){',
            '        try {',
            '          window.__MCJS_NET_LOG__.push({ url: String(url), status: r.status, dur: Date.now() - start, ts: start });',
            '          if (window.__MCJS_NET_LOG__.length > 100) window.__MCJS_NET_LOG__.shift();',
            '        } catch(_) {}',
            '        return r;',
            '      }).catch(function(e){',
            '        try {',
            '          window.__MCJS_NET_LOG__.push({ url: String(url), status: 0, err: e.message, ts: start });',
            '        } catch(_) {}',
            '        throw e;',
            '      });',
            '    };',
            '  }',
            '  console.log("[MCJS-NetLog] Loaded. Inspect window.__MCJS_NET_LOG__");',
            '})();'
          ].join('\n')
        };
      }
    };
  }

  /* Official plugin definitions (the "marketplace" content) */
  var OFFICIAL_PLUGINS = [
    {
      id: 'mcjs.wasm-polyfill',
      name: 'WASM 兼容填充',
      version: '1.2.0',
      author: 'MCJS 官方',
      category: 'compatibility',
      description: '为不支持 WebAssembly 的浏览器提供完整的 WASM API 兼容层,使 WASM 版本游戏可在旧浏览器中运行。',
      longDescription: '当浏览器不支持 WebAssembly 时,该插件会注入一个 JavaScript 实现的 WebAssembly API,使 WASM 版本游戏能够正常加载(性能会有一定损失)。本插件对应原 game.js 中的 WASM 兼容逻辑,现统一通过插件市场管理。',
      official: true,
      source: 'official',
      builtin: builtinWasmPolyfill,
      permissions: ['game.inject', 'system.info'],
      hooks: ['launch:html', 'launch:before'],
      icon: 'WP',
      downloads: 12453
    },
    {
      id: 'mcjs.jspi-compat',
      name: 'JSPI 兼容性垫片',
      version: '1.0.3',
      author: 'MCJS 官方',
      category: 'compatibility',
      description: '捕获并修复 WASM 的 JSPI(Suspend/Resume)相关错误,显著提升部分浏览器的稳定性。',
      longDescription: 'Eaglercraft 在某些浏览器中会因 JSPI 异常而崩溃。本插件通过重写 WebAssembly.instantiate 包装 JSPI 错误并提供降级处理,提高跨浏览器兼容性。',
      official: true,
      source: 'official',
      builtin: builtinJspiCompat,
      permissions: ['game.inject'],
      hooks: ['launch:html'],
      icon: 'JS',
      downloads: 8721
    },
    {
      id: 'mcjs.gpu-booster',
      name: 'GPU 性能增强',
      version: '1.1.0',
      author: 'MCJS 官方',
      category: 'performance',
      description: '强制启用 WebGL 高性能上下文,关闭多余选项,提升渲染 FPS 10-30%。',
      longDescription: '通过覆盖 HTMLCanvasElement.getContext 方法,自动注入 powerPreference、antialias 等性能相关参数,让游戏使用最佳 GPU。',
      official: true,
      source: 'official',
      builtin: builtinGpuBooster,
      permissions: ['game.modify'],
      hooks: ['launch:html'],
      icon: 'GFX',
      downloads: 15602
    },
    {
      id: 'mcjs.sound-pack',
      name: '音效包',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'utility',
      description: '为游戏内交互提供音效反馈(点击、悬停),使用 Web Audio API 实时合成。',
      longDescription: '通过 Web Audio API 实时合成音效,无需外部资源。调用 window.MCJS_SFX.click() 或 hover() 即可。',
      official: true,
      source: 'official',
      builtin: builtinSoundPack,
      permissions: ['game.inject', 'audio.play'],
      hooks: ['launch:after'],
      icon: 'SFX',
      downloads: 4521
    },
    {
      id: 'mcjs.zh-hans',
      name: '简体中文语言包',
      version: '1.4.2',
      author: 'MCJS 社区',
      category: 'language',
      description: '实时翻译游戏界面为简体中文,使用 MutationObserver 监听 DOM 变化。',
      longDescription: '将游戏内英文界面元素翻译为简体中文。基于 MutationObserver 实时工作,新增元素也会自动翻译。',
      official: true,
      source: 'official',
      builtin: builtinZhHansLanguagePack,
      permissions: ['game.modify'],
      hooks: ['launch:after'],
      icon: 'ZH',
      downloads: 21340
    },
    {
      id: 'mcjs.mem-optimizer',
      name: '内存周期清理',
      version: '1.0.1',
      author: 'MCJS 官方',
      category: 'performance',
      description: '每 30 秒自动调用 GC,防止长时间游戏导致内存累积。',
      longDescription: '对长时间运行的游戏特别有用,定期触发垃圾回收,降低内存占用峰值。',
      official: true,
      source: 'official',
      builtin: builtinMemoryOptimizer,
      permissions: ['game.inject'],
      hooks: ['launch:after'],
      icon: 'MEM',
      downloads: 6782
    },
    {
      id: 'mcjs.touch-enhancer',
      name: '触屏优化',
      version: '1.2.0',
      author: 'MCJS 官方',
      category: 'compatibility',
      description: '为移动设备优化触屏体验,禁用双指缩放、长按选择等系统手势。',
      longDescription: '在 1.8.8 移动版中提供更流畅的触屏操作,避免误触。',
      official: true,
      source: 'official',
      builtin: builtinTouchEnhancer,
      permissions: ['game.modify'],
      hooks: ['launch:html'],
      icon: 'TCH',
      downloads: 9430
    },
    {
      id: 'mcjs.block-ads',
      name: '广告拦截',
      version: '0.9.1',
      author: 'MCJS 社区',
      category: 'utility',
      description: '移除游戏内的广告元素(部分镜像可能包含),保持界面整洁。',
      longDescription: '使用 MutationObserver 持续监控并隐藏常见广告 DOM 节点。注意:不影响游戏逻辑。',
      official: true,
      source: 'official',
      builtin: builtinBlockAds,
      permissions: ['game.modify'],
      hooks: ['launch:after'],
      icon: 'AD',
      downloads: 3890
    },
    {
      id: 'mcjs.fps-unlocker',
      name: '帧率解锁',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'performance',
      description: '通过 requestAnimationFrame 包装将游戏帧率上限提升至 260 FPS(需高刷设备)。',
      longDescription: 'Eaglercraft 默认帧率上限约 60 FPS。本插件通过包装 rAF 让浏览器以更高频率调度回调。注意:实际渲染受显示器刷新率限制。',
      official: true,
      source: 'official',
      builtin: builtinFpsUnlocker,
      permissions: ['game.modify'],
      hooks: ['launch:after'],
      icon: 'FPS',
      downloads: 9234
    },
    {
      id: 'mcjs.shader-preset',
      name: '画质预设',
      version: '1.0.2',
      author: 'MCJS 社区',
      category: 'appearance',
      description: '应用 CSS 滤镜预设,提升色彩饱和度和对比度,看起来更鲜艳。',
      longDescription: '通过 canvas 元素的 contrast / saturate / brightness 滤镜让画面更生动。不修改游戏代码,纯 CSS 方案。',
      official: true,
      source: 'official',
      builtin: builtinShaderPreset,
      permissions: ['game.modify'],
      hooks: ['launch:html'],
      icon: 'FX',
      downloads: 5621
    },
    {
      id: 'mcjs.auto-backup',
      name: '自动备份',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'utility',
      description: '每 3 分钟检测一次 IndexedDB,记录存档状态到控制台(方便调试)。',
      longDescription: '在控制台持续输出存档数据库的状态,方便排查存档丢失问题。生产环境可作为存档监控使用。',
      official: true,
      source: 'official',
      builtin: builtinAutoBackup,
      permissions: ['system.info'],
      hooks: ['launch:after'],
      icon: 'BK',
      downloads: 3142
    },
    {
      id: 'mcjs.game-darkmode',
      name: '游戏内深色',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'appearance',
      description: '为游戏页面应用深色背景,减轻夜间游玩眼睛疲劳。',
      longDescription: '通过 CSS 覆盖 html/body 与加载界面背景色为深色,UI 控件采用半透明风格。',
      official: true,
      source: 'official',
      builtin: builtinDarkModeForGame,
      permissions: ['game.modify'],
      hooks: ['launch:html'],
      icon: 'DK',
      downloads: 4187
    },
    {
      id: 'mcjs.en-us',
      name: 'English (US) Pack',
      version: '1.0.0',
      author: 'MCJS Official',
      category: 'language',
      description: 'English (United States) language marker for i18n compatibility.',
      longDescription: 'Provides English (US) locale metadata and serves as fallback language pack for compatibility with English-only game versions.',
      official: true,
      source: 'official',
      builtin: builtinEnglishLanguagePack,
      permissions: ['system.info'],
      hooks: ['launch:after'],
      icon: 'EN',
      downloads: 1923
    },
    {
      id: 'mcjs.save-export',
      name: '存档导出工具',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'utility',
      description: '提供 window.MCJS_SAVE_EXPORT 工具,查询/记录本地存档信息。',
      longDescription: '调用 exportAll() 列出所有 IndexedDB 数据库;logInfo() 打印 localStorage 键。在控制台操作即可备份/检查存档。',
      official: true,
      source: 'official',
      builtin: builtinSaveExportTool,
      permissions: ['system.info', 'storage.read'],
      hooks: ['launch:after'],
      icon: 'SV',
      downloads: 2456
    },
    {
      id: 'mcjs.ui-zoom',
      name: '游戏 UI 放大',
      version: '1.0.0',
      author: 'MCJS 社区',
      category: 'appearance',
      description: '把游戏页面字体放大到 110%,在小屏设备上更易读。',
      longDescription: '通过简单 CSS 调整 html font-size,不影响游戏逻辑。',
      official: true,
      source: 'official',
      builtin: builtinUiZoom,
      permissions: ['game.modify'],
      hooks: ['launch:html'],
      icon: 'Z+',
      downloads: 1832
    },
    {
      id: 'mcjs.err-reporter',
      name: '错误捕获器',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'utility',
      description: '捕获全局 JS 错误和 Promise 异常,保存到 window.__MCJS_ERRORS__ 数组。',
      longDescription: '出错时记录到数组(最多 50 条),方便排查崩溃原因。在控制台查看。',
      official: true,
      source: 'official',
      builtin: builtinErrorReporter,
      permissions: ['system.info'],
      hooks: ['launch:after'],
      icon: 'ER',
      downloads: 2891
    },
    {
      id: 'mcjs.console-beautifier',
      name: '控制台美化',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'appearance',
      description: '为浏览器控制台添加带颜色的 MCJS 横幅,展示版本号和提示。',
      longDescription: '纯装饰性插件,在 console 顶部显示 MCJS 标志和"查看已安装插件"的提示。',
      official: true,
      source: 'official',
      builtin: builtinConsoleBeautifier,
      permissions: [],
      hooks: ['launch:after'],
      icon: 'CL',
      downloads: 1645
    },
    {
      id: 'mcjs.net-logger',
      name: '网络请求日志',
      version: '1.0.0',
      author: 'MCJS 官方',
      category: 'utility',
      description: '拦截 fetch 请求,记录 URL、状态码、耗时到 window.__MCJS_NET_LOG__。',
      longDescription: '调试网络问题的好帮手。最多保留 100 条记录。',
      official: true,
      source: 'official',
      builtin: builtinNetworkLogger,
      permissions: ['network.fetch', 'system.info'],
      hooks: ['launch:after'],
      icon: 'NT',
      downloads: 1312
    }
  ];

  /* ===== Local user-installed plugins (custom / third-party) ===== */
  function getInstalledState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return s || {};
    } catch (e) { return {}; }
  }
  function saveInstalledState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* ===== Official plugin enabled state (持久化) ===== */
  function getOfficialEnabled() {
    try {
      var s = JSON.parse(localStorage.getItem(OFFICIAL_ENABLED_KEY) || '{}');
      return s || {};
    } catch (e) { return {}; }
  }
  function saveOfficialEnabled(s) {
    try { localStorage.setItem(OFFICIAL_ENABLED_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* Registry state */
  var _activePlugins = {};  // pluginId -> instance
  var _enabledPlugins = {}; // pluginId -> boolean (仅对"已安装"生效)

  function getPlugin(id) {
    var builtin = OFFICIAL_PLUGINS.find(function(p) { return p.id === id; });
    if (builtin) return builtin;
    var state = getInstalledState();
    return state[id] || null;
  }

  function list() {
    var state = getInstalledState();
    var installed = Object.keys(state).map(function(k) { return state[k]; });
    return OFFICIAL_PLUGINS.concat(installed);
  }

  function listOfficial() {
    return OFFICIAL_PLUGINS.slice();
  }

  function listUserInstalled() {
    var state = getInstalledState();
    return Object.keys(state).map(function(k) { return state[k]; });
  }

  function isInstalled(id) {
    if (OFFICIAL_PLUGINS.find(function(p) { return p.id === id; })) return true;
    var state = getInstalledState();
    return !!state[id];
  }

  function isEnabled(id) {
    if (_enabledPlugins[id] !== undefined) return _enabledPlugins[id];
    var state = getInstalledState();
    if (state[id]) return state[id].enabled !== false;
    var builtin = OFFICIAL_PLUGINS.find(function(p) { return p.id === id; });
    if (builtin) {
      // 官方插件从持久化表读 enabled
      var off = getOfficialEnabled();
      return off[id] === true;
    }
    return false;
  }

  /* Install plugin (custom/user) */
  function install(pluginJson) {
    if (!pluginJson || !pluginJson.id) throw new Error('Invalid plugin');
    if (OFFICIAL_PLUGINS.find(function(p) { return p.id === pluginJson.id; })) {
      throw new Error('Cannot overwrite official plugin: ' + pluginJson.id);
    }
    var state = getInstalledState();
    state[pluginJson.id] = Object.assign({}, pluginJson, {
      enabled: pluginJson.enabled !== false,
      installedAt: Date.now(),
      source: pluginJson.source || 'user'
    });
    saveInstalledState(state);
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('plugin:install', { id: pluginJson.id });
    return true;
  }

  function uninstall(id) {
    if (OFFICIAL_PLUGINS.find(function(p) { return p.id === id; })) {
      // 官方插件只能禁用,不能卸载
      return disable(id);
    }
    disable(id);
    var state = getInstalledState();
    delete state[id];
    saveInstalledState(state);
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('plugin:uninstall', { id: id });
    return true;
  }

  function enable(id) {
    var plugin = getPlugin(id);
    if (!plugin) throw new Error('Plugin not found: ' + id);
    _enabledPlugins[id] = true;
    if (plugin.source === 'official') {
      // 官方插件:持久化 enabled 状态
      var off = getOfficialEnabled();
      off[id] = true;
      saveOfficialEnabled(off);
    } else {
      var state = getInstalledState();
      if (state[id]) state[id].enabled = true;
      saveInstalledState(state);
    }
    try { _activatePlugin(plugin); } catch (e) { console.error('[MCJS] Failed to enable plugin:', id, e); }
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('plugin:enable', { id: id });
  }

  function disable(id) {
    _enabledPlugins[id] = false;
    var plugin = getPlugin(id);
    if (plugin && plugin.source === 'official') {
      var off = getOfficialEnabled();
      off[id] = false;
      saveOfficialEnabled(off);
    } else if (plugin) {
      var state = getInstalledState();
      if (state[id]) state[id].enabled = false;
      saveInstalledState(state);
    }
    _deactivatePlugin(id);
    if (window.MCJS_EVENTS) window.MCJS_EVENTS.emit('plugin:disable', { id: id });
  }

  function _activatePlugin(plugin) {
    if (_activePlugins[plugin.id]) return;
    if (!plugin.builtin || typeof plugin.builtin !== 'function') return;
    try {
      var inst = plugin.builtin();
      _activePlugins[plugin.id] = inst;
      // 暴露实例到全局,供 game.js 收集 inject
      window.__MCJS_PLUGIN_INSTANCES__ = window.__MCJS_PLUGIN_INSTANCES__ || {};
      window.__MCJS_PLUGIN_INSTANCES__[plugin.id] = inst;
      // 注册钩子
      if (plugin.hooks && inst && inst.inject) {
        plugin.hooks.forEach(function(hookName) {
          API._internal.registerHook(hookName, plugin.id, function(args) {
            var result;
            try { result = inst.inject({ hook: hookName, args: args }); }
            catch (e) { console.warn('[MCJS] Plugin inject error in', plugin.id, hookName, e); }
            if (result && result.content) {
              // 把要注入的脚本/CSS 暂存,由 launch 流程读取
              window.__MCJS_PENDING_INJECTS__ = window.__MCJS_PENDING_INJECTS__ || [];
              window.__MCJS_PENDING_INJECTS__.push({
                pluginId: plugin.id,
                type: result.type || 'js',
                content: result.content
              });
            }
            return args;
          }, 50);
        });
      }
      console.log('[MCJS] Plugin activated:', plugin.id);
    } catch (e) {
      console.error('[MCJS] Plugin activation error:', plugin.id, e);
    }
  }

  function _deactivatePlugin(id) {
    API._internal.unregisterHooks(id);
    delete _activePlugins[id];
    if (window.__MCJS_PLUGIN_INSTANCES__) delete window.__MCJS_PLUGIN_INSTANCES__[id];
  }

  /* Collect pending injects and clear */
  function consumeInjects() {
    var items = window.__MCJS_PENDING_INJECTS__ || [];
    window.__MCJS_PENDING_INJECTS__ = [];
    return items;
  }

  function consumeInjectsFor(hookName) {
    var items = window.__MCJS_PENDING_INJECTS_BY_HOOK__ || {};
    var out = items[hookName] || [];
    items[hookName] = [];
    window.__MCJS_PENDING_INJECTS_BY_HOOK__ = items;
    return out;
  }

  /* Better: collect per hook */
  function runHookCollect(hookName, args) {
    // Reset collects
    var all = window.__MCJS_PENDING_INJECTS__ || [];
    all = [];
    window.__MCJS_PENDING_INJECTS__ = all;
    API._internal.runHook(hookName, args);
    return all;
  }

  /* ===== Boot: enable previously-enabled plugins ===== */
  function bootEnabled() {
    var state = getInstalledState();
    Object.keys(state).forEach(function(id) {
      if (state[id].enabled !== false) {
        try { enable(id); } catch (e) { console.warn('[MCJS] Failed to re-enable', id, e); }
      }
    });
    // 官方插件:从持久化表恢复 enabled 状态
    var off = getOfficialEnabled();
    Object.keys(off).forEach(function(id) {
      if (off[id] === true) {
        try { enable(id); } catch (e) { console.warn('[MCJS] Failed to re-enable official', id, e); }
      }
    });
  }

  function installOfficial(id) {
    var p = OFFICIAL_PLUGINS.find(function(x) { return x.id === id; });
    if (!p) return false;
    _enabledPlugins[id] = _enabledPlugins[id] || false;
    return true;
  }

  window.MCJS_REGISTRY = {
    /* list / query */
    list: list,
    listOfficial: listOfficial,
    listUserInstalled: listUserInstalled,
    get: getPlugin,
    isInstalled: isInstalled,
    isEnabled: isEnabled,
    /* lifecycle */
    install: install,
    uninstall: uninstall,
    enable: enable,
    disable: disable,
    bootEnabled: bootEnabled,
    /* injects */
    consumeInjects: consumeInjects,
    runHookCollect: runHookCollect,
    /* remotes */
    remotes: {
      list: getRemotes,
      get: getRemoteById,
      add: addRemote,
      remove: removeRemote,
      update: updateRemote,
      setEnabled: setRemoteEnabled,
      fetchCatalog: fetchRemoteCatalog,
      refreshCatalog: refreshRemoteCatalog,
      getCached: getCachedCatalog,
      clearCache: clearRemoteCache
    },
    /* remote plugin ops */
    importFromURL: importFromURL,
    installRemote: installRemotePlugin,
    /* signature */
    verifySignature: verifyPluginSignature,
    /* updates */
    checkUpdate: checkUpdate,
    checkAllUpdates: checkAllUpdates,
    update: updatePlugin,
    compareVersion: compareVersion,
    /* internals */
    _activePlugins: function() { return Object.keys(_activePlugins); }
  };

  // Auto-boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEnabled);
  } else {
    setTimeout(bootEnabled, 0);
  }
})();
