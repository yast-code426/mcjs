/* MCJS Launcher - Compatibility Polyfills
 * 必须在所有其他脚本之前加载。
 * 为老旧浏览器(IE11+/旧版Edge/旧版Chrome/旧版Safari/内置WebView)提供:
 *   - ES5/ES6 数组与对象方法补丁
 *   - Promise 基础 polyfill(若原生缺失)
 *   - fetch 基础 polyfill(基于 XMLHttpRequest)
 *   - requestAnimationFrame 补丁
 *   - navigator.clipboard 回退
 *   - 性能与网络增强: DNS 预取/预连接
 * 纯 ES5 写法,不使用任何 ES6+ 语法。
 */
(function () {
  'use strict';

  var globalScope = (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self
    : (typeof global !== 'undefined') ? global : this;

  /* ---------- 工具 ---------- */
  function isCallable(v) { return typeof v === 'function'; }

  /* ---------- Object.assign ---------- */
  if (typeof Object.assign !== 'function') {
    Object.assign = function (target) {
      if (target == null) throw new TypeError('Object.assign target cannot be null/undefined');
      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src != null) {
          for (var key in src) {
            if (Object.prototype.hasOwnProperty.call(src, key)) to[key] = src[key];
          }
        }
      }
      return to;
    };
  }

  /* ---------- Object.keys(老实现兜底,正常 ES5 已有) ---------- */
  if (typeof Object.keys !== 'function') {
    Object.keys = (function () {
      var hasOwn = Object.prototype.hasOwnProperty;
      var dontEnums = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
        'isPrototypeOf', 'propertyIsEnumerable', 'constructor'];
      return function (obj) {
        if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
          throw new TypeError('Object.keys called on non-object');
        }
        var result = [], prop, i;
        for (prop in obj) {
          if (hasOwn.call(obj, prop)) result.push(prop);
        }
        for (i = 0; i < dontEnums.length; i++) {
          if (hasOwn.call(obj, dontEnums[i])) result.push(dontEnums[i]);
        }
        return result;
      };
    })();
  }

  /* ---------- Array.prototype.forEach ---------- */
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (callback, thisArg) {
      if (this == null) throw new TypeError('Array.prototype.forEach called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      for (var k = 0; k < len; k++) {
        if (k in O) callback.call(thisArg, O[k], k, O);
      }
    };
  }

  /* ---------- Array.prototype.map ---------- */
  if (!Array.prototype.map) {
    Array.prototype.map = function (callback, thisArg) {
      if (this == null) throw new TypeError('Array.prototype.map called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      var res = new Array(len);
      for (var k = 0; k < len; k++) {
        if (k in O) res[k] = callback.call(thisArg, O[k], k, O);
      }
      return res;
    };
  }

  /* ---------- Array.prototype.filter ---------- */
  if (!Array.prototype.filter) {
    Array.prototype.filter = function (callback, thisArg) {
      if (this == null) throw new TypeError('Array.prototype.filter called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      var res = [];
      for (var k = 0; k < len; k++) {
        if (k in O && callback.call(thisArg, O[k], k, O)) res.push(O[k]);
      }
      return res;
    };
  }

  /* ---------- Array.prototype.some ---------- */
  if (!Array.prototype.some) {
    Array.prototype.some = function (callback, thisArg) {
      if (this == null) throw new TypeError('Array.prototype.some called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      for (var k = 0; k < len; k++) {
        if (k in O && callback.call(thisArg, O[k], k, O)) return true;
      }
      return false;
    };
  }

  /* ---------- Array.prototype.every ---------- */
  if (!Array.prototype.every) {
    Array.prototype.every = function (callback, thisArg) {
      if (this == null) throw new TypeError('Array.prototype.every called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      for (var k = 0; k < len; k++) {
        if (k in O && !callback.call(thisArg, O[k], k, O)) return false;
      }
      return true;
    };
  }

  /* ---------- Array.prototype.indexOf(老 WebView 兜底) ---------- */
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      var k;
      if (this == null) throw new TypeError('"this" is null or not defined');
      var O = Object(this), len = O.length >>> 0;
      if (len === 0) return -1;
      var n = +fromIndex || 0;
      if (Math.abs(n) === Infinity) n = 0;
      if (n >= len) return -1;
      k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (k in O && O[k] === searchElement) return k;
        k++;
      }
      return -1;
    };
  }

  /* ---------- Array.prototype.reduce ---------- */
  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function (callback) {
      if (this === null) throw new TypeError('Array.prototype.reduce called on null or undefined');
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      var O = Object(this), len = O.length >>> 0, k = 0, value;
      if (arguments.length >= 2) {
        value = arguments[1];
      } else {
        while (k < len && !(k in O)) k++;
        if (k >= len) throw new TypeError('Reduce of empty array with no initial value');
        value = O[k++];
      }
      for (; k < len; k++) {
        if (k in O) value = callback(value, O[k], k, O);
      }
      return value;
    };
  }

  /* ---------- Array.prototype.find / findIndex ---------- */
  if (!Array.prototype.find) {
    Array.prototype.find = function (callback) {
      if (this == null) throw new TypeError('Array.prototype.find called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      var thisArg = arguments[1];
      for (var k = 0; k < len; k++) {
        if (k in O && callback.call(thisArg, O[k], k, O)) return O[k];
      }
      return undefined;
    };
  }
  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function (callback) {
      if (this == null) throw new TypeError('Array.prototype.findIndex called on null/undefined');
      var O = Object(this), len = O.length >>> 0;
      if (!isCallable(callback)) throw new TypeError(callback + ' is not a function');
      var thisArg = arguments[1];
      for (var k = 0; k < len; k++) {
        if (k in O && callback.call(thisArg, O[k], k, O)) return k;
      }
      return -1;
    };
  }

  /* ---------- Array.from(类数组转数组) ---------- */
  if (typeof Array.from !== 'function') {
    Array.from = function (arrayLike, mapFn, thisArg) {
      if (arrayLike == null) throw new TypeError('Array.from requires an array-like object');
      var len = Object(arrayLike).length >>> 0;
      var res = new Array(len);
      for (var i = 0; i < len; i++) {
        var v = arrayLike[i];
        if (mapFn) v = mapFn.call(thisArg, v, i);
        res[i] = v;
      }
      return res;
    };
  }

  /* ---------- String.prototype.trim ---------- */
  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
  }

  /* ---------- String.prototype.includes / startsWith / endsWith ---------- */
  if (!String.prototype.includes) {
    String.prototype.includes = function (search, start) {
      if (typeof start !== 'number') start = 0;
      if (start + search.length > this.length) return false;
      return this.indexOf(search, start) !== -1;
    };
  }
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (search, rawPos) {
      var pos = rawPos > 0 ? rawPos | 0 : 0;
      return this.lastIndexOf(search, pos) === pos;
    };
  }
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search, this_len) {
      if (this_len === undefined || this_len > this.length) this_len = this.length;
      return this.substring(this_len - search.length, this_len) === search;
    };
  }

  /* ---------- String.prototype.repeat ---------- */
  if (!String.prototype.repeat) {
    String.prototype.repeat = function (count) {
      if (this == null) throw new TypeError('cannot repeat ' + this);
      var str = '' + this, res = '', n = count | 0;
      if (n < 0 || n === Infinity) throw new RangeError('Invalid count value');
      while (n > 0) { if (n & 1) res += str; str += str; n >>= 1; }
      return res;
    };
  }

  /* ---------- Number.isFinite / Number.isInteger ---------- */
  if (typeof Number.isFinite !== 'function') {
    Number.isFinite = function (value) {
      return typeof value === 'number' && isFinite(value);
    };
  }
  if (typeof Number.isInteger !== 'function') {
    Number.isInteger = function (value) {
      return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    };
  }

  /* ---------- Element.classList(老浏览器兜底) ---------- */
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    var testEl = document.createElement('_');
    var clsOk = ('classList' in testEl) && isCallable(testEl.classList.add);
    if (!clsOk) {
      var ClassList = function (el) {
        this._el = el;
        var raw = (el.className && typeof el.className === 'string') ? el.className : '';
        this._set = {};
        var arr = raw.split(/\s+/);
        for (var i = 0; i < arr.length; i++) { if (arr[i]) this._set[arr[i]] = true; }
      };
      ClassList.prototype._sync = function () {
        var names = [];
        for (var k in this._set) { if (this._set[k]) names.push(k); }
        this._el.className = names.join(' ');
      };
      ClassList.prototype.add = function () {
        for (var i = 0; i < arguments.length; i++) { if (arguments[i]) this._set[arguments[i]] = true; }
        this._sync();
      };
      ClassList.prototype.remove = function () {
        for (var i = 0; i < arguments.length; i++) { delete this._set[arguments[i]]; }
        this._sync();
      };
      ClassList.prototype.toggle = function (c, force) {
        var has = !!this._set[c];
        var want = (typeof force === 'boolean') ? force : !has;
        if (want) this.add(c); else this.remove(c);
        return want;
      };
      ClassList.prototype.contains = function (c) { return !!this._set[c]; };

      Object.defineProperty(Element.prototype, 'classList', {
        get: function () { return new ClassList(this); },
        enumerable: true, configurable: true
      });
    }
  }

  /* ---------- Element.matches / closest(事件委托用) ---------- */
  if (typeof Element !== 'undefined') {
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function (s) {
          var m = (this.document || this.ownerDocument).querySelectorAll(s), i = m.length - 1;
          while (i >= 0 && m.item(i) !== this) i--;
          return i >= 0;
        };
    }
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (s) {
        var el = this;
        do {
          if (el.matches && el.matches(s)) return el;
          el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
      };
    }
  }

  /* ---------- requestAnimationFrame ---------- */
  if (typeof globalScope.requestAnimationFrame !== 'function') {
    var rafQueue = [], rafId = 0;
    var rafTick = function () {
      var now = (globalScope.performance && performance.now) ? performance.now() : Date.now();
      var q = rafQueue; rafQueue = [];
      for (var i = 0; i < q.length; i++) { try { q[i](now); } catch (e) {} }
    };
    globalScope.requestAnimationFrame = function (cb) {
      rafQueue.push(cb);
      rafId++;
      setTimeout(rafTick, 16);
      return rafId;
    };
    globalScope.cancelAnimationFrame = function (id) {
      rafQueue = rafQueue.filter(function () { return false; });
    };
  }

  /* ---------- Promise 简易 polyfill ---------- */
  if (typeof globalScope.Promise !== 'function') {
    var PENDING = 0, FULFILLED = 1, REJECTED = 2;
    function SimplePromise(executor) {
      var self = this;
      self._state = PENDING;
      self._value = undefined;
      self._callbacks = [];
      function settle(state, value) {
        if (self._state !== PENDING) return;
        self._state = state;
        self._value = value;
        setTimeout(function () {
          for (var i = 0; i < self._callbacks.length; i++) {
            var cb = self._callbacks[i], ret;
            try {
              if (state === FULFILLED) {
                ret = isCallable(cb.onFulfilled) ? cb.onFulfilled(value) : value;
                cb.promise._resolve(ret);
              } else {
                if (isCallable(cb.onRejected)) {
                  ret = cb.onRejected(value);
                  cb.promise._resolve(ret);
                } else {
                  cb.promise._reject(value);
                }
              }
            } catch (e) {
              cb.promise._reject(e);
            }
          }
          self._callbacks = [];
        }, 0);
      }
      this._resolve = function (v) {
        if (v && (typeof v === 'object' || typeof v === 'function') && isCallable(v.then)) {
          v.then(function (val) { settle(FULFILLED, val); }, function (err) { settle(REJECTED, err); });
        } else settle(FULFILLED, v);
      };
      this._reject = function (e) { settle(REJECTED, e); };
      this.then = function (onFulfilled, onRejected) {
        var p = new SimplePromise(function () {});
        if (self._state === FULFILLED) {
          setTimeout(function () {
            try { p._resolve(isCallable(onFulfilled) ? onFulfilled(self._value) : self._value); }
            catch (e) { p._reject(e); }
          }, 0);
        } else if (self._state === REJECTED) {
          setTimeout(function () {
            try {
              if (isCallable(onRejected)) p._resolve(onRejected(self._value));
              else p._reject(self._value);
            } catch (e) { p._reject(e); }
          }, 0);
        } else {
          self._callbacks.push({ onFulfilled: onFulfilled, onRejected: onRejected, promise: p });
        }
        return p;
      };
      this.catch = function (onRejected) { return this.then(null, onRejected); };
      try { executor(this._resolve.bind(this), this._reject.bind(this)); } catch (e) { this._reject(e); }
    }
    SimplePromise.resolve = function (v) {
      return new SimplePromise(function (res) { res(v); });
    };
    SimplePromise.reject = function (e) {
      return new SimplePromise(function (res, rej) { rej(e); });
    };
    SimplePromise.all = function (iterable) {
      var arr = [];
      for (var i = 0; i < iterable.length; i++) arr.push(iterable[i]);
      return new SimplePromise(function (resolve, reject) {
        if (arr.length === 0) { resolve([]); return; }
        var results = [], remaining = arr.length;
        arr.forEach(function (p, idx) {
          SimplePromise.resolve(p).then(function (v) {
            results[idx] = v; remaining--;
            if (remaining === 0) resolve(results);
          }, reject);
        });
      });
    };
    SimplePromise.race = function (iterable) {
      var arr = [];
      for (var i = 0; i < iterable.length; i++) arr.push(iterable[i]);
      return new SimplePromise(function (resolve, reject) {
        arr.forEach(function (p) { SimplePromise.resolve(p).then(resolve, reject); });
      });
    };
    globalScope.Promise = SimplePromise;
  }

  /* ---------- fetch 简易 polyfill(基于 XHR) ---------- */
  if (typeof globalScope.fetch !== 'function' && typeof XMLHttpRequest !== 'undefined') {
    globalScope.fetch = function (input, init) {
      init = init || {};
      return new globalScope.Promise(function (resolve, reject) {
        try {
          var xhr = new XMLHttpRequest();
          var url = (typeof input === 'string') ? input : input.url;
          xhr.open(init.method || 'GET', url, true);
          if (init.credentials === 'include') xhr.withCredentials = true;
          var headers = init.headers || {};
          if (headers && typeof headers === 'object') {
            for (var h in headers) {
              if (Object.prototype.hasOwnProperty.call(headers, h)) {
                try { xhr.setRequestHeader(h, headers[h]); } catch (e) {}
              }
            }
          }
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 0 && !(xhr.responseURL === '')) { /* 跨域失败由 onerror 处理 */ }
            var ok = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 304;
            var body = xhr.responseText;
            var respHeaders = {};
            var rawHeaders = xhr.getAllResponseHeaders() || '';
            rawHeaders.split(/[\r\n]+/).forEach(function (line) {
              var idx = line.indexOf(':');
              if (idx > 0) respHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
            });
            resolve({
              ok: ok,
              status: xhr.status,
              statusText: xhr.statusText || '',
              url: xhr.responseURL || url,
              headers: {
                get: function (name) { return respHeaders[String(name).toLowerCase()] || null; }
              },
              text: function () { return globalScope.Promise.resolve(body); },
              json: function () { return globalScope.Promise.resolve(JSON.parse(body)); },
              clone: function () { return this; },
              arrayBuffer: function () {
                return globalScope.Promise.resolve(new Uint8Array(xhr.response || []).buffer);
              }
            });
          };
          xhr.onerror = function () { reject(new TypeError('Network request failed: ' + url)); };
          xhr.ontimeout = function () { reject(new TypeError('Network request timed out: ' + url)); };
          if (init.timeout) xhr.timeout = init.timeout;
          if (init.body) xhr.send(init.body); else xhr.send();
        } catch (e) { reject(e); }
      });
    };
  }

  /* ---------- navigator.clipboard 回退 ---------- */
  if (globalScope.navigator && !globalScope.navigator.clipboard) {
    globalScope.navigator.clipboard = {
      writeText: function (text) {
        return new globalScope.Promise(function (resolve, reject) {
          try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            if (ok) resolve(); else reject(new Error('copy failed'));
          } catch (e) { reject(e); }
        });
      },
      readText: function () {
        return globalScope.Promise.reject(new Error('clipboard read not supported'));
      }
    };
  }

  /* ---------- localStorage 容错(隐私模式/老 WebView 可能抛异常) ---------- */
  try {
    var testKey = '__mcjs_test__';
    globalScope.localStorage.setItem(testKey, '1');
    globalScope.localStorage.removeItem(testKey);
  } catch (e) {
    if (globalScope.localStorage) {
      var memStore = {};
      var lsProto = Object.getPrototypeOf(globalScope.localStorage) || globalScope.localStorage;
      try {
        lsProto.getItem = function (k) { return (k in memStore) ? memStore[k] : null; };
        lsProto.setItem = function (k, v) { memStore[k] = String(v); };
        lsProto.removeItem = function (k) { delete memStore[k]; };
        lsProto.clear = function () { memStore = {}; };
      } catch (e2) {
        // 极端环境:直接包一层
        globalScope.localStorage = {
          getItem: function (k) { return (k in memStore) ? memStore[k] : null; },
          setItem: function (k, v) { memStore[k] = String(v); },
          removeItem: function (k) { delete memStore[k]; },
          clear: function () { memStore = {}; }
        };
      }
    }
  }

  /* ---------- 网络优化:对常用镜像域名做 DNS 预取与预连接 ---------- */
  // 注意:此函数在 DOM head 存在后由 app.js 或本文件 DOMContentLoaded 触发
  globalScope.MCJS_PRECONNECT_HOSTS = [
    'https://play.mcjs.cc',
    'https://playmcjscc.pages.dev',
    'https://play.mcjs.144449.xyz',
    'https://ipv6.mcjs.cc',
    'https://mirror.mcjs.cc',
    'https://mcjs-mirror.144449.xyz',
    'https://mcjs-mirror-test.144449.xyz',
    'https://mcjs-beta.144449.xyz',
    'https://1.mcjslink.144449.xyz',
    'https://2.mcjslink.144449.xyz',
    'https://3.mcjslink.144449.xyz',
    'https://4.mcjslink.144449.xyz',
    'https://5.mcjslink.144449.xyz',
    'https://6.mcjslink.144449.xyz',
    'https://7.mcjslink.144449.xyz'
  ];

  function injectPreconnect() {
    if (typeof document === 'undefined' || !document.head) return;
    var hosts = globalScope.MCJS_PRECONNECT_HOSTS || [];
    // 全部域名 DNS 预取(轻量,老浏览器也支持)
    for (var i = 0; i < hosts.length; i++) {
      var l = document.createElement('link');
      l.rel = 'dns-prefetch';
      l.href = hosts[i];
      document.head.appendChild(l);
    }
    // 前 4 个主镜像做完整预连接(现代浏览器生效,老浏览器自动忽略)
    for (var j = 0; j < Math.min(4, hosts.length); j++) {
      var p = document.createElement('link');
      p.rel = 'preconnect';
      p.href = hosts[j];
      p.crossOrigin = 'anonymous';
      document.head.appendChild(p);
    }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectPreconnect);
    } else {
      injectPreconnect();
    }
  }

  /* ---------- 能力检测标志,供主程序判断 ---------- */
  globalScope.MCJS_COMPAT = {
    hasFetch: typeof globalScope.fetch === 'function',
    hasPromise: typeof globalScope.Promise === 'function',
    hasWasm: typeof globalScope.WebAssembly !== 'undefined',
    hasClassList: (function () {
      try {
        var t = document.createElement('_');
        return ('classList' in t) && typeof t.classList.add === 'function';
      } catch (e) { return false; }
    })(),
    polyfilled: true,
    version: '1.3.1-compat'
  };

  if (globalScope.console && console.log) {
    console.log('[MCJS] Compatibility layer loaded', globalScope.MCJS_COMPAT.version);
  }
})();
