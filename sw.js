/* MCJS Launcher - Service Worker (ES5 兼容版)
 * - 游戏镜像资源缓存:stale-while-revalidate
 * - 启动器静态资源:缓存优先 + 后台更新
 * - 缓存条目上限自动清理(FIFO)
 * 纯 ES5 写法,不使用 async/await 与箭头函数。
 */
var CACHE_VERSION = 'mcjs-sw-v3-r1';
var STATIC_CACHE = 'mcjs-static-v3';
var GAME_CACHE_PREFIX = 'mcjs-game-';
var DEFAULT_CACHE_LIMIT = 600; // 默认缓存条目数量限制
var FETCH_TIMEOUT = 12000;    // 网络回源超时(ms)
var cacheSizeLimit = DEFAULT_CACHE_LIMIT;

/* 受管理的游戏镜像域名(与 versions.js MIRROR_BASES 对应) */
var GAME_MIRRORS = [
  'play.mcjs.cc',
  'playmcjscc.pages.dev',
  'play.mcjs.144449.xyz',
  'ipv6.mcjs.cc',
  'mirror.mcjs.cc',
  'mcjs-mirror.144449.xyz',
  'mcjs-mirror-test.144449.xyz',
  'mcjs-beta.144449.xyz',
  '1.mcjslink.144449.xyz',
  '2.mcjslink.144449.xyz',
  '3.mcjslink.144449.xyz',
  '4.mcjslink.144449.xyz',
  '5.mcjslink.144449.xyz',
  '6.mcjslink.144449.xyz',
  '7.mcjslink.144449.xyz'
];

/* 启动器自身静态资源(缓存优先,后台更新) */
var STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/compat.js',
  './js/versions.js',
  './js/game.js',
  './js/announcements.js',
  './js/plugin-api.js',
  './js/plugin-registry.js',
  './js/plugin-market.js',
  './js/plugin-editor.js',
  './js/app.js',
  './assets/favicon.svg',
  './assets/bg.jpg'
];

function asPromise(v) { return Promise.resolve(v); }

/* 带超时的 fetch:老网络/弱网环境下避免长时间挂起 */
function fetchWithTimeout(request, timeout) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error('FETCH_TIMEOUT'));
    }, timeout);
    fetch(request).then(function (resp) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(resp);
    }).catch(function (err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/* 检查并清理超出限制的缓存(简单 FIFO 策略) */
function checkAndTrimCache(cache) {
  return asPromise(cache.keys()).then(function (keys) {
    if (keys.length <= cacheSizeLimit) return;
    var excess = keys.length - cacheSizeLimit;
    console.log('[SW] Cache limit exceeded, trimming', excess, 'entries');
    var chain = Promise.resolve();
    for (var i = 0; i < excess && i < keys.length; i++) {
      (function (key) {
        chain = chain.then(function () { return cache.delete(key); });
      })(keys[i]);
    }
    return chain;
  }).catch(function (e) {
    console.warn('[SW] Cache trim failed:', e);
  });
}

/* Install:预缓存启动器核心静态资源,失败不阻塞激活 */
self.addEventListener('install', function (event) {
  console.log('[SW] Installing v3...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).then(function () {
        console.log('[SW] Static assets precached');
      }).catch(function (err) {
        console.warn('[SW] Precache partial failure:', err);
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* Activate:清理全部旧版本缓存 */
self.addEventListener('activate', function (event) {
  console.log('[SW] Activating v3...');
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name !== CACHE_VERSION && name !== STATIC_CACHE;
          })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isGameMirror(hostname) {
  for (var i = 0; i < GAME_MIRRORS.length; i++) {
    if (hostname === GAME_MIRRORS[i]) return true;
  }
  return false;
}

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  var accept = request.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

/* Fetch 主逻辑 */
self.addEventListener('fetch', function (event) {
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // 只处理 GET
  if (event.request.method !== 'GET') return;

  var gameReq = isGameMirror(url.hostname);
  var sameOrigin = (url.origin === self.location.origin);

  if (gameReq) {
    // ===== 游戏镜像资源:缓存优先 + 后台更新(stale-while-revalidate) =====
    event.respondWith(
      caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(event.request).then(function (cached) {
          // 后台更新(无论缓存是否命中)
          var networkPromise = fetchWithTimeout(event.request, FETCH_TIMEOUT).then(function (resp) {
            if (resp && resp.ok) {
              var clone = resp.clone();
              cache.put(event.request, clone).then(function () {
                return checkAndTrimCache(cache);
              }).catch(function (err) {
                console.warn('[SW] Cache put failed:', err);
              });
            }
            return resp;
          }).catch(function (err) {
            console.warn('[SW] Game fetch failed:', err && err.message);
            throw err;
          });

          if (cached) {
            // 缓存命中:HTML 注入 polyfill 后返回;非 HTML 直接返回
            return respondCached(cached);
          }
          // 无缓存:等待网络
          return networkPromise.then(function (resp) {
            if (isHtmlRequest(event.request) && resp.ok) {
              return injectAndRespond(resp);
            }
            return resp;
          }).catch(function () {
            return new Response('Game resource unavailable (offline?)', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        });
      })
    );
    return;
  }

  if (sameOrigin) {
    // ===== 同源启动器资源:缓存优先,后台刷新 =====
    event.respondWith(
      caches.open(STATIC_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (cached) {
          var fetchPromise = fetchWithTimeout(event.request, FETCH_TIMEOUT).then(function (resp) {
            if (resp && resp.ok && url.protocol.indexOf('http') === 0) {
              try { cache.put(event.request, resp.clone()); } catch (e) {}
            }
            return resp;
          }).catch(function () { return null; });

          if (cached) {
            // 后台更新
            fetchPromise;
            return cached;
          }
          return fetchPromise.then(function (resp) {
            return resp || new Response('Offline', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // 其他跨域请求(字体/统计等):直接放行,不拦截
});

/* 返回缓存内容(HTML 注入 polyfill) */
function respondCached(cachedResponse) {
  if (isHtmlRequestSafe(cachedResponse)) {
    return cachedResponse.text().then(function (html) {
      var injected = injectPolyfills(html);
      return new Response(injected, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: *;"
        },
        status: 200
      });
    });
  }
  return cachedResponse;
}

function isHtmlRequestSafe(response) {
  var ct = '';
  try { ct = response.headers.get('content-type') || ''; } catch (e) {}
  return ct.indexOf('text/html') !== -1;
}

/* 网络返回 HTML 时注入 polyfill */
function injectAndRespond(networkResponse) {
  return networkResponse.text().then(function (html) {
    var injected = injectPolyfills(html);
    return new Response(injected, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 200
    });
  });
}

/* 注入 JSPI/SAB/GPU 兼容脚本 */
function injectPolyfills(html) {
  var polyfillScript = '<script>' +
    '(function(){' +
    'try{' +
    'if(typeof WebAssembly!=="undefined"&&WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,1,123,1,123,3,2,1,0,5,3,1,0,2,7,9,1,5,95,109,97,105,110,0,0,10,10,1,8,0,65,0,250,10,11,11]))){return;}' +
    '}catch(e){}' +
    'if(typeof WebAssembly==="undefined")return;' +
    'var origInst=WebAssembly.instantiate;' +
    'WebAssembly.instantiate=function(){' +
    'try{return origInst.apply(this,arguments);}catch(e){' +
    'if(e.message&&e.message.indexOf("JSPI")!==-1){console.warn("[MCJS] JSPI fallback");return Promise.reject(e);}' +
    'throw e;}};' +
    'if(typeof SharedArrayBuffer==="undefined"){window.SharedArrayBuffer=ArrayBuffer;console.warn("[MCJS] SAB fallback");}' +
    '})();' +
    '(function(){try{var c=document.createElement("canvas");var gl=c.getContext("webgl2")||c.getContext("webgl");' +
    'if(gl){var ext=gl.getExtension("WEBGL_debug_renderer_info");' +
    'if(ext)console.log("[MCJS] GPU: "+gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));}}catch(e){}})();' +
    '<\/script>';

  if (html.indexOf('<head>') !== -1) {
    return html.replace('<head>', '<head>' + polyfillScript);
  }
  if (html.indexOf('<html>') !== -1) {
    return html.replace('<html>', '<html><head>' + polyfillScript + '</head>');
  }
  return polyfillScript + html;
}

/* 主线程消息:缓存管理 */
self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'CLEAR_GAME_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_VERSION).then(function () {
        return caches.open(CACHE_VERSION);
      })
    );
  }
  if (data.type === 'CLEAR_ALL_CACHE') {
    event.waitUntil(
      caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n); }));
      })
    );
  }
  if (data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.open(CACHE_VERSION).then(function (cache) {
        return cache.keys().then(function (keys) {
          return { type: 'CACHE_SIZE_RESPONSE', count: keys.length };
        });
      })
    );
  }
  if (data.type === 'SET_CACHE_LIMIT') {
    var limit = Number(data.limit);
    if (!isFinite(limit) || limit < 10 || limit > 10000) limit = DEFAULT_CACHE_LIMIT;
    cacheSizeLimit = limit;
    console.log('[SW] Cache limit set to:', cacheSizeLimit);
    event.waitUntil(
      caches.open(CACHE_VERSION).then(function (cache) {
        return checkAndTrimCache(cache);
      })
    );
  }
});
