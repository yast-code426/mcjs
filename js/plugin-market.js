/* MCJS Plugin Market UI v1.0
   - 插件市场前端逻辑
   - 浏览/安装/卸载/启用/禁用
   - 文档显示
*/
(function() {
  'use strict';

  if (window.MCJS_PLUGIN_MARKET) return;

  var Registry = window.MCJS_REGISTRY;
  var API = window.MCJS_PLUGIN_API;

  var _state = {
    searchQuery: '',
    activeCategory: 'all',
    activeTab: 'browse',
    activeRemoteId: null,        // 当前远程仓库 id(null = 内置+已安装)
    remoteCatalog: {},           // remoteId -> { plugins: [], cachedAt }
    loadingRemote: false
  };

  /* ===== Helpers ===== */
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }
  function categoryLabel(cat) {
    return ({
      compatibility: '兼容性',
      performance: '性能',
      appearance: '外观',
      utility: '工具',
      language: '语言',
      custom: '自定义'
    })[cat] || cat;
  }
  function categoryTag(cat) {
    // 纯文字标签(无 emoji),适配深浅主题
    return ({
      compatibility: 'COMPAT',
      performance: 'PERF',
      appearance: 'STYLE',
      utility: 'UTIL',
      language: 'I18N',
      custom: 'CUSTOM'
    })[cat] || 'PLUGIN';
  }
  function fmtDownloads(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  /* ===== Render: Plugin Card ===== */
  function renderPluginCard(plugin) {
    var installed = Registry.isInstalled(plugin.id);
    var enabled = Registry.isEnabled(plugin.id);
    var card = el(
      '<div class="plugin-card" data-id="' + escapeHtml(plugin.id) + '">' +
        '<div class="plugin-card-header">' +
          '<div class="plugin-icon ' + escapeHtml(plugin.category) + '">' + categoryTag(plugin.category) + '</div>' +
          '<div class="plugin-info">' +
            '<div class="plugin-name">' + escapeHtml(plugin.name) +
              '<span class="plugin-version-badge">v' + escapeHtml(plugin.version) + '</span>' +
              (plugin.official ? ' <span class="plugin-tag-official">官方</span>' : '') +
              (plugin.source === 'user' ? ' <span class="plugin-tag-unofficial">第三方</span>' : '') +
              (enabled ? ' <span class="plugin-tag-installed">已启用</span>' : '') +
            '</div>' +
            '<div class="plugin-author">by ' + escapeHtml(plugin.author) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="plugin-desc">' + escapeHtml(plugin.description) + '</div>' +
        '<div class="plugin-meta">' +
          '<span class="plugin-meta-item">' + categoryLabel(plugin.category) + '</span>' +
          (plugin.downloads !== undefined ? '<span class="plugin-meta-item">' + fmtDownloads(plugin.downloads) + ' 次下载</span>' : '') +
        '</div>' +
        '<div class="plugin-actions">' +
          (plugin.source === 'official' ? (
            enabled
              ? '<button class="plugin-btn small danger" data-act="disable">禁用</button>'
              : '<button class="plugin-btn small primary" data-act="enable">启用</button>'
          ) : (
            installed
              ? '<button class="plugin-btn small" data-act="disable">' + (enabled ? '禁用' : '已安装') + '</button>' +
                '<button class="plugin-btn small danger" data-act="uninstall">卸载</button>'
              : '<button class="plugin-btn small primary" data-act="install">安装</button>'
          )) +
          '<button class="plugin-btn small" data-act="details">详情</button>' +
        '</div>' +
      '</div>'
    );
    var actions = card.querySelectorAll('.plugin-actions [data-act]');
    actions.forEach(function(btn) {
      var act = btn.getAttribute('data-act');
      btn.addEventListener('click', function() {
        handlePluginAction(plugin, act, btn);
      });
    });
    return card;
  }

  function handlePluginAction(plugin, act, btn) {
    try {
      if (act === 'enable') {
        Registry.enable(plugin.id);
        if (window.MCJS_TOAST) window.MCJS_TOAST('已启用: ' + plugin.name, 'success');
        renderAll();
      } else if (act === 'disable') {
        Registry.disable(plugin.id);
        if (window.MCJS_TOAST) window.MCJS_TOAST('已禁用: ' + plugin.name, 'info');
        renderAll();
      } else if (act === 'install') {
        Registry.install(plugin);
        if (window.MCJS_TOAST) window.MCJS_TOAST('已安装: ' + plugin.name, 'success');
        Registry.enable(plugin.id);
        renderAll();
      } else if (act === 'uninstall') {
        if (!confirm('确定卸载 "' + plugin.name + '" 吗?\n该插件的设置和数据将一并清除。')) return;
        Registry.uninstall(plugin.id);
        API.storage.clear(plugin.id);
        if (window.MCJS_TOAST) window.MCJS_TOAST('已卸载: ' + plugin.name, 'info');
        renderAll();
      } else if (act === 'details') {
        showPluginDetails(plugin);
      }
    } catch (e) {
      console.error(e);
      if (window.MCJS_TOAST) window.MCJS_TOAST('操作失败: ' + e.message, 'error');
    }
  }

  function showPluginDetails(plugin) {
    var perms = (plugin.permissions || []).map(function(p) {
      return '<li><code>' + escapeHtml(p) + '</code> - ' + escapeHtml(API.PERMS[p] || '未知权限') + '</li>';
    }).join('');
    var hooks = (plugin.hooks || []).map(function(h) {
      var desc = (window.MCJS_HOOK_POINTS.find(function(x) { return x.name === h; }) || {}).desc || '';
      return '<li><code>' + escapeHtml(h) + '</code>' + (desc ? ' - ' + escapeHtml(desc) : '') + '</li>';
    }).join('');

    var modal = el(
      '<div class="modal-overlay active" id="pluginDetailsModal">' +
        '<div class="modal" style="max-width:600px;">' +
          '<div class="modal-header">' +
            '<h2>' + escapeHtml(plugin.name) + '</h2>' +
            '<button class="modal-close" aria-label="关闭">×</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p style="margin-bottom:8px;color:var(--text-secondary);">' + escapeHtml(plugin.longDescription || plugin.description) + '</p>' +
            '<div class="plugin-docs" style="margin-top:14px;">' +
              '<h3>基本信息</h3>' +
              '<p>版本: <code>' + escapeHtml(plugin.version) + '</code><br>' +
              '作者: ' + escapeHtml(plugin.author) + '<br>' +
              '分类: ' + categoryLabel(plugin.category) + '<br>' +
              (plugin.source ? '来源: ' + escapeHtml(plugin.source) + '<br>' : '') +
              (plugin.downloads !== undefined ? '下载量: ' + fmtDownloads(plugin.downloads) : '') +
              '</p>' +
              (perms ? '<h3>所需权限</h3><ul>' + perms + '</ul>' : '') +
              (hooks ? '<h3>监听钩子</h3><ul>' + hooks + '</ul>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
  }

  /* ===== Render: Browse Pane ===== */
  function renderBrowsePane() {
    var listEl = document.getElementById('pluginList');
    if (!listEl) return;
    listEl.innerHTML = '';
    var plugins = Registry.list();
    var q = _state.searchQuery.toLowerCase().trim();
    var filtered = plugins.filter(function(p) {
      if (_state.activeCategory !== 'all' && p.category !== _state.activeCategory) return false;
      if (q && (p.name.toLowerCase().indexOf(q) === -1 && (p.description || '').toLowerCase().indexOf(q) === -1 && (p.author || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>没有找到匹配的插件</p></div>';
      return;
    }
    filtered.forEach(function(p) {
      listEl.appendChild(renderPluginCard(p));
    });
  }

  function renderInstalledPane() {
    var listEl = document.getElementById('installedPluginList');
    if (!listEl) return;
    listEl.innerHTML = '';
    var plugins = Registry.list().filter(function(p) {
      return Registry.isEnabled(p.id);
    });
    if (plugins.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">' +
        '<p>还没有启用任何插件</p>' +
        '<p style="margin-top:8px;font-size:0.85rem;">前往"浏览"标签安装并启用插件</p>' +
        '</div>';
      return;
    }
    plugins.forEach(function(p) {
      listEl.appendChild(renderPluginCard(p));
    });
  }

  function renderUpdatesPane() {
    var listEl = document.getElementById('updatesPluginList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="empty-state"><p>点击"检查更新"以查看可用更新</p></div>';
    listEl.innerHTML +=
      '<div style="text-align:center;margin-top:12px;">' +
      '<button class="plugin-btn small primary" id="checkUpdatesBtn">检查所有更新</button>' +
      '</div>';
    var btn = document.getElementById('checkUpdatesBtn');
    if (btn) {
      btn.addEventListener('click', function() { checkAllUpdatesUI(); });
    }
  }

  function checkAllUpdatesUI() {
    if (window.MCJS_TOAST) window.MCJS_TOAST('正在检查所有更新...', 'info');
    Registry.checkAllUpdates().then(function(updates) {
      var listEl = document.getElementById('updatesPluginList');
      if (!listEl) return;
      if (!updates || updates.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state">' +
          '<p>所有插件均为最新版本</p>' +
          '<p style="margin-top:8px;font-size:0.85rem;">启动器 v3.0 · 插件市场版本 1.0</p>' +
          '</div>';
        if (window.MCJS_TOAST) window.MCJS_TOAST('所有插件已是最新', 'success');
        return;
      }
      listEl.innerHTML = '<div style="margin-bottom:12px;color:var(--text-secondary);font-size:0.88rem;">发现 ' + updates.length + ' 个可更新插件:</div>';
      updates.forEach(function(u) {
        var card = el(
          '<div class="plugin-card" data-id="' + escapeHtml(u.id) + '">' +
            '<div class="plugin-card-header">' +
              '<div class="plugin-info">' +
                '<div class="plugin-name">' + escapeHtml(u.name) +
                  '<span class="plugin-version-badge">v' + escapeHtml(u.current) + ' → v' + escapeHtml(u.latest) + '</span>' +
                '</div>' +
                '<div class="plugin-author">更新可用</div>' +
              '</div>' +
            '</div>' +
            '<div class="plugin-actions">' +
              '<button class="plugin-btn small primary" data-act="update">更新</button>' +
            '</div>' +
          '</div>'
        );
        card.querySelector('[data-act="update"]').addEventListener('click', function() {
          if (window.MCJS_TOAST) window.MCJS_TOAST('正在更新 ' + u.name + '...', 'info');
          Registry.update(u.id).then(function() {
            if (window.MCJS_TOAST) window.MCJS_TOAST(u.name + ' 已更新到 v' + u.latest, 'success');
            renderAll();
          }).catch(function(e) {
            if (window.MCJS_TOAST) window.MCJS_TOAST('更新失败: ' + e.message, 'error');
          });
        });
        listEl.appendChild(card);
      });
    }).catch(function(e) {
      if (window.MCJS_TOAST) window.MCJS_TOAST('检查更新失败: ' + e.message, 'error');
    });
  }

  /* ===== Remote Marketplace Tab ===== */
  function renderRemotePane() {
    var listEl = document.getElementById('remotePluginList');
    if (!listEl) return;
    listEl.innerHTML = '';

    // 渲染仓库源选择器
    var sourceContainer = document.getElementById('remoteSourceSelector');
    if (sourceContainer) {
      sourceContainer.innerHTML = '';
      var remotes = Registry.remotes.list();
      remotes.forEach(function(r) {
        var isActive = (_state.activeRemoteId || remotes[0].id) === r.id;
        var chip = el(
          '<button class="plugin-chip ' + (isActive ? 'active' : '') + '" data-remote="' + escapeHtml(r.id) + '">' +
            escapeHtml(r.name) +
            (r.builtin ? ' <small>·内置</small>' : '') +
          '</button>'
        );
        chip.addEventListener('click', function() {
          _state.activeRemoteId = r.id;
          renderRemotePane();
        });
        sourceContainer.appendChild(chip);
      });
      // "+ 添加仓库" 按钮
      var addBtn = el('<button class="plugin-chip" id="addRemoteBtn">添加仓库</button>');
      addBtn.addEventListener('click', showAddRemoteDialog);
      sourceContainer.appendChild(addBtn);
    }

    // 加载并渲染当前选中的仓库
    var activeId = _state.activeRemoteId || (Registry.remotes.list()[0] || {}).id;
    if (!activeId) {
      listEl.innerHTML = '<div class="empty-state"><p>未配置任何远程仓库</p></div>';
      return;
    }
    _state.activeRemoteId = activeId;
    var cat = _state.remoteCatalog[activeId];
    if (!cat) {
      listEl.innerHTML = '<div class="empty-state"><p>正在加载 ' + escapeHtml(activeId) + '...</p></div>';
      loadRemoteCatalog(activeId);
      return;
    }
    if (!cat.plugins || cat.plugins.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">' +
        '<p>此仓库暂无可用插件</p>' +
        '<p style="margin-top:8px;font-size:0.85rem;">' + escapeHtml(cat.error || '') + '</p>' +
        '<button class="plugin-btn small" id="retryRemoteBtn" style="margin-top:12px;">重试</button>' +
        '</div>';
      var retry = document.getElementById('retryRemoteBtn');
      if (retry) retry.addEventListener('click', function() {
        delete _state.remoteCatalog[activeId];
        loadRemoteCatalog(activeId);
      });
      return;
    }
    listEl.innerHTML = '';
    var q = _state.searchQuery.toLowerCase().trim();
    var filtered = cat.plugins.filter(function(p) {
      if (_state.activeCategory !== 'all' && p.category !== _state.activeCategory) return false;
      if (q && (p.name.toLowerCase().indexOf(q) === -1 && (p.description || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>没有匹配的远程插件</p></div>';
      return;
    }
    filtered.forEach(function(p) {
      listEl.appendChild(renderRemotePluginCard(p, activeId));
    });
  }

  function renderRemotePluginCard(p, remoteId) {
    var installed = Registry.isInstalled(p.id);
    var card = el(
      '<div class="plugin-card" data-id="' + escapeHtml(p.id) + '">' +
        '<div class="plugin-card-header">' +
          '<div class="plugin-icon ' + escapeHtml(p.category || 'utility') + '">' + categoryTag(p.category) + '</div>' +
          '<div class="plugin-info">' +
            '<div class="plugin-name">' + escapeHtml(p.name) +
              '<span class="plugin-version-badge">v' + escapeHtml(p.version || '?') + '</span>' +
              '<span class="plugin-tag-unofficial">远程</span>' +
              (installed ? ' <span class="plugin-tag-installed">已安装</span>' : '') +
            '</div>' +
            '<div class="plugin-author">by ' + escapeHtml(p.author || '匿名') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="plugin-desc">' + escapeHtml(p.description || '') + '</div>' +
        '<div class="plugin-actions">' +
          (installed
            ? '<button class="plugin-btn small" data-act="updateRemote">更新</button>'
            : '<button class="plugin-btn small primary" data-act="installRemote">安装</button>'
          ) +
          '<button class="plugin-btn small" data-act="details">详情</button>' +
        '</div>' +
      '</div>'
    );
    card.querySelectorAll('.plugin-actions [data-act]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var act = btn.getAttribute('data-act');
        if (act === 'installRemote' || act === 'updateRemote') {
          if (window.MCJS_TOAST) window.MCJS_TOAST('正在从远程安装 ' + p.name + '...', 'info');
          // 从 catalog 找完整条目(包含 url)
          var cat = _state.remoteCatalog[remoteId];
          var fullEntry = (cat && cat.plugins || []).find(function(x) { return x.id === p.id; }) || p;
          Registry.installRemote(remoteId, fullEntry).then(function(installed) {
            if (window.MCJS_TOAST) window.MCJS_TOAST('已安装: ' + p.name, 'success');
            renderAll();
          }).catch(function(e) {
            if (window.MCJS_TOAST) window.MCJS_TOAST('安装失败: ' + e.message, 'error');
          });
        } else if (act === 'details') {
          showPluginDetails(p);
        }
      });
    });
    return card;
  }

  function loadRemoteCatalog(remoteId) {
    _state.loadingRemote = true;
    Registry.remotes.refreshCatalog(remoteId).then(function(cat) {
      _state.remoteCatalog[remoteId] = { plugins: cat.plugins, cachedAt: Date.now() };
      _state.loadingRemote = false;
      if (_state.activeTab === 'remote') renderRemotePane();
    }).catch(function(e) {
      _state.loadingRemote = false;
      _state.remoteCatalog[remoteId] = { plugins: [], error: e.message };
      if (_state.activeTab === 'remote') renderRemotePane();
    });
  }

  function showAddRemoteDialog() {
    var url = prompt('远程仓库 URL(JSON manifest 地址):');
    if (!url) return;
    var name = prompt('仓库名称:', '我的仓库');
    if (!name) return;
    var id = 'custom-' + Date.now().toString(36);
    try {
      Registry.remotes.add({
        id: id,
        name: name,
        url: url.trim(),
        trust: 'untrusted',
        description: '用户添加的远程仓库'
      });
      if (window.MCJS_TOAST) window.MCJS_TOAST('已添加仓库: ' + name, 'success');
      _state.activeRemoteId = id;
      renderRemotePane();
    } catch (e) {
      if (window.MCJS_TOAST) window.MCJS_TOAST('添加失败: ' + e.message, 'error');
    }
  }

  /* ===== URL Import ===== */
  function importFromURL(url) {
    if (window.MCJS_TOAST) window.MCJS_TOAST('正在从 URL 加载: ' + url, 'info');
    Registry.importFromURL(url).then(function(result) {
      if (!result.plugins.length) {
        if (window.MCJS_TOAST) window.MCJS_TOAST('URL 中没有找到插件', 'warning');
        return;
      }
      // 弹出让用户选择要安装哪些
      showURLImportPicker(result);
    }).catch(function(e) {
      if (window.MCJS_TOAST) window.MCJS_TOAST('加载失败: ' + e.message, 'error');
    });
  }

  function showURLImportPicker(result) {
    var list = result.plugins.map(function(p) {
      return '<label class="import-pick-item">' +
        '<input type="checkbox" checked data-pick-id="' + escapeHtml(p.id) + '">' +
        '<strong>' + escapeHtml(p.name || p.id) + '</strong>' +
        ' <span class="plugin-version-badge">v' + escapeHtml(p.version || '?') + '</span>' +
        (p.signature ? ' <span class="plugin-tag-unofficial">已签名</span>' : '') +
        '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' +
          escapeHtml(p.description || '') +
        '</div>' +
        '</label>';
    }).join('');

    var modal = el(
      '<div class="modal-overlay active" id="urlImportModal">' +
        '<div class="modal" style="max-width:560px;">' +
          '<div class="modal-header">' +
            '<h2>从 URL 导入</h2>' +
            '<button class="modal-close">×</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">来源: <code style="word-break:break-all;">' + escapeHtml(result.url) + '</code></p>' +
            '<p style="margin-bottom:10px;">共找到 <strong>' + result.plugins.length + '</strong> 个插件,选择要安装的:</p>' +
            '<div class="import-pick-list">' + list + '</div>' +
            '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">' +
              '<button class="plugin-btn" id="cancelImportBtn">取消</button>' +
              '<button class="plugin-btn primary" id="confirmImportBtn">安装所选</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('#cancelImportBtn').addEventListener('click', close);
    modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
    modal.querySelector('#confirmImportBtn').addEventListener('click', function() {
      var checked = modal.querySelectorAll('input[data-pick-id]:checked');
      var picked = {};
      checked.forEach(function(c) { picked[c.getAttribute('data-pick-id')] = true; });
      var chosen = result.plugins.filter(function(p) { return picked[p.id]; });
      if (!chosen.length) { if (window.MCJS_TOAST) window.MCJS_TOAST('未选择任何插件', 'warning'); return; }
      close();
      installPluginsSequential(chosen, result.url);
    });
  }

  function installPluginsSequential(plugins, sourceUrl) {
    var done = 0, fail = 0;
    function next() {
      if (!plugins.length) {
        if (window.MCJS_TOAST) window.MCJS_TOAST('导入完成: ' + done + ' 成功, ' + fail + ' 失败', done ? 'success' : 'warning');
        renderAll();
        return;
      }
      var p = plugins.shift();
      // 用一个临时 remote id 来走 installRemote 流程
      var tempRemoteId = 'url-import-' + Date.now().toString(36);
      // 把 source url 注入到条目里
      var entry = Object.assign({}, p, { url: sourceUrl });
      Registry.installRemote(tempRemoteId, entry).then(function() {
        done++;
        next();
      }).catch(function(e) {
        fail++;
        console.warn('[MCJS] Import fail', p.id, e);
        if (window.MCJS_TOAST) window.MCJS_TOAST('失败: ' + p.name + ' - ' + e.message, 'error');
        next();
      });
    }
    next();
  }

  function renderCategories() {
    var container = document.getElementById('pluginCategories');
    if (!container) return;
    var cats = [
      { id: 'all', label: '全部' },
      { id: 'compatibility', label: '兼容性' },
      { id: 'performance', label: '性能' },
      { id: 'language', label: '语言' },
      { id: 'utility', label: '工具' },
      { id: 'appearance', label: '外观' },
      { id: 'custom', label: '自定义' }
    ];
    container.innerHTML = '';
    cats.forEach(function(c) {
      var chip = el(
        '<button class="plugin-chip ' + (_state.activeCategory === c.id ? 'active' : '') + '" data-cat="' + c.id + '">' +
        c.label + '</button>'
      );
      chip.addEventListener('click', function() {
        _state.activeCategory = c.id;
        renderCategories();
        renderBrowsePane();
      });
      container.appendChild(chip);
    });
  }

  function renderActivePane() {
    if (_state.activeTab === 'browse') {
      renderBrowsePane();
    } else if (_state.activeTab === 'installed') {
      renderInstalledPane();
    } else if (_state.activeTab === 'updates') {
      renderUpdatesPane();
    } else if (_state.activeTab === 'remote') {
      renderRemotePane();
    } else if (_state.activeTab === 'docs') {
      // docs 由 app.js 的 buildPluginDocsHTML 渲染
      if (window.MCJS_DOCS_RENDER) window.MCJS_DOCS_RENDER();
      else {
        var c = document.getElementById('pluginDocsContainer');
        if (c) c.innerHTML = '<div class="empty-state"><p>文档尚未加载</p></div>';
      }
    }
  }

  function renderAll() {
    renderCategories();
    renderActivePane();
  }

  /* ===== Modal: Open / Close ===== */
  function open() {
    var modal = document.getElementById('pluginMarketModal');
    if (!modal) return;
    renderAll();
    modal.classList.add('active');
  }
  function close() {
    var modal = document.getElementById('pluginMarketModal');
    if (modal) modal.classList.remove('active');
  }

  /* ===== Import plugin (file input) ===== */
  function importFromFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.mcjs-plugin,application/json';
    input.addEventListener('change', function() {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var plugin = JSON.parse(e.target.result);
          if (!plugin.id || !plugin.name) {
            throw new Error('插件格式错误:缺少 id 或 name 字段');
          }
          if (!plugin.hooks || !plugin.hooks.length) {
            throw new Error('插件至少需要一个 hook 点');
          }
          if (!plugin.code && !plugin.builtin) {
            throw new Error('插件必须包含 code 或 builtin 字段');
          }
          // 如果 builtin 字段存在,提示用户
          Registry.install(plugin);
          Registry.enable(plugin.id);
          if (window.MCJS_TOAST) window.MCJS_TOAST('插件已导入并启用: ' + plugin.name, 'success');
          renderAll();
        } catch (err) {
          if (window.MCJS_TOAST) window.MCJS_TOAST('导入失败: ' + err.message, 'error');
        }
      };
      reader.readAsText(f);
    });
    input.click();
  }

  /* ===== Bind UI Events ===== */
  function bindEvents() {
    var modal = document.getElementById('pluginMarketModal');
    if (!modal) return;

    // 委托音效:点击/hover 触发 sound
    modal.addEventListener('click', function(e){
      try {
        if (window.MCJS && window.MCJS.sound) window.MCJS.sound.click();
      } catch(_){}
    });
    modal.addEventListener('mouseover', function(e){
      try {
        var t = e.target;
        if (!t) return;
        if (t.closest && t.closest('button, .plugin-btn, .plugin-tab, .plugin-chip, .plugin-card, .plugin-tag, a, select, [role="button"]')) {
          if (window.MCJS && window.MCJS.sound) window.MCJS.sound.hover();
        }
      } catch(_){}
    });

    document.getElementById('pluginMarketClose').addEventListener('click', close);
    modal.addEventListener('click', function(e) { if (e.target === modal) close(); });

    var tabs = modal.querySelectorAll('.plugin-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        _state.activeTab = tab.getAttribute('data-tab');
        // 切换 pane
        modal.querySelectorAll('.plugin-pane').forEach(function(p) { p.classList.remove('active'); });
        var pane = modal.querySelector('.plugin-pane[data-pane="' + _state.activeTab + '"]');
        if (pane) pane.classList.add('active');
        renderActivePane();
      });
    });

    var search = document.getElementById('pluginSearchInput');
    if (search) {
      var timer = null;
      search.addEventListener('input', function() {
        clearTimeout(timer);
        timer = setTimeout(function() {
          _state.searchQuery = search.value;
          renderBrowsePane();
        }, 200);
      });
    }

    var remoteSearch = document.getElementById('pluginRemoteSearchInput');
    if (remoteSearch) {
      var rtimer = null;
      remoteSearch.addEventListener('input', function() {
        clearTimeout(rtimer);
        rtimer = setTimeout(function() {
          _state.searchQuery = remoteSearch.value;
          renderRemotePane();
        }, 200);
      });
    }

    var importBtn = document.getElementById('importPluginBtn');
    if (importBtn) importBtn.addEventListener('click', importFromFile);

    var importUrlBtn = document.getElementById('importFromURLBtn');
    if (importUrlBtn) {
      importUrlBtn.addEventListener('click', function() {
        var url = (document.getElementById('pluginURLInput') || {}).value;
        if (!url) { if (window.MCJS_TOAST) window.MCJS_TOAST('请输入 URL', 'warning'); return; }
        importFromURL(url.trim());
      });
    }

    var refreshBtn = document.getElementById('refreshPluginMarket');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        if (window.MCJS_TOAST) window.MCJS_TOAST('插件列表已刷新', 'info');
        renderAll();
      });
    }
  }

  /* ===== Public API ===== */
  window.MCJS_PLUGIN_MARKET = {
    open: open,
    close: close,
    refresh: renderAll,
    renderActivePane: renderActivePane
  };

  // Bind on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    setTimeout(bindEvents, 0);
  }

  /* ===== Cross-Component State Sync =====
     当外部(如主页面 installed-pill 区域)改了插件状态,这里也需要重渲染 */
  function bindStateSync() {
    if (!window.MCJS_EVENTS) return;
    var evts = ['plugin:enable', 'plugin:disable', 'plugin:install', 'plugin:uninstall', 'plugin:updated', 'remote:add', 'remote:remove'];
    evts.forEach(function(name) {
      window.MCJS_EVENTS.on(name, function() {
        // 弹窗已打开时,刷新当前可见 pane
        var modal = document.getElementById('pluginMarketModal');
        if (modal && modal.classList.contains('active')) {
          renderActivePane();
        }
        // 顺便刷新一次分类条(状态条数会变)
        if (modal && modal.classList.contains('active')) renderCategories();
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStateSync);
  } else {
    setTimeout(bindStateSync, 0);
  }
})();
