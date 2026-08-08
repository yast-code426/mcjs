/* MCJS Plugin API v1.0
   - Core hook/permission system for plugins
   - 插件核心 API:钩子点、权限系统、注入机制
   - 暴露给插件开发者
*/
(function() {
  'use strict';

  if (window.MCJS_PLUGIN_API) return;

  /* ===== Hook System ===== */
  var _hooks = {}; // hookName -> [{pluginId, fn, priority}]

  function registerHook(name, pluginId, fn, priority) {
    if (!_hooks[name]) _hooks[name] = [];
    _hooks[name].push({ pluginId: pluginId, fn: fn, priority: priority || 100 });
    _hooks[name].sort(function(a, b) { return a.priority - b.priority; });
  }

  function unregisterPluginHooks(pluginId) {
    Object.keys(_hooks).forEach(function(name) {
      _hooks[name] = (_hooks[name] || []).filter(function(h) { return h.pluginId !== pluginId; });
    });
  }

  /* Run a hook with synchronous result collection */
  function runHook(name, args, ctx) {
    var list = _hooks[name];
    if (!list || list.length === 0) return args;
    var current = args;
    for (var i = 0; i < list.length; i++) {
      try {
        var result = list[i].fn.call(ctx || null, current);
        if (result !== undefined) current = result;
      } catch (e) {
        console.error('[MCJS Plugin] Hook error in', name, ':', e);
      }
    }
    return current;
  }

  /* Run all hook handlers, return array of results (for events) */
  function runHookAll(name, args, ctx) {
    var list = _hooks[name];
    if (!list || list.length === 0) return [];
    var results = [];
    for (var i = 0; i < list.length; i++) {
      try {
        results.push(list[i].fn.call(ctx || null, args));
      } catch (e) {
        console.error('[MCJS Plugin] Hook error in', name, ':', e);
      }
    }
    return results;
  }

  /* ===== Event Bus ===== */
  var _listeners = {};
  function on(eventName, fn) {
    if (!_listeners[eventName]) _listeners[eventName] = [];
    _listeners[eventName].push(fn);
    return function() {
      _listeners[eventName] = (_listeners[eventName] || []).filter(function(f) { return f !== fn; });
    };
  }
  function emit(eventName, payload) {
    var list = _listeners[eventName];
    if (!list) return;
    list.slice().forEach(function(fn) {
      try { fn(payload); } catch (e) { console.error('[MCJS Plugin] Event error in', eventName, ':', e); }
    });
  }

  /* ===== Settings (per-plugin) ===== */
  function getPluginSetting(pluginId, key, defVal) {
    try {
      var s = JSON.parse(localStorage.getItem('mcjs_plugin_settings') || '{}');
      var p = s[pluginId] || {};
      return p[key] !== undefined ? p[key] : defVal;
    } catch (e) { return defVal; }
  }
  function setPluginSetting(pluginId, key, value) {
    try {
      var s = JSON.parse(localStorage.getItem('mcjs_plugin_settings') || '{}');
      s[pluginId] = s[pluginId] || {};
      s[pluginId][key] = value;
      localStorage.setItem('mcjs_plugin_settings', JSON.stringify(s));
    } catch (e) {}
  }
  function getAllPluginSettings(pluginId) {
    try {
      var s = JSON.parse(localStorage.getItem('mcjs_plugin_settings') || '{}');
      return s[pluginId] || {};
    } catch (e) { return {}; }
  }

  /* ===== Permission System ===== */
  var PERMS = {
    'storage.read': '读取本地存储',
    'storage.write': '写入本地存储',
    'network.fetch': '发起网络请求',
    'game.inject': '注入代码到游戏页面',
    'game.modify': '修改游戏 DOM 或行为',
    'launch.override': '拦截/修改启动流程',
    'ui.extend': '扩展启动器界面',
    'plugins.manage': '管理其他插件',
    'system.info': '读取浏览器/系统信息',
    'audio.play': '播放音频'
  };

  /* ===== Logger ===== */
  function log(pluginId, level, args) {
    var tag = '[MCJS:' + pluginId + ']';
    var method = (level === 'error') ? 'error' : (level === 'warn' ? 'warn' : 'log');
    console[method].apply(console, [tag].concat(Array.prototype.slice.call(args)));
  }

  /* ===== Plugin API Object ===== */
  var api = {
    version: '1.0.0',
    PERMS: PERMS,

    /* Hooks */
    on: on,
    emit: emit,
    addHook: function(name, fn, priority) {
      // 兼容 - 由 registry 内部包装
      console.warn('[MCJS Plugin API] addHook should be called via plugin context, use registerHook instead');
    },

    /* Settings */
    getSetting: getPluginSetting,
    setSetting: setPluginSetting,
    getAllSettings: getAllPluginSettings,

    /* Storage (per-plugin, namespaced) */
    storage: {
      getItem: function(pluginId, key) {
        try {
          var s = JSON.parse(localStorage.getItem('mcjs_plugin_storage') || '{}');
          var p = s[pluginId] || {};
          return p[key] !== undefined ? p[key] : null;
        } catch (e) { return null; }
      },
      setItem: function(pluginId, key, value) {
        try {
          var s = JSON.parse(localStorage.getItem('mcjs_plugin_storage') || '{}');
          s[pluginId] = s[pluginId] || {};
          s[pluginId][key] = value;
          localStorage.setItem('mcjs_plugin_storage', JSON.stringify(s));
          return true;
        } catch (e) { return false; }
      },
      removeItem: function(pluginId, key) {
        try {
          var s = JSON.parse(localStorage.getItem('mcjs_plugin_storage') || '{}');
          if (s[pluginId]) delete s[pluginId][key];
          localStorage.setItem('mcjs_plugin_storage', JSON.stringify(s));
        } catch (e) {}
      },
      clear: function(pluginId) {
        try {
          var s = JSON.parse(localStorage.getItem('mcjs_plugin_storage') || '{}');
          if (pluginId) delete s[pluginId];
          else s = {};
          localStorage.setItem('mcjs_plugin_storage', JSON.stringify(s));
        } catch (e) {}
      }
    },

    /* Network */
    fetch: function(pluginId, url, opts) {
      return fetch(url, Object.assign({ credentials: 'omit' }, opts || {}));
    },

    /* UI - Toast 通知 */
    toast: function(msg, type) {
      if (window.MCJS_TOAST) {
        window.MCJS_TOAST(msg, type || 'info');
      } else {
        console.log('[MCJS Plugin Toast]', msg);
      }
    },

    /* UI - DOM 助手 */
    ui: {
      addButton: function(label, onClick, opts) {
        var btn = document.createElement('button');
        btn.className = (opts && opts.className) || 'plugin-btn';
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        if (opts && opts.title) btn.title = opts.title;
        if (opts && opts.parent) opts.parent.appendChild(btn);
        return btn;
      },
      addPanel: function(title, content) {
        var panel = document.createElement('div');
        panel.className = 'plugin-panel';
        panel.innerHTML = '<div class="plugin-panel-header">' + (title || '') + '</div>' +
                          '<div class="plugin-panel-body">' + (content || '') + '</div>';
        return panel;
      }
    },

    /* Game - 在游戏 iframe 中执行代码 */
    injectScript: function(pluginId, scriptContent) {
      return new Promise(function(resolve, reject) {
        var iframe = document.getElementById('gameFrame');
        if (!iframe || !iframe.contentWindow) {
          reject(new Error('Game iframe not available'));
          return;
        }
        try {
          var script = iframe.contentDocument.createElement('script');
          script.textContent = scriptContent;
          script.setAttribute('data-mcjs-plugin', pluginId);
          iframe.contentDocument.head.appendChild(script);
          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    },

    injectCSS: function(pluginId, css) {
      return new Promise(function(resolve, reject) {
        var iframe = document.getElementById('gameFrame');
        if (!iframe || !iframe.contentDocument) {
          reject(new Error('Game iframe not available'));
          return;
        }
        try {
          var style = iframe.contentDocument.createElement('style');
          style.textContent = css;
          style.setAttribute('data-mcjs-plugin', pluginId);
          iframe.contentDocument.head.appendChild(style);
          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    },

    /* 启动前修改 - 修改启动参数 */
    launchContext: {
      // 当前启动的版本信息(只在启动过程中可用)
      getCurrent: function() {
        return window.MCJS_LAUNCH_CONTEXT || null;
      }
    },

    /* Registry - 列出/查询其他插件 */
    plugins: {
      list: function() {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.list();
        return [];
      },
      isInstalled: function(id) {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.isInstalled(id);
        return false;
      },
      get: function(id) {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.get(id);
        return null;
      }
    },

    /* 远程仓库(开放插件系统) */
    remotes: {
      list: function() {
        if (window.MCJS_REGISTRY && window.MCJS_REGISTRY.remotes) {
          return window.MCJS_REGISTRY.remotes.list();
        }
        return [];
      },
      add: function(remote) {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.remotes.add(remote);
        throw new Error('Registry not available');
      },
      remove: function(id) {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.remotes.remove(id);
        throw new Error('Registry not available');
      },
      refresh: function(id) {
        if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.remotes.refreshCatalog(id);
        return Promise.reject(new Error('Registry not available'));
      }
    },

    /* 远程插件操作 */
    importFromURL: function(url) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.importFromURL(url);
      return Promise.reject(new Error('Registry not available'));
    },
    installRemote: function(remoteId, entry) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.installRemote(remoteId, entry);
      return Promise.reject(new Error('Registry not available'));
    },
    verifySignature: function(plugin) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.verifySignature(plugin);
      return Promise.reject(new Error('Registry not available'));
    },
    checkUpdate: function(pluginId) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.checkUpdate(pluginId);
      return Promise.reject(new Error('Registry not available'));
    },
    checkAllUpdates: function() {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.checkAllUpdates();
      return Promise.resolve([]);
    },
    update: function(pluginId) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.update(pluginId);
      return Promise.reject(new Error('Registry not available'));
    },
    compareVersion: function(a, b) {
      if (window.MCJS_REGISTRY) return window.MCJS_REGISTRY.compareVersion(a, b);
      return 0;
    },

    /* 内部 - 由 registry 调用 */
    _internal: {
      registerHook: registerHook,
      unregisterHooks: unregisterPluginHooks,
      runHook: runHook,
      runHookAll: runHookAll,
      log: log,
      emit: emit,
      on: on
    }
  };

  window.MCJS_PLUGIN_API = api;
  window.MCJS_HOOKS = _hooks;
  window.MCJS_EVENTS = { on: on, emit: emit };

  /* 常用钩子点文档(用于 IDE 智能提示和文档生成) */
  window.MCJS_HOOK_POINTS = [
    { name: 'launch:version', desc: '启动游戏前,可修改版本配置', args: 'version', returns: 'version' },
    { name: 'launch:mirrors', desc: '获取镜像列表前,可增删镜像', args: 'mirrors,version', returns: 'mirrors' },
    { name: 'launch:html', desc: '游戏 HTML 加载前,可修改 HTML 内容(用于注入)', args: 'html,version,mirrorURL', returns: 'html' },
    { name: 'launch:before', desc: '游戏启动前(用户已点击启动,但 iframe 还没创建)', args: 'version', returns: 'void' },
    { name: 'launch:after', desc: '游戏启动后(iframe 内容已写入)', args: 'version,iframe', returns: 'void' },
    { name: 'launch:failed', desc: '所有镜像都失败时', args: 'version,error', returns: 'void' },
    { name: 'launch:cancel', desc: '用户取消启动时', args: 'version', returns: 'void' },
    { name: 'game:close', desc: '关闭游戏时', args: 'version', returns: 'void' },
    { name: 'settings:open', desc: '设置窗口打开时', args: 'settings', returns: 'settings' },
    { name: 'settings:save', desc: '保存设置时', args: 'settings', returns: 'settings' },
    { name: 'app:ready', desc: '启动器 DOM 加载完成时', args: 'void', returns: 'void' },
    { name: 'app:render', desc: '版本卡片渲染后', args: 'container', returns: 'void' },
    { name: 'mirror:fetch', desc: '拉取镜像前', args: 'url,version', returns: 'url' },
    { name: 'mirror:success', desc: '拉取镜像成功', args: 'url,html,version', returns: 'html' },
    { name: 'mirror:fail', desc: '拉取镜像失败', args: 'url,error,version', returns: 'void' }
  ];

  /* 常用事件名 */
  window.MCJS_EVENT_NAMES = [
    'app:ready', 'app:init',
    'launch:start', 'launch:progress', 'launch:complete', 'launch:failed', 'launch:cancel',
    'game:ready', 'game:close', 'game:error',
    'settings:change', 'settings:save',
    'plugin:install', 'plugin:uninstall', 'plugin:enable', 'plugin:disable',
    'mirror:select', 'version:select'
  ];
})();
