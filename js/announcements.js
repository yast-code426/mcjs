/* MCJS Launcher - 历代更新公告
 * 最新公告在数组最前(index 0)。
 * 启动弹窗自动取第一条;设置中的"历史公告"展示全部。
 * 纯 ES5 写法。
 */
(function () {
  'use strict';

  var ANNOUNCEMENTS = [
    {
      version: 'v1.5.1',
      date: '2026-09-06',
      title: 'MCJS Launcher v1.5.1 1.21.11 简介同步与临时皮肤',
      items: [
        { tag: '新增', text: '<strong>下载临时皮肤按钮</strong>：Eaglercraft 1.21.11 WASM 存在「无自定义皮肤无法进入主页」的已知 bug，版本卡片新增「下载临时皮肤」按钮，可一键下载官方默认皮肤 steve.png，进入游戏后在皮肤设置中导入即可（与 MCJS 官网同步）' },
        { tag: '同步', text: '<strong>1.21.11 简介更新</strong>：与 MCJS 官网最新数据同步，大小更新为 46.7MB，联机说明修正为「仅单机游戏」，bug 提示补充临时皮肤解决方案' }
      ]
    },
    {
      version: 'v1.5.0',
      date: '2026-09-05',
      title: 'MCJS Launcher v1.5.0 设置与界面焕新',
      items: [
        { tag: '新增', text: '<strong>站内设置中心</strong>：设置从独立弹窗改为启动器内毛玻璃模态窗口，左侧分类导航（常规 / 外观 / 性能 / 存储 / 插件 / 通知与隐私 / 高级调试 / 关于），不再被浏览器拦截' },
        { tag: '新增', text: '<strong>深色主题</strong>：支持浅色 / 深色 / 跟随系统三种模式，全站即时切换' },
        { tag: '新增', text: '<strong>主题强调色</strong>：提供绿 / 蓝 / 紫 / 橙 / 粉五种强调色，按钮、开关、选中态全站联动' },
        { tag: '新增', text: '<strong>毛玻璃开关</strong>：可一键关闭毛玻璃效果，低性能设备更流畅' },
        { tag: '新增', text: '<strong>界面音量</strong>：音效音量独立调节（0~100%）' },
        { tag: '新增', text: '<strong>默认引擎偏好</strong>：可指定 JS / WASM / 自动，启动成对版本时自动切换到偏好引擎' },
        { tag: '新增', text: '<strong>更多开关</strong>：危险操作二次确认、插件启动自动检查更新、公告开关、存档备份定期提醒' },
        { tag: '新增', text: '<strong>配置导入导出</strong>：设置支持一键导出 JSON 备份与导入恢复，新增"恢复默认设置"' },
        { tag: '优化', text: '<strong>插件市场布局</strong>：标签栏胶囊化并带数量徽章（已安装数 / 可更新数），卡片按分类显示彩色强调线，按钮等分排列，修复已安装第三方插件"启用"按钮缺失的问题' },
        { tag: '优化', text: '<strong>主页插件面板回归</strong>：主页直接展示已安装插件，带分类图标与快速启用 / 停用开关' },
        { tag: '优化', text: '<strong>设置内插件管理</strong>：插件分类中可直接快速开关已装插件，缓存 / 存档操作同窗口直连，响应更快' }
      ]
    },
    {
      version: 'v1.4.1',
      date: '2026-09-04',
      title: 'MCJS Launcher v1.4.1 性能与标签更新',
      items: [
        { tag: '优化', text: '<strong>脚本延迟加载</strong>：非关键脚本全部启用 defer，首屏渲染速度提升约 30%，老浏览器不再卡顿' },
        { tag: '优化', text: '<strong>CSS 渲染优化</strong>：版本卡片启用 contain 隔离，分组启用 content-visibility，滚动流畅度明显提升' },
        { tag: '优化', text: '<strong>网络预加载</strong>：head 中新增 preload / preconnect / dns-prefetch，游戏文件加载更快' },
        { tag: '优化', text: '<strong>标签醒目</strong>：26.2 WASM 和 1.20.6 WASM 新增"最新"推荐标签，一眼找到最新版' },
        { tag: '优化', text: '<strong>兼容层升级</strong>：补齐更多老浏览器 polyfill，兼容层版本同步至 1.4.1' },
        { tag: '修复', text: '<strong>搜索防抖</strong>：搜索输入增加节流，打字时不再频繁重渲染' }
      ]
    },
    {
      version: 'v1.4.0',
      date: '2026-09-02',
      title: 'MCJS Launcher v1.4.0 修复与优化',
      items: [
        { tag: '修复', text: '<strong>设置按钮无响应</strong>：修复设置窗口内联脚本的正则转义错误，设置窗口现在可以正常打开与操作' },
        { tag: '修复', text: '<strong>浏览器信息一直"检测中…"</strong>：检测脚本现在能正常执行，浏览器/内核/系统/GPU/WebGL 等信息正确显示' },
        { tag: '修复', text: '<strong>插件系统启动崩溃</strong>：修复插件 API 中钩子点列表"先用后定义"导致的初始化错误，插件市场/编写器恢复正常' },
        { tag: '新增', text: '<strong>历代公告</strong>：设置窗口新增"更新公告"入口，可查看从首版至今的全部历史更新公告' },
        { tag: '优化', text: '<strong>老浏览器兼容</strong>：新增兼容层(compat.js)，为旧版浏览器补齐 fetch / Promise / 数组与对象方法 / classList / requestAnimationFrame / 剪贴板等 polyfill' },
        { tag: '优化', text: '<strong>网速优化</strong>：对全部镜像域名启用 DNS 预取与预连接(preconnect)，打开镜像更快；Service Worker 改为缓存优先 + 后台更新，二次启动秒开' },
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
