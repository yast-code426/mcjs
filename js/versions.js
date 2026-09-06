// MCJS 镜像站 - 版本数据
// 所有 Eaglercraft/MCJS 版本及镜像链接
// 数据来源: https://mcjs.link/

var MIRROR_BASES = [
  'https://play.mcjs.cc',
  'https://playmcjscc.pages.dev',
  'https://play.mcjs.144449.xyz',
  'https://ipv6.mcjs.cc',
  'https://mirror.mcjs.cc',
  'https://mcjs-mirror.144449.xyz',
  'https://mcjs-mirror-test.144449.xyz',
  'https://1.mcjslink.144449.xyz',
  'https://2.mcjslink.144449.xyz',
  'https://3.mcjslink.144449.xyz',
  'https://4.mcjslink.144449.xyz',
  'https://5.mcjslink.144449.xyz',
  'https://6.mcjslink.144449.xyz',
  'https://7.mcjslink.144449.xyz'
];

var BETA_MIRROR_BASE = 'https://mcjs-beta.144449.xyz';

function makeMirrors(path) {
  return MIRROR_BASES.map(function(base, i) {
    return { name: '镜像站 ' + (i + 1), url: base + '/' + path + '/' };
  });
}

function makeBetaMirrors(path, originUrl) {
  var mirrors = [{ name: '加速镜像', url: BETA_MIRROR_BASE + '/' + path }];
  if (originUrl) mirrors.push({ name: '原站', url: originUrl });
  return mirrors;
}

var VERSIONS = [
  // === MCJS 优化版（推荐） ===
  {
    id: '1.8.8',
    name: 'EaglercraftX 1.8.8',
    version: 'MC JE 1.8.8 JS u53 ultimate',
    author: 'lax1dude',
    translator: 'MCJS',
    type: 'recommended',
    engine: 'JS',
    size: '21.1MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网', '触屏支持', '光影渲染'],
    multiplayer: true,
    modpack: false,
    description: '兼容性最佳。支持 PC + 手机，局域网 & P2P 联机，光影效果。',
    recommendTag: '最佳兼容',
    detail: '已更新最终版汉化包，更新完整翻译\n' +
            '语言：简体中文(完整翻译)、英文\n' +
            '性能：高\n' +
            '设备：电脑键鼠操作、手机触屏操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置光影包',
    path: '1.8.8',
    mirrors: makeMirrors('1.8.8')
  },
  {
    id: '1.8.8wasm',
    name: 'EaglercraftX 1.8.8 WASM',
    version: 'MC JE 1.8.8 WASM-GC u53 ultimate',
    author: 'lax1dude',
    translator: 'MCJS',
    type: 'recommended',
    engine: 'WASM',
    size: '9.6MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网', '触屏支持', '光影渲染', '高帧率'],
    multiplayer: true,
    modpack: false,
    description: '性能最佳。WASM 增强，更高 FPS。需要现代 Chrome 浏览器。',
    recommendTag: '最佳性能',
    detail: '已更新最终版汉化包，更新完整翻译\n' +
            '语言：简体中文(完整翻译)、英文\n' +
            '性能：极高\n' +
            '设备：电脑键鼠操作、手机触屏操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置光影包',
    path: '1.8.8wasm',
    mirrors: makeMirrors('1.8.8wasm')
  },
  {
    id: '1.12.2',
    name: 'Eaglercraft 1.12.2',
    version: 'MC JE 1.12.2 JS u3',
    author: 'PeytonPlayz585',
    translator: 'MCJS',
    type: 'recommended',
    engine: 'JS',
    size: '27.7MB',
    lang: ['简体中文(完整翻译)'],
    features: ['远程联机', '局域网', '导出存档'],
    multiplayer: true,
    modpack: false,
    description: '已热更新至 u3 版本，大幅提升性能。支持导出存档和局域网/远程联机。',
    detail: '已热更新至 u3 版本，大幅提升性能\n' +
            '现已支持导出存档和局域网/远程联机\n' +
            '已更新最终版汉化包，更新完整翻译\n' +
            '语言：简体中文(完整翻译)\n' +
            '性能：较高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包',
    path: '1.12.2',
    mirrors: makeMirrors('1.12.2')
  },
  {
    id: '1.12.2wasm',
    name: 'Eaglercraft 1.12.2 WASM',
    version: 'MC JE 1.12.2 WASM-GC u3',
    author: 'PeytonPlayz585',
    translator: 'MCJS',
    type: 'recommended',
    engine: 'WASM',
    size: '17.9MB',
    lang: ['简体中文(完整翻译)'],
    features: ['远程联机', '局域网', '导出存档'],
    multiplayer: true,
    modpack: false,
    description: '1.12.2 WASM u3 版本。性能更好，支持导出存档和联机。',
    detail: '已热更新至 u3 版本，大幅提升性能\n' +
            '现已支持导出存档和局域网/远程联机\n' +
            '已更新最终版汉化包，更新完整翻译\n' +
            '语言：简体中文(完整翻译)\n' +
            '性能：高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包',
    path: '1.12.2wasm',
    mirrors: makeMirrors('1.12.2wasm')
  },

  // === 新版 Beta 版本 ===
  {
    id: '1.14.4',
    name: 'Eaglercraft 1.14.4 WASM',
    version: 'MC JE 1.14.4 WASM-GC u1',
    author: 'eymenwsmc',
    translator: 'Enchantment-Niko',
    type: 'new-beta',
    engine: 'WASM',
    size: '~45MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网'],
    multiplayer: true,
    modpack: false,
    description: '1.14 版本移植。需要高性能电脑。测试版不稳定。',
    detail: '语言：简体中文、英文\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包',
    path: '1.14.4',
    mirrors: makeBetaMirrors('1.14.4', 'https://enchantment-niko.github.io/webmc/1.14.4/'),
    external: true
  },
  {
    id: '1.16.5',
    name: 'Eaglercraft 1.16.5 WASM',
    version: 'MC JE 1.16.5 WASM-GC u3 beta',
    author: 'AcornDev',
    type: 'new-beta',
    engine: 'WASM',
    size: '50.6MB',
    lang: ['English'],
    features: ['远程联机', '局域网'],
    multiplayer: true,
    modpack: false,
    description: '下界更新移植版！已知 bug: 阴影渲染偏暗，建议调高亮度。',
    detail: '⚠️已知 bug: 阴影渲染有问题导致整体亮度偏暗，建议调高亮度使用\n' +
            '语言：仅英文原版\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包',
    path: '1.16.5',
    mirrors: makeBetaMirrors('1.16.5', 'https://enchantment-niko.github.io/webmc/1.16.5/'),
    external: true
  },
  {
    id: '1.20.6',
    name: 'Eaglercraft 1.20.6 WASM',
    version: 'MC JE 1.20.6 WASM-GC beta 0.1',
    author: 'eymenwsmc',
    translator: 'Enchantment-Niko',
    type: 'new-beta',
    recommendTag: '推荐',
    engine: 'WASM',
    size: '~55MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网'],
    multiplayer: true,
    modpack: false,
    description: '1.20 版本移植。非常早期的 beta，需要高性能电脑。',
    detail: '语言：简体中文、英文\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包',
    path: '1.20.6',
    mirrors: makeBetaMirrors('1.20.6', 'https://enchantment-niko.github.io/webmc/1.20.6/chinese.html'),
    external: true
  },
  {
    id: '1.21.11',
    name: 'Eaglercraft 1.21.11 WASM',
    version: 'MC JE 1.21.11 WASM-GC u1 beta',
    author: 'Syntaxsavy',
    translator: 'Enchantment-Niko',
    type: 'new-beta',
    engine: 'WASM',
    size: '46.7MB',
    lang: ['简体中文', 'English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    tempSkin: 'assets/steve.png',
    description: '棘巧试炼更新。极度早期版本，可能导致浏览器崩溃。需导入自定义皮肤才能进入主页，可点击「下载临时皮肤」获取官方默认皮肤。',
    detail: '⚠️已知 bug: 需要导入一个自定义皮肤才能进入主页，或点卡片上的「下载临时皮肤」按钮获取官方默认皮肤(steve.png)\n' +
            '语言：简体中文、英文\n' +
            '性能：极低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：仅单机游戏\n' +
            '资源：自定义材质包',
    path: '1.21.11',
    mirrors: makeBetaMirrors('1.21.11', 'https://enchantment-niko.github.io/webmc/1.21.11/desktop.html'),
    external: true
  },
  {
    id: '26.1.2',
    name: 'Eaglercraft 26.1.2 WebGL2',
    version: 'MC JE 26.1.2 u0-1.2',
    author: 'Novix',
    type: 'new-beta',
    engine: 'WebGL2',
    size: '61.6MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '前沿版本。非常不稳定，可能崩溃。仅限英文。',
    detail: '语言：仅英文原版\n' +
            '性能：极低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✗\n' +
            '资源：自定义材质包',
    path: '26.1.2',
    mirrors: makeBetaMirrors('26.1.2', 'https://enchantment-niko.github.io/webmc/26.1.2/novix-1.2.html'),
    external: true
  },
  {
    id: '26.2',
    name: 'Eaglercraft 26.2 WASM',
    version: 'MC JE 26.2 0.4-dev',
    author: 'o_xer',
    translator: 'Enchantment-Niko, o_xer',
    type: 'new-beta',
    recommendTag: '推荐',
    engine: 'WASM',
    size: '~60MB',
    lang: ['简体中文', 'English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最新开发版。非常不稳定，仅单机。需要高性能电脑。',
    detail: '语言：简体中文、英文\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗\n' +
            '资源：自定义材质包',
    path: '26.2',
    mirrors: makeBetaMirrors('26.2', 'https://enchantment-niko.github.io/webmc/26.2/'),
    external: true
  },

  // === 模组整合包 ===
  {
    id: '1.6.4-forge-lite',
    name: 'Eaglercraft 1.6.4 Forge "Lite" 轻量整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '25.7MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 轻量模组整合包。需要高性能电脑。仅限英文。',
    detail: '语言：仅英文原版\n' +
            '性能：较低\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置模组包',
    path: 'modpack/lite',
    mirrors: makeMirrors('modpack/lite'),
    external: true
  },
  {
    id: '1.6.4-forge-tech',
    name: 'Eaglercraft 1.6.4 Forge "Tech" 硬核科技整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '28.3MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 硬核科技模组整合包。文件大，启动久。仅限英文。',
    detail: '文件较大，启动时间较长\n' +
            '语言：仅英文原版\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置模组包',
    path: 'modpack/tech',
    mirrors: makeMirrors('modpack/tech'),
    external: true
  },
  {
    id: '1.6.4-forge-skyfactory',
    name: 'Eaglercraft 1.6.4 Forge "Skyfactory" 天空工厂整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '26.5MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 天空工厂模组整合包。文件大，启动久。仅限英文。',
    detail: '文件较大，启动时间较长\n' +
            '语言：仅英文原版\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置模组包',
    path: 'modpack/skyfactory',
    mirrors: makeMirrors('modpack/skyfactory'),
    external: true
  },
  {
    id: '1.6.4-forge-magic',
    name: 'Eaglercraft 1.6.4 Forge "Magic" 神奇魔法整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '30.3MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 神奇魔法模组整合包。文件大，启动久。仅限英文。',
    detail: '文件较大，启动时间较长\n' +
            '语言：仅英文原版\n' +
            '性能：低(建议使用高性能的电脑)\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：自定义材质包、内置模组包',
    path: 'modpack/magic',
    mirrors: makeMirrors('modpack/magic'),
    external: true
  },

  // === 第三方 Eaglercraft 客户端 ===
  {
    id: 'pixelclient/1.8.8',
    name: 'PixelClient 1.8.8',
    version: 'MC JE 1.8.8 JS Modded',
    author: 'PixelClient',
    type: 'third-party',
    engine: 'JS',
    size: '~22MB',
    lang: ['部分翻译中文', 'English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'PixelClient 定制第三方客户端。魔改界面和功能。',
    detail: '语言：部分翻译中文、英文\n' +
            '性能：较高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：PixelClient 定制主题',
    path: 'pixelclient/1.8.8',
    mirrors: makeMirrors('pixelclient/1.8.8')
  },
  {
    id: 'pixelclient/1.8.8wasm',
    name: 'PixelClient 1.8.8 WASM',
    version: 'MC JE 1.8.8 WASM-GC Modded',
    author: 'PixelClient',
    type: 'third-party',
    engine: 'WASM',
    size: '~10MB',
    lang: ['部分翻译中文', 'English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'PixelClient WASM 版本。更高性能，定制界面。',
    detail: '语言：部分翻译中文、英文\n' +
            '性能：高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：PixelClient 定制主题',
    path: 'pixelclient/1.8.8wasm',
    mirrors: makeMirrors('pixelclient/1.8.8wasm')
  },
  {
    id: 'pixelclient/1.12.2',
    name: 'PixelClient 1.12.2',
    version: 'MC JE 1.12.2 JS Modded',
    author: 'PixelClient',
    type: 'third-party',
    engine: 'JS',
    size: '~28MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'PixelClient 1.12.2 定制版。仅英文。',
    detail: '语言：仅英文原版\n' +
            '性能：中\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：PixelClient 定制主题',
    path: 'pixelclient/1.12.2',
    mirrors: makeMirrors('pixelclient/1.12.2')
  },
  {
    id: 'pixelclient/1.12.2wasm',
    name: 'PixelClient 1.12.2 WASM',
    version: 'MC JE 1.12.2 WASM-GC Modded',
    author: 'PixelClient',
    type: 'third-party',
    engine: 'WASM',
    size: '~18MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'PixelClient 1.12.2 WASM 版本。更高性能。',
    detail: '语言：仅英文原版\n' +
            '性能：较高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：PixelClient 定制主题',
    path: 'pixelclient/1.12.2wasm',
    mirrors: makeMirrors('pixelclient/1.12.2wasm')
  },
  {
    id: 'tuffclient/1.12.2',
    name: 'TuffClient 1.12.2',
    version: 'MC JE 1.12.2 JS Modded',
    author: 'TuffClient',
    type: 'third-party',
    engine: 'JS',
    size: '~28MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'TuffClient 定制第三方客户端。仅英文。',
    detail: '语言：仅英文原版\n' +
            '性能：中\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：TuffClient 定制主题',
    path: 'tuffclient/1.12.2',
    mirrors: makeMirrors('tuffclient/1.12.2')
  },
  {
    id: 'tuffclient/1.12.2wasm',
    name: 'TuffClient 1.12.2 WASM',
    version: 'MC JE 1.12.2 WASM-GC Modded',
    author: 'TuffClient',
    type: 'third-party',
    engine: 'WASM',
    size: '~18MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '定制主题'],
    multiplayer: true,
    modpack: false,
    description: 'TuffClient WASM 版本。更高性能，定制界面。',
    detail: '语言：仅英文原版\n' +
            '性能：较高\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '资源：TuffClient 定制主题',
    path: 'tuffclient/1.12.2wasm',
    mirrors: makeMirrors('tuffclient/1.12.2wasm')
  },

  // === 经典旧版 ===
  {
    id: '1.6.4',
    name: 'Eaglercraft 1.6.4',
    version: 'MC JE 1.6.4 JS',
    author: 'Catfoolyou',
    type: 'legacy',
    engine: 'JS',
    size: '23.5MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '马匹更新。仅限英文，怀旧体验。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.6.4',
    mirrors: makeMirrors('1.6.4')
  },
  {
    id: '1.5.2',
    name: 'Eaglercraft 1.5.2',
    version: 'MC JE 1.5.2 JS SP2 Update',
    author: 'lax1dude, ayunami2000',
    type: 'legacy',
    engine: 'JS',
    size: '20.2MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最初的 Eaglercraft 版本。红石更新时代。仅限英文。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.5.2',
    mirrors: makeMirrors('1.5.2')
  },
  {
    id: '1.2.5',
    name: 'Eaglercraft 1.2.5',
    version: 'MC JE 1.2.5 JS',
    author: 'Colbster937',
    type: 'legacy',
    engine: 'JS',
    size: '21.3MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Minecraft 经典时代。仅限英文，复古体验。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.2.5',
    mirrors: makeMirrors('1.2.5')
  },
  {
    id: 'legacy/beta1.7.3',
    name: 'Eaglercraft Beta 1.7.3',
    version: 'MC Beta 1.7.3 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '15.6MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Beta 时代 Minecraft。仅限英文，怀旧体验。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/beta1.7.3',
    mirrors: makeMirrors('legacy/beta1.7.3')
  },
  {
    id: 'legacy/beta1.3',
    name: 'Eaglercraft Beta 1.3',
    version: 'MC Beta 1.3 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '4.3MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最早的 Eaglercraft 单机版本。仅限英文，非常复古。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/beta1.3',
    mirrors: makeMirrors('legacy/beta1.3')
  },
  {
    id: 'legacy/alpha1.2.6',
    name: 'Eaglercraft Alpha 1.2.6',
    version: 'MC Alpha 1.2.6 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '8.2MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Alpha 时代 Minecraft。最早的 Eaglercraft 可玩版本。仅限英文。',
    detail: '语言：仅英文原版\n' +
            '设备：仅支持电脑键鼠操作\n' +
            '联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/alpha1.2.6',
    mirrors: makeMirrors('legacy/alpha1.2.6')
  }
];

// 暴露到全局
if (typeof window !== 'undefined') {
  window.VERSIONS = VERSIONS;
  window.MIRROR_BASES = MIRROR_BASES;
  window.BETA_MIRROR_BASE = BETA_MIRROR_BASE;
}
