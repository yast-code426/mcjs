/* MCJS Launcher - 历代更新公告
 * 最新公告在数组最前(index 0)。
 * 启动弹窗自动取第一条;设置中的"历史公告"展示全部。
 * 纯 ES5 写法。
 */
(function () {
  'use strict';

  var ANNOUNCEMENTS = [
    {
      version: 'v1.3.1',
      date: '2026-09-02',
      title: 'MCJS Launcher v1.3.1 修复与优化',
      items: [
        { tag: '修复', text: '<strong>设置按钮无响应</strong>：修复设置窗口内联脚本的正则转义错误，设置窗口现在可以正常打开与操作' },
        { tag: '修复', text: '<strong>浏览器信息一直"检测中…"</strong>：检测脚本现在能正常执行，浏览器/内核/系统/GPU/WebGL 等信息正确显示' },
        { tag: '修复', text: '<strong>插件系统启动崩溃</strong>：修复插件 API 中钩子点列表"先用后定义"导致的初始化错误，插件市场/编写器恢复正常' },
        { tag: '新增', text: '<strong>历代公告</strong>：设置窗口新增"更新公告"入口，可查看从首版至今的全部历史更新公告' },
        { tag: '优化', text: '<strong>老浏览器兼容</strong>：新增兼容层(compat.js)，为旧版浏览器补齐 fetch / Promise / 数组与对象方法 / classList / requestAnimationFrame / 剪贴板等 polyfill' },
        { tag: '优化', text: '<strong>网速优化</strong>：对全部镜像域名启用 DNS 预取与预连接(preconnect)，打开镜像更快；Service Worker 改为缓存优先 + 后台更新(stale-while-revalidate)，二次启动秒开' },
        { tag: '优化', text: '<strong>弱网体验</strong>：镜像请求加入 12 秒超时与自动回退，网络卡住时不再长时间无响应；启动器静态资源离线可用' }
      ]
    },
    {
      version: 'v1.3',
      date: '2026-08-07',
      title: 'MCJS Launcher v1.3 更新内容',
      items: [
        { tag: '新增', text: '<strong>新增帮助中心</strong>：顶部新增帮助按钮，含快速开始、版本分类、联机方式、插件系统、设置说明、快捷键等' },
        { tag: '新增', text: '<strong>新增工程调试</strong>：设置面板新增调试模式、详细日志、禁用缓存、FPS 浮层、测试模式' },
        { tag: '新增', text: '<strong>新增浏览器信息</strong>：设置面板显示浏览器/内核/OS/屏幕/CPU/GPU/WebGL/WASM 等信息，支持一键复制' },
        { tag: '新增', text: '<strong>新增镜像站</strong>：从 6 个扩展到 14 个，新增 7 个 mcjslink 镜像站' },
        { tag: '新增', text: '<strong>新增版本</strong>：1.14.4 WASM、1.20.6 WASM、26.2 WASM' },
        { tag: '新增', text: '<strong>新增第三方客户端</strong>：PixelClient、TuffClient' },
        { tag: '修复', text: '<strong>插件禁用修复</strong>：修复 API 未加载时禁用插件报错' },
        { tag: '修复', text: '<strong>全屏 ESC 修复</strong>：全屏按 ESC 退出全屏时不再误触退出游戏' },
        { tag: '优化', text: '<strong>钩子系统增强</strong>：输入校验、重复注册防护、并发修改防护、空数组清理' }
      ]
    },
    {
      version: 'v1.2',
      date: '2026-07-15',
      title: 'MCJS Launcher v1.2 更新内容',
      items: [
        { tag: '新增', text: '<strong>插件市场</strong>：支持在线浏览、安装、启用、禁用、卸载插件' },
        { tag: '新增', text: '<strong>插件编写器</strong>：内置代码编辑器，支持新建、保存、测试、格式化、导出插件' },
        { tag: '新增', text: '<strong>远程仓库</strong>：支持从第三方 URL / GitHub raw 链接导入插件' },
        { tag: '新增', text: '<strong>钩子系统</strong>：插件可在启动、镜像、渲染等 15 个钩子点注入逻辑' },
        { tag: '优化', text: '<strong>WASM 兼容</strong>：新增 WASM Polyfill 与 JSPI 回退，不支持 WASM 的浏览器可降级运行' }
      ]
    },
    {
      version: 'v1.1',
      date: '2026-06-20',
      title: 'MCJS Launcher v1.1 更新内容',
      items: [
        { tag: '新增', text: '<strong>镜像选择</strong>：启动前可手动选择镜像，支持失败自动切换下一个镜像' },
        { tag: '新增', text: '<strong>设置窗口</strong>：独立设置窗口，含启动、性能、存储、外观等分组' },
        { tag: '新增', text: '<strong>缓存管理</strong>：基于 IndexedDB 的游戏文件缓存，支持查看与清除' },
        { tag: '新增', text: '<strong>存档管理</strong>：支持存档隔离与一键清除存档' },
        { tag: '优化', text: '<strong>内存优化</strong>：启动前自动清理内存，支持手动执行内存释放' }
      ]
    },
    {
      version: 'v1.0',
      date: '2026-06-01',
      title: 'MCJS Launcher v1.0 首发',
      items: [
        { tag: '首发', text: '<strong>全版本整合</strong>：Eaglercraft 简体中文优化版，网页直接游玩，无需下载' },
        { tag: '首发', text: '<strong>版本分类</strong>：MCJS 优化版、模组整合包、最新测试版、第三方客户端、经典旧版' },
        { tag: '首发', text: '<strong>多引擎支持</strong>：JS 版兼容好、WASM 版性能高，按浏览器自动推荐' },
        { tag: '首发', text: '<strong>本地运行</strong>：游戏在浏览器本地运行，支持材质包、光影包与远程联机' }
      ]
    }
  ];

  /* 暴露 API */
  window.MCJS_ANNOUNCEMENTS = ANNOUNCEMENTS;
  window.MCJS_GET_LATEST_ANNOUNCEMENT = function () { return ANNOUNCEMENTS[0]; };
  window.MCJS_GET_ALL_ANNOUNCEMENTS = function () { return ANNOUNCEMENTS.slice(); };

  /* 渲染单条公告为 HTML(供弹窗/设置窗口共用) */
  window.MCJS_RENDER_ANNOUNCEMENT = function (a, opts) {
    opts = opts || {};
    var itemsHtml = '';
    for (var i = 0; i < a.items.length; i++) {
      var it = a.items[i];
      itemsHtml += '<li><span class="ann-tag ann-tag-' + tagClass(it.tag) + '">' + escapeHtml(it.tag) + '</span>' + it.text + '</li>';
    }
    var header = '';
    if (opts.withHeader !== false) {
      header = '<div class="ann-entry-head">' +
        '<span class="ann-entry-version">' + escapeHtml(a.version) + '</span>' +
        '<span class="ann-entry-date">' + escapeHtml(a.date || '') + '</span>' +
        '</div>';
    }
    return '<div class="ann-entry" data-version="' + escapeHtml(a.version) + '">' +
      header +
      '<h3 class="ann-entry-title">' + escapeHtml(a.title) + '</h3>' +
      '<ul class="ann-entry-list">' + itemsHtml + '</ul>' +
      '</div>';
  };

  function tagClass(tag) {
    if (tag === '修复') return 'fix';
    if (tag === '新增' || tag === '首发') return 'new';
    if (tag === '优化') return 'opt';
    return 'other';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
