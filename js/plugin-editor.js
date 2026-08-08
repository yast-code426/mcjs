/* MCJS Plugin Editor v1.0
   - 插件编写器:在线编辑、保存、测试、导出
   - 模板系统
*/
(function() {
  'use strict';

  if (window.MCJS_PLUGIN_EDITOR) return;

  var _state = {
    currentFile: 'inject.js',
    files: {
      'main.js': '// 插件主逻辑(可选)\n// 大多数简单插件可以直接在 inject.js 写代码\nexport default function(api) {\n  console.log("[MyPlugin] Loaded");\n  return {};\n}\n',
      'inject.js': '// 此脚本会在游戏 iframe 加载前注入到游戏 HTML 的 <head> 中\n(function(){\n  console.log("[MyPlugin] Injected into game page");\n  // 你的游戏注入代码...\n})();\n',
      'style.css': '/* 此 CSS 会注入到游戏页面 */\n',
      'config.json': '{\n  "key": "value"\n}',
      'manifest.json': '{\n  "id": "user.my-plugin",\n  "name": "新插件",\n  "version": "1.0.0",\n  "author": "Anonymous",\n  "category": "utility",\n  "description": "",\n  "hooks": [],\n  "permissions": []\n}\n'
    },
    meta: {
      id: 'user.my-plugin',
      name: '新插件',
      version: '1.0.0',
      author: 'Anonymous',
      category: 'utility',
      description: '',
      hooks: [],
      permissions: []
    },
    _initialized: false
  };

  /* ===== Templates ===== */
  var TEMPLATES = {
    'inject-script': {
      meta: {
        name: '注入脚本示例',
        description: '通过 launch:html 钩子在游戏加载前注入 JavaScript',
        hooks: ['launch:html'],
        permissions: ['game.inject']
      },
      main: '// 插件入口 - 此文件可选,主要用于主逻辑\n// 大多数简单插件可以直接在 inject.js 写代码\nexport default function(api) {\n  console.log("[MyPlugin] Loaded");\n  return { onLaunch: () => {} };\n}\n',
      inject: '// 此脚本会在游戏 iframe 加载前注入到游戏 HTML 的 <head> 中\n(function(){\n  console.log("[MyPlugin] Injected into game page");\n  // 你的游戏注入代码...\n})();\n',
      style: '/* 此 CSS 会注入到游戏页面 */\n.my-plugin-marker { color: red; }\n',
      manifest: '{\n  "id": "my.inject-plugin",\n  "name": "我的注入插件",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "utility",\n  "description": "插件描述",\n  "hooks": ["launch:html"],\n  "permissions": ["game.inject"],\n  "code": ""\n}\n'
    },
    'inject-css': {
      meta: {
        name: '样式覆盖示例',
        description: '通过 launch:html 钩子注入自定义 CSS',
        hooks: ['launch:html'],
        permissions: ['game.modify']
      },
      main: '',
      inject: '// 此脚本会在 CSS 之后注入,可用于在加载后添加动态样式\n(function(){\n  var style = document.createElement("style");\n  style.textContent = MCJS_PLUGIN_CONFIG.css;\n  document.head.appendChild(style);\n})();\n',
      style: '/* 自定义游戏样式 */\n#game_frame canvas { image-rendering: pixelated; }\n',
      manifest: '{\n  "id": "my.style-plugin",\n  "name": "我的样式插件",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "appearance",\n  "description": "插件描述",\n  "hooks": ["launch:html"],\n  "permissions": ["game.modify"]\n}\n'
    },
    'modify-launch': {
      meta: {
        name: '修改启动参数',
        description: '在 launch:version 钩子中修改游戏启动参数',
        hooks: ['launch:version'],
        permissions: ['launch.override']
      },
      main: '// 此钩子返回的 version 对象会替换原 version\nexport default function(version) {\n  console.log("[MyPlugin] Modifying launch for", version.id);\n  // 示例:强制全屏启动\n  version.forceFullscreen = true;\n  return version;\n}\n',
      inject: '',
      style: '',
      manifest: '{\n  "id": "my.launch-mod",\n  "name": "启动参数修改",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "utility",\n  "description": "修改启动参数",\n  "hooks": ["launch:version"],\n  "permissions": ["launch.override"]\n}\n'
    },
    'patch-mirror': {
      meta: {
        name: '镜像列表修改',
        description: '通过 launch:mirrors 钩子添加/移除/排序镜像',
        hooks: ['launch:mirrors'],
        permissions: ['network.fetch']
      },
      main: 'export default function(mirrors, version) {\n  // 添加自定义镜像\n  mirrors.push({ name: "我的镜像", url: "https://my-mirror.example.com/" });\n  // 过滤掉不可用的镜像\n  return mirrors.filter(function(m) { return !m.url.includes("blocked.com"); });\n}\n',
      inject: '',
      style: '',
      manifest: '{\n  "id": "my.mirror-patch",\n  "name": "镜像管理",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "utility",\n  "description": "管理镜像列表",\n  "hooks": ["launch:mirrors"],\n  "permissions": ["network.fetch"]\n}\n'
    },
    'ui-extension': {
      meta: {
        name: 'UI 扩展示例',
        description: '在 app:render 钩子中扩展启动器界面',
        hooks: ['app:render'],
        permissions: ['ui.extend']
      },
      main: 'export default function(container) {\n  // 在版本卡片列表底部添加自定义面板\n  var panel = document.createElement("div");\n  panel.className = "my-plugin-panel";\n  panel.innerHTML = "<h3>我的插件面板</h3><p>这是由插件动态添加的内容</p>";\n  container.appendChild(panel);\n}\n',
      inject: '',
      style: '.my-plugin-panel { background: #22c55e; color: #fff; padding: 14px; border-radius: 8px; margin: 12px 0; }\n',
      manifest: '{\n  "id": "my.ui-extension",\n  "name": "UI 扩展",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "appearance",\n  "description": "扩展 UI",\n  "hooks": ["app:render"],\n  "permissions": ["ui.extend"]\n}\n'
    },
    'hook-event': {
      meta: {
        name: '事件钩子示例',
        description: '监听启动器事件,如 launch:start、game:close',
        hooks: [],
        permissions: ['system.info']
      },
      main: '// 通过 api.on() 监听事件\nexport default function(api) {\n  api.on("launch:start", function(payload) {\n    console.log("[MyPlugin] Game starting:", payload);\n  });\n  api.on("game:close", function() {\n    console.log("[MyPlugin] Game closed");\n  });\n  return {};\n}\n',
      inject: '',
      style: '',
      manifest: '{\n  "id": "my.event-hook",\n  "name": "事件监听",\n  "version": "1.0.0",\n  "author": "Your Name",\n  "category": "utility",\n  "description": "监听事件",\n  "hooks": [],\n  "permissions": ["system.info"]\n}\n'
    }
  };

  var PLUGIN_TEMPLATES_HOOKS = (window.MCJS_HOOK_POINTS || []).map(function(h) {
    return { id: h.name, name: h.name, desc: h.desc };
  });
  var PLUGIN_TEMPLATES_PERMS = [
    { id: 'storage.read', name: 'storage.read' },
    { id: 'storage.write', name: 'storage.write' },
    { id: 'network.fetch', name: 'network.fetch' },
    { id: 'game.inject', name: 'game.inject' },
    { id: 'game.modify', name: 'game.modify' },
    { id: 'launch.override', name: 'launch.override' },
    { id: 'ui.extend', name: 'ui.extend' },
    { id: 'plugins.manage', name: 'plugins.manage' },
    { id: 'system.info', name: 'system.info' },
    { id: 'audio.play', name: 'audio.play' }
  ];

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }
  function uid() {
    return 'user.' + Math.random().toString(36).slice(2, 10);
  }

  /* ===== UI Renderers ===== */
  function renderHookList() {
    var container = document.getElementById('hookList');
    if (!container) return;
    container.innerHTML = '';
    PLUGIN_TEMPLATES_HOOKS.forEach(function(h) {
      var checked = _state.meta.hooks.indexOf(h.id) !== -1;
      var item = el(
        '<label class="hook-item">' +
          '<input type="checkbox" ' + (checked ? 'checked' : '') + ' value="' + escapeHtml(h.id) + '">' +
          '<span>' + escapeHtml(h.id) + '</span>' +
          '<small title="' + escapeHtml(h.desc) + '">' + escapeHtml((h.desc || '').slice(0, 18)) + '</small>' +
        '</label>'
      );
      item.querySelector('input').addEventListener('change', function(e) {
        if (e.target.checked) {
          if (_state.meta.hooks.indexOf(h.id) === -1) _state.meta.hooks.push(h.id);
        } else {
          _state.meta.hooks = _state.meta.hooks.filter(function(x) { return x !== h.id; });
        }
      });
      container.appendChild(item);
    });
  }
  function renderPermissionList() {
    var container = document.getElementById('permissionList');
    if (!container) return;
    container.innerHTML = '';
    PLUGIN_TEMPLATES_PERMS.forEach(function(p) {
      var checked = _state.meta.permissions.indexOf(p.id) !== -1;
      var item = el(
        '<label class="permission-item">' +
          '<input type="checkbox" ' + (checked ? 'checked' : '') + ' value="' + escapeHtml(p.id) + '">' +
          '<span>' + escapeHtml(p.id) + '</span>' +
        '</label>'
      );
      item.querySelector('input').addEventListener('change', function(e) {
        if (e.target.checked) {
          if (_state.meta.permissions.indexOf(p.id) === -1) _state.meta.permissions.push(p.id);
        } else {
          _state.meta.permissions = _state.meta.permissions.filter(function(x) { return x !== p.id; });
        }
      });
      container.appendChild(item);
    });
  }

  function switchFile(name) {
    _state.currentFile = name;
    var editor = document.getElementById('pluginCodeEditor');
    if (editor) editor.value = _state.files[name] || '';
    var tabs = document.querySelectorAll('.editor-tab');
    tabs.forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-file') === name);
    });
    if (typeof applyHighlight === 'function') applyHighlight();
  }

  function saveCurrentFile() {
    var editor = document.getElementById('pluginCodeEditor');
    if (editor) _state.files[_state.currentFile] = editor.value;
  }

  function applyTemplate(name) {
    var t = TEMPLATES[name];
    if (!t) return;
    _state.files = {
      'main.js': t.main,
      'inject.js': t.inject,
      'style.css': t.style,
      'config.json': '{\n  "key": "value"\n}',
      'manifest.json': t.manifest
    };
    _state.meta.name = t.meta.name;
    _state.meta.description = t.meta.description;
    _state.meta.hooks = t.meta.hooks.slice();
    _state.meta.permissions = t.meta.permissions.slice();
    _state.meta.id = 'user.' + name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    syncMetaToUI();
    renderHookList();
    renderPermissionList();
    switchFile('inject.js');
    _state._dirty = false;
    if (window.MCJS_TOAST) window.MCJS_TOAST('已应用模板: ' + name, 'success');
  }

  function syncMetaToUI() {
    document.getElementById('pluginMetaName').value = _state.meta.name;
    document.getElementById('pluginMetaVersion').value = _state.meta.version;
    document.getElementById('pluginMetaAuthor').value = _state.meta.author;
    document.getElementById('pluginMetaCategory').value = _state.meta.category;
    document.getElementById('pluginMetaDescription').value = _state.meta.description;
  }

  function syncMetaFromUI() {
    _state.meta.name = document.getElementById('pluginMetaName').value || '未命名插件';
    _state.meta.version = document.getElementById('pluginMetaVersion').value || '1.0.0';
    _state.meta.author = document.getElementById('pluginMetaAuthor').value || 'Anonymous';
    _state.meta.category = document.getElementById('pluginMetaCategory').value || 'utility';
    _state.meta.description = document.getElementById('pluginMetaDescription').value || '';
  }

  function newPlugin() {
    if (!confirm('新建插件将清空当前编辑器,是否继续?')) return;
    _state.files = {
      'main.js': '// 你的插件主逻辑\nexport default function(api) {\n  console.log("[MyPlugin] Loaded");\n  return {};\n}\n',
      'inject.js': '// 注入到游戏页面的脚本(function(){\n  console.log("[MyPlugin] Injected");\n})();\n',
      'style.css': '/* 注入到游戏页面的 CSS */\n',
      'config.json': '{\n  "key": "value"\n}',
      'manifest.json': '{\n  "id": "user.my-plugin",\n  "name": "新插件",\n  "version": "1.0.0",\n  "author": "Anonymous",\n  "category": "utility",\n  "description": "",\n  "hooks": [],\n  "permissions": []\n}\n'
    };
    _state.meta = { id: 'user.my-plugin', name: '新插件', version: '1.0.0', author: '', category: 'utility', description: '', hooks: [], permissions: [] };
    syncMetaToUI();
    renderHookList();
    renderPermissionList();
    switchFile('main.js');
    _state._dirty = false;
    document.getElementById('pluginEditorTitle').textContent = '插件编写器 - 新建';
    if (window.MCJS_TOAST) window.MCJS_TOAST('已创建空白插件', 'success');
  }

  function savePlugin() {
    saveCurrentFile();
    syncMetaFromUI();
    if (!_state.meta.name) { if (window.MCJS_TOAST) window.MCJS_TOAST('请填写插件名称', 'error'); return; }
    if (!_state.meta.hooks.length) { if (window.MCJS_TOAST) window.MCJS_TOAST('请至少选择一个 Hook 点', 'error'); return; }
    _state._dirty = false;

    // 构建插件 manifest
    var manifest = {
      id: _state.meta.id || ('user.' + _state.meta.name.toLowerCase().replace(/[^a-z0-9]/g, '-')),
      name: _state.meta.name,
      version: _state.meta.version,
      author: _state.meta.author,
      category: _state.meta.category,
      description: _state.meta.description,
      hooks: _state.meta.hooks,
      permissions: _state.meta.permissions,
      source: 'user',
      icon: '🧩',
      files: {
        'main.js': _state.files['main.js'],
        'inject.js': _state.files['inject.js'],
        'style.css': _state.files['style.css'],
        'config.json': _state.files['config.json']
      },
      // 运行时入口:对于简单插件,直接使用 inject.js 的代码
      code: _state.files['inject.js'] || _state.files['main.js'],
      // 简单 builtin 函数:在 launch:html 时把 code 注入游戏
      builtin: generateBuiltinCode(),
      installedAt: Date.now()
    };

    try {
      window.MCJS_REGISTRY.install(manifest);
      window.MCJS_REGISTRY.enable(manifest.id);
      if (window.MCJS_TOAST) window.MCJS_TOAST('插件已保存并启用: ' + manifest.name, 'success');
      document.getElementById('pluginEditorTitle').textContent = '插件编写器 - ' + manifest.name;
      if (window.MCJS_PLUGIN_MARKET) window.MCJS_PLUGIN_MARKET.refresh();
    } catch (e) {
      if (window.MCJS_TOAST) window.MCJS_TOAST('保存失败: ' + e.message, 'error');
    }
  }

  function generateBuiltinCode() {
    // 返回一个简单 builtin,会在 launch:html 钩子中把 code 注入游戏
    return function() {
      return {
        inject: function() {
          return {
            type: 'js',
            content: _state.files['inject.js'] || _state.files['main.js'] || ''
          };
        }
      };
    };
  }

  function testPlugin() {
    saveCurrentFile();
    var editor = document.getElementById('pluginCodeEditor');
    var output = document.getElementById('pluginTestOutput');
    var code = editor.value;

    output.textContent = '';
    function log(msg, type) {
      var line = document.createElement('div');
      line.textContent = (type ? '[' + type + '] ' : '') + msg;
      line.style.color = type === 'error' ? '#ef4444' : (type === 'warn' ? '#f59e0b' : '#22c55e');
      output.appendChild(line);
    }
    log('开始测试...', 'info');

    if (_state.currentFile === 'manifest.json' || _state.currentFile === 'config.json') {
      try {
        JSON.parse(code);
        log('JSON 格式正确 ✓', 'info');
      } catch (e) {
        log('JSON 解析错误: ' + e.message, 'error');
      }
      return;
    }

    if (_state.currentFile === 'style.css') {
      // 简单 CSS 验证:匹配花括号
      var opens = (code.match(/{/g) || []).length;
      var closes = (code.match(/}/g) || []).length;
      if (opens === closes) {
        log('CSS 括号匹配 ✓ (' + opens + ' 对花括号)', 'info');
      } else {
        log('CSS 括号不匹配!开: ' + opens + ', 闭: ' + closes, 'error');
      }
      return;
    }

    // JS 语法检查(使用 Function 构造器)
    try {
      new Function(code);
      log('JavaScript 语法正确 ✓', 'info');
      // 检查常见 API
      if (code.indexOf('MCJS_PLUGIN_API') !== -1) {
        log('检测到 MCJS_PLUGIN_API 调用 - 插件将使用插件 API', 'info');
      }
      if (code.indexOf('addEventListener') !== -1) {
        log('检测到事件监听 - 确认目标元素存在', 'warn');
      }
      log('测试完成。可以保存并启用了。', 'info');
    } catch (e) {
      log('语法错误: ' + e.message, 'error');
    }
  }

  function formatCode() {
    var editor = document.getElementById('pluginCodeEditor');
    var code = editor.value;
    if (_state.currentFile === 'manifest.json' || _state.currentFile === 'config.json') {
      try {
        var obj = JSON.parse(code);
        editor.value = JSON.stringify(obj, null, 2);
        saveCurrentFile();
        if (window.MCJS_TOAST) window.MCJS_TOAST('JSON 已格式化', 'success');
      } catch (e) {
        if (window.MCJS_TOAST) window.MCJS_TOAST('JSON 错误: ' + e.message, 'error');
      }
      return;
    }
    // 简单 JS 格式化(基于缩进)
    var lines = code.split('\n');
    var out = [];
    var indent = 0;
    lines.forEach(function(raw) {
      var line = raw.trim();
      if (!line) { out.push(''); return; }
      if (/^[\}\]\)]/.test(line)) indent = Math.max(0, indent - 1);
      out.push('  '.repeat(indent) + line);
      var opens = (line.match(/[\{\[\(]/g) || []).length;
      var closes = (line.match(/[\}\]\)]/g) || []).length;
      indent += opens - closes;
      if (indent < 0) indent = 0;
    });
    editor.value = out.join('\n');
    saveCurrentFile();
    if (window.MCJS_TOAST) window.MCJS_TOAST('代码已格式化', 'success');
  }

  function exportPlugin() {
    saveCurrentFile();
    syncMetaFromUI();
    var manifest = {
      id: _state.meta.id || ('user.' + _state.meta.name.toLowerCase().replace(/[^a-z0-9]/g, '-')),
      name: _state.meta.name,
      version: _state.meta.version,
      author: _state.meta.author,
      category: _state.meta.category,
      description: _state.meta.description,
      hooks: _state.meta.hooks,
      permissions: _state.meta.permissions,
      source: 'user',
      icon: '🧩',
      files: {
        'main.js': _state.files['main.js'],
        'inject.js': _state.files['inject.js'],
        'style.css': _state.files['style.css'],
        'config.json': _state.files['config.json']
      }
    };
    var json = JSON.stringify(manifest, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (manifest.id || 'plugin') + '.mcjs-plugin.json';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    if (window.MCJS_TOAST) window.MCJS_TOAST('插件已导出', 'success');
  }

  function open() {
    var modal = document.getElementById('pluginEditorModal');
    if (!modal) return;
    syncMetaToUI();
    renderHookList();
    renderPermissionList();
    switchFile(_state.currentFile);
    modal.classList.add('active');
    _state._dirty = false;
    setTimeout(applyHighlight, 0);
  }
  function close(force) {
    var modal = document.getElementById('pluginEditorModal');
    if (!modal) return;
    if (!force && _state._dirty) {
      var ok = window.confirm('有未保存的修改,确定要关闭插件编写器吗?\n\n点击「确定」放弃修改并关闭\n点击「取消」返回继续编辑');
      if (!ok) return;
    }
    modal.classList.remove('active');
    _state._dirty = false;
  }

  function bindEvents() {
    var modal = document.getElementById('pluginEditorModal');
    if (!modal) return;

    document.getElementById('pluginEditorClose').addEventListener('click', function(){ close(); });
    // 不再监听 modal 自身 click 关闭(避免点击空白退出)

    // 委托音效
    modal.addEventListener('click', function(e){
      try { if (window.MCJS && window.MCJS.sound) window.MCJS.sound.click(); } catch(_){}
    });
    modal.addEventListener('mouseover', function(e){
      try {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('button, .editor-tab, .plugin-btn, select, input, [role="button"]')) {
          if (window.MCJS && window.MCJS.sound) window.MCJS.sound.hover();
        }
      } catch(_){}
    });

    var tabs = modal.querySelectorAll('.editor-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        saveCurrentFile();
        switchFile(tab.getAttribute('data-file'));
      });
    });

    var editor = document.getElementById('pluginCodeEditor');
    if (editor) {
      editor.addEventListener('input', function() {
        _state.files[_state.currentFile] = editor.value;
        _state._dirty = true;
        applyHighlight();
      });
      // Tab 键支持
      editor.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var start = editor.selectionStart;
          var end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
          _state.files[_state.currentFile] = editor.value;
          _state._dirty = true;
          applyHighlight();
        }
      });
      // 同步滚动高亮
      editor.addEventListener('scroll', function(){
        var hl = document.getElementById('pluginCodeHighlight');
        if (hl) { hl.scrollTop = editor.scrollTop; hl.scrollLeft = editor.scrollLeft; }
      });
    }

    document.getElementById('newPluginBtn').addEventListener('click', newPlugin);
    document.getElementById('savePluginBtn').addEventListener('click', savePlugin);
    document.getElementById('testPluginBtn').addEventListener('click', testPlugin);
    document.getElementById('formatPluginBtn').addEventListener('click', formatCode);
    document.getElementById('exportPluginBtn').addEventListener('click', exportPlugin);
    document.getElementById('applyTemplateBtn').addEventListener('click', function() {
      var sel = document.getElementById('pluginTemplate');
      if (sel.value) applyTemplate(sel.value);
    });

    // ESC 关闭(也走 dirty 检查)
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        e.preventDefault();
        close();
      }
    });
  }

  /* ===== 代码高亮 (极简) ===== */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function highlight(code, lang) {
    // 极简语法高亮:不引外部库,基于正则
    // 1. 转义
    var html = escapeHtml(code);
    // 2. 注释
    if (lang === 'css') {
      html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-c">$1</span>');
    } else if (lang === 'json') {
      html = html.replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="hl-k">$1</span>$2');
      html = html.replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="hl-s">$1</span>');
      html = html.replace(/\b(true|false|null)\b/g, '<span class="hl-b">$1</span>');
    } else {
      // js
      html = html.replace(/(\/\/[^\n]*)/g, '<span class="hl-c">$1</span>');
      html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-c">$1</span>');
      html = html.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, '<span class="hl-s">$1</span>');
      html = html.replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|super|this|null|undefined|true|false|try|catch|finally|throw|async|await|yield|import|export|from|as|default|void)\b/g, '<span class="hl-k">$1</span>');
      html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-n">$1</span>');
    }
    return html;
  }
  function applyHighlight() {
    var editor = document.getElementById('pluginCodeEditor');
    var hl = document.getElementById('pluginCodeHighlight');
    if (!editor || !hl) return;
    var lang = _state.currentFile.endsWith('.css') ? 'css'
             : _state.currentFile.endsWith('.json') ? 'json' : 'js';
    hl.className = 'plugin-code-highlight lang-' + lang;
    hl.innerHTML = highlight(editor.value, lang) + '\n';
  }

  window.MCJS_PLUGIN_EDITOR = {
    open: open,
    close: close,
    newPlugin: newPlugin,
    savePlugin: savePlugin,
    testPlugin: testPlugin,
    exportPlugin: exportPlugin
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    setTimeout(bindEvents, 0);
  }
})();
