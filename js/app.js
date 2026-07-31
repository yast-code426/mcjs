// MCJS 镜像站 - 主应用
(function () {
  'use strict';

  const grid = document.getElementById('versionGrid');
  const searchInput = document.getElementById('searchInput');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const launchModal = document.getElementById('launchModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingText = document.getElementById('loadingText');
  const loadingDetail = document.getElementById('loadingDetail');
  const progressFill = document.getElementById('progressFill');
  const mirrorSelect = document.getElementById('mirrorSelect');
  const mirrorList = document.getElementById('mirrorList');

  let currentFilter = 'all';
  let searchQuery = '';

  // 功能标签映射
  const FEATURE_LABELS = {
    '多人联机': { icon: 'N', text: '多人联机' },
    '触屏支持': { icon: 'T', text: '触屏支持' },
    '光影渲染': { icon: 'S', text: '光影渲染' },
    '高帧率': { icon: 'F', text: '高帧率' },
    '单人游戏': { icon: 'P', text: '单人游戏' },
    '导出存档': { icon: 'E', text: '导出存档' },
    '单机': { icon: 'P', text: '单机' },
    '局域网': { icon: 'L', text: '局域网' },
    '远程联机': { icon: 'R', text: '远程联机' }
  };

  // 徽章样式映射
  const BADGE_MAP = {
    'recommended': { cls: 'badge-recommended', text: '⭐ 推荐' },
    'beta': { cls: 'badge-beta', text: '🧪 测试版' },
    'legacy': { cls: 'badge-legacy', text: '📜 经典版' },
    'new-beta': { cls: 'badge-new', text: '🚀 新版测试' }
  };

  // 渲染版本卡片
  function renderCard(ver) {
    const badge = BADGE_MAP[ver.type] || BADGE_MAP.legacy;
    const tags = ver.features.map(function (f) {
      const label = FEATURE_LABELS[f] || { icon: '?', text: f };
      return '<span class="tag"><span class="tag-icon">' + label.icon + '</span>' + label.text + '</span>';
    }).join('');

    const langTags = ver.lang.map(function (l) {
      return '<span class="tag">' + l + '</span>';
    }).join('');

    // 使用 detail 字段替代原有描述
    const detailLines = ver.detail ? ver.detail.split('\n').map(function(line) {
      return line.trim() ? '<div class="card-detail-line">' + escapeHtml(line) + '</div>' : '';
    }).join('') : '';

    return '<div class="version-card" data-type="' + ver.type + '" data-id="' + ver.id + '" onclick="launchVersion(\'' + ver.id + '\')">' +
      '<div class="card-header">' +
        '<div class="card-title">' + escapeHtml(ver.name) + '</div>' +
        '<span class="card-badge ' + badge.cls + '">' + badge.text + '</span>' +
      '</div>' +
      '<div class="card-meta">' + escapeHtml(ver.version) + '<br>作者：' + escapeHtml(ver.author) + '</div>' +
      '<div class="card-detail">' + detailLines + '</div>' +
      '<div class="card-tags">' + tags + langTags +
        '<span class="tag">' + ver.engine + '</span>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span class="card-size">' + ver.size + '</span>' +
        '<button class="card-launch-btn">启动</button>' +
      '</div>' +
    '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 筛选并渲染
  function renderGrid() {
    var filtered = VERSIONS.filter(function (ver) {
      // 按分类筛选
      if (currentFilter !== 'all') {
        if (currentFilter === 'wasm') {
          if (ver.engine !== 'WASM') return false;
        } else if (currentFilter === 'stable') {
          if (ver.type !== 'recommended') return false;
        } else {
          if (ver.type !== currentFilter) return false;
        }
      }
      // 按搜索筛选
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        return ver.name.toLowerCase().indexOf(q) !== -1 ||
               ver.version.toLowerCase().indexOf(q) !== -1 ||
               ver.author.toLowerCase().indexOf(q) !== -1 ||
               ver.engine.toLowerCase().indexOf(q) !== -1;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>没有找到匹配的版本。</p></div>';
    } else {
      grid.innerHTML = filtered.map(renderCard).join('');
    }
  }

  // 筛选标签点击事件
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filterTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderGrid();
    });
  });

  // 搜索输入
  searchInput.addEventListener('input', function () {
    searchQuery = searchInput.value.trim();
    renderGrid();
  });

  // 启动版本
  window.launchVersion = function (id) {
    var ver = VERSIONS.find(function (v) { return v.id === id; });
    if (!ver) return;

    modalTitle.textContent = ver.name;
    launchModal.classList.add('active');
    mirrorSelect.classList.add('active');
    loadingScreen.classList.remove('active');

    // 渲染镜像按钮
    mirrorList.innerHTML = ver.mirrors.map(function (m) {
      return '<a class="mirror-btn" href="' + escapeHtml(m.url) + '" target="_blank" rel="noopener">' +
        '<div>' +
          '<div class="mirror-name">' + escapeHtml(m.name) + '</div>' +
          '<div class="mirror-url">' + escapeHtml(m.url) + '</div>' +
        '</div>' +
        '<span class="mirror-arrow">&rarr;</span>' +
      '</a>';
    }).join('');

    // 外部版本（新版 Beta）特殊提示
    if (ver.external) {
      loadingText.textContent = '这是一个托管在外部的测试版本。';
      loadingDetail.textContent = '点击下方镜像在新标签页中打开。';
    } else {
      loadingText.textContent = '选择一个镜像来开始游戏。';
      loadingDetail.textContent = '游戏将在新标签页中打开。为获得最佳体验，建议使用 Chrome 浏览器。';
    }
  };

  // 关闭弹窗
  modalClose.addEventListener('click', function () {
    launchModal.classList.remove('active');
  });

  launchModal.addEventListener('click', function (e) {
    if (e.target === launchModal) {
      launchModal.classList.remove('active');
    }
  });

  // 键盘快捷键
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      launchModal.classList.remove('active');
    }
  });

  // 更新版本计数
  document.getElementById('versionCount').textContent = VERSIONS.length + ' 个版本';

  // 初始化渲染
  renderGrid();
})();