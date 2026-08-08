/* MCJS Launcher - Service Worker */
const CACHE_VERSION = 'mcjs-sw-v2-r3';
const GAME_CACHE_PREFIX = 'mcjs-game-';
const DEFAULT_CACHE_LIMIT = 500; // 默认缓存条目数量限制
var cacheSizeLimit = DEFAULT_CACHE_LIMIT;

// 检查并清理超出限制的缓存（简单的 FIFO 策略）
async function checkAndTrimCache(cache) {
  try {
    var keys = await cache.keys();
    if (keys.length <= cacheSizeLimit) return;
    
    var excess = keys.length - cacheSizeLimit;
    console.log('[SW] Cache limit exceeded, trimming', excess, 'oldest entries');
    
    // 删除最旧的条目（前 excess 个）
    for (var i = 0; i < excess && i < keys.length; i++) {
      await cache.delete(keys[i]);
    }
  } catch (e) {
    console.warn('[SW] Cache trim failed:', e);
  }
}

// Install event
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name.startsWith(GAME_CACHE_PREFIX) && name !== CACHE_VERSION; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch event - intercept game file requests
self.addEventListener('fetch', function(event) {
  var url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Only intercept requests to known MCJS CDN mirrors
  var gameMirrors = [
    'play.mcjs.cc',
    'playmcjscc.pages.dev',
    'play.mcjs.144449.xyz',
    'ipv6.mcjs.cc',
    'mirror.mcjs.cc',
    'mcjs-mirror.144449.xyz',
    'mcjs-mirror-test.144449.xyz',
    'mcjs-beta.144449.xyz'
  ];

  var isGameRequest = gameMirrors.some(function(mirror) {
    return url.hostname === mirror;
  });

  if (!isGameRequest) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          // For HTML requests, inject polyfills
          if (event.request.mode === 'navigate' || 
              event.request.headers.get('accept')?.indexOf('text/html') !== -1) {
            return cachedResponse.text().then(function(html) {
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

        // Not cached - fetch from network
        return fetch(event.request).then(function(networkResponse) {
          if (networkResponse.ok) {
            // Clone and cache the response
            var responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache).then(function() {
              // 检查缓存大小，超出限制时清理
              return checkAndTrimCache(cache);
            }).catch(function(err) {
              console.warn('[SW] Cache put failed:', err);
            });

            // For HTML responses, inject polyfills
            if (event.request.mode === 'navigate' || 
                event.request.headers.get('accept')?.indexOf('text/html') !== -1) {
              return networkResponse.text().then(function(html) {
                var injected = injectPolyfills(html);
                return new Response(injected, {
                  headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                  },
                  status: 200
                });
              });
            }
          }
          return networkResponse;
        }).catch(function(err) {
          console.warn('[SW] Fetch failed:', err);
          return new Response('Game resource unavailable', { status: 503 });
        });
      });
    })
  );
});

// Inject JSPI polyfill and other compatibility scripts into game HTML
function injectPolyfills(html) {
  var polyfillScript = '<script>' +
    // JSPI compatibility
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
    // GPU preference
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

// Message handler for cache management from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_GAME_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_VERSION).then(function() {
        return caches.open(CACHE_VERSION);
      })
    );
  }
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.open(CACHE_VERSION).then(function(cache) {
        return cache.keys().then(function(keys) {
          return { type: 'CACHE_SIZE_RESPONSE', count: keys.length };
        });
      })
    );
  }
  if (event.data && event.data.type === 'SET_CACHE_LIMIT') {
    cacheSizeLimit = event.data.limit || DEFAULT_CACHE_LIMIT;
    console.log('[SW] Cache limit set to:', cacheSizeLimit);
    event.waitUntil(
      caches.open(CACHE_VERSION).then(function(cache) {
        return checkAndTrimCache(cache);
      })
    );
  }
});
