# Flutter WebView 改造验证记录

## 2026-10-28：床垫居中与主机位置调整

嵌入总览以床垫为中心取景，主机向右移动，连接软管随之调整。已复核深浅主题预览、面料、主机、水路及窄屏截图。

- `npm run build` 成功；桌面检查 68 项、移动离线检查 53 项、嵌入离线检查 56 项通过。检查覆盖软管避让、后接口连接和 Flutter 离线资源一致性。
- Flutter 包 `flutter analyze` 通过，9 项模拟 WebView 单测通过。
- 已重新导出移动预览和 Flutter 嵌入资源；当前嵌入资源 SHA-256：`ba2efc3cfbe5243a6eb527dc7afd95a9ee5bb0496b79df151e46ec806e28f3cc`。
- 移动检查使用桌面浏览器模拟，本次未复测原生 WebView 和实体手机。

## 2026-10-28：深浅主题适配版（位置调整前）

以下为位置调整前的记录；`output/qa*` 同名结果已被本次复测覆盖。

基于用户提供的深色和浅色 APP 控制页截图，嵌入页改用透明背景，按主题调整氛围与受光。Flutter 组件默认跟随主题，支持显式 `brightness` 覆盖；切换主题保留 WebView、视角和双区状态。网页效果见 `/theme-preview.html`。

- `npm run build` 成功；桌面检查 68 项、移动离线检查 53 项、嵌入离线检查 56 项通过，含透明背景、深浅主题切换和无效主题校验。
- Flutter 包 `flutter analyze` 通过，9 项模拟 WebView 单测通过；示例工程 `flutter analyze` 和 1 项数据测试通过。
- 已复核桌面浅色、深色及手机宽度的预览截图，记录在 `output/qa-theme/`。Flutter 真实 APP 中的透明合成、主题切换和真机性能尚未验收。
- 当时离线资源 SHA-256：`d5564117ae5f6df9b5b7687a224da9ef40b34b7a3f67bec18441f5f2ced6c61e`。

## 2026-10-28：性能优化版（主题适配前）

以下为主题适配前的记录；`output/qa*` 同名结果已被主题版复测覆盖。

- `npm run build` 通过；`npm test` 60 项、`npm run test:mobile` 53 项、`npm run test:embed` 50 项通过。手机触摸为桌面 Chrome 模拟。
- Flutter 包 `flutter analyze` 无问题，模拟 WebView 单测 6 项通过。
- 当时 Flutter 离线资源 SHA-256：`f35f830dbc1cf5b0443b5dae627b7b9a3dfd8b3016c6753c86bfa08623973ea0`；资源与 `output/embed` 字节一致。
- 本轮仅在桌面浏览器和 iPhone user-agent 模拟分支复核阴影、画面与交互，没有原生 WebView 或手机温升实测。优化方法、同机数据和边界见 [性能优化记录](performance-optimization.md)。

## 2026-10-28：围边修复版（性能优化前）

以下为性能优化前的记录；`output/qa*` 同名结果已被性能优化后的复测覆盖。

顶面边界与围边共用同一圈顶点，闭合接缝的褶皱与法线连续；依据床垫圆角模型的顶点与三角形中心采样，围边保持间距。这些是演示模型检查，不是生产尺寸或实物装配验收。

- `npm run build` 成功，保留 Vite 的包大小提示；`npm test`：60 项通过，记录见 `output/qa/checks.json`。
- `npm run test:mobile`：53 项通过，离线无外部请求，记录见 `output/qa-mobile/checks.json`。
- `npm run test:embed`：41 项通过，离线无外部请求，记录见 `output/qa-embed/checks.json`。
- 当时 `npm run export:embed` 同步的 Flutter 包 assets SHA-256：`8a77e82c2e618464b8f0e35cb5338b6e63dbf10cc68844917bd9b6e3d33f6726`。
- Flutter 包 `flutter analyze` 无问题，模拟 WebView 单测 6 项通过。
- 复核了整体、面料细节、主机、双区冷暖、水路透视和窄屏截图。本次尚未对新资源运行原生 iOS/Android WebView 或物理手机测试。

## 2026-09-22：Flutter 初次改造记录

以下为上一版的验证结果，iOS 原生结果针对当时的资源。`output/qa*` 中的同名截图和 JSON 已被 2026-10-28 复测覆盖，不再是这次历史检查的原始快照。

### 当时通过

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | 成功；保留 Vite 的单包超过 500 kB 提示 | 本轮命令输出；Three.js 已包含在包内 |
| `npm run export:embed` | 2,033,771 bytes，离线内嵌模型与纹理 | `output/embed/manifest.json` |
| `npm test` | 56 项通过 | `output/qa/checks.json` |
| `npm run test:mobile` | 53 项通过，0 外部 HTTP(S) 请求 | `output/qa-mobile/checks.json` |
| `npm run test:embed` | 41 项通过，0 外部 HTTP(S) 请求 | `output/qa-embed/checks.json` |
| 模拟宿主预览 | ready、控件更新、重载重放通过 | `output/qa-embed/host-checks.json` |
| `flutter analyze` | 无问题 | Flutter 包与示例工程 |
| Flutter 包测试 | 6 项通过，使用模拟 WebView 平台 | `integrations/flutter/test/thermal_3d_test.dart` |
| 示例数据测试 | 1 项通过 | `integrations/flutter/example/test/widget_test.dart` |
| iOS Debug 模拟器构建 | 成功 | Xcode 16.4；生成 Runner.app |
| 原生 WKWebView 集成测试 | 1 个完整场景通过 | `integrations/flutter/example/integration_test/thermal_3d_test.dart` |

嵌入包 SHA-256：`7125d4a98b10db5fcdc4dd803054a0d1016feedd5e8638fdc74d50ee19b1b280`。导出文件与 Flutter assets 的字节一致性由嵌入检查验证。

原生场景运行在临时 iPhone 16 / iOS 18.6 模拟器，覆盖：

- WKWebView 本地资源加载、首帧模型渲染、原生 → JS → 原生握手。
- 目标 26℃ 但实际上报加热时显示暖光；另一侧独立制冷。
- 拖动 Flutter 滑杆仅修改对应侧状态，不重建 WebView。
- 模拟断连关闭运行光效，重连恢复最新状态。
- 用户暂停保持动画相位；页面覆盖停止绘制，返回后保留暂停状态。
- WebGL context loss 自动重载并恢复最新状态。
- iOS 手动 PCF 兼容分支启用，远离模型的地面像素不出现错误阴影。

命令：

```sh
cd integrations/flutter/example
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 flutter build ios --simulator --debug --no-codesign
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 flutter test integration_test/thermal_3d_test.dart -d <模拟器ID> --reporter expanded
```

本轮实际 Flutter 3.13.9 / Dart 3.1.5，webview_flutter 4.5.0，webview_flutter_wkwebview 3.10.2。首次 CocoaPods 调用因当前终端非 UTF-8 编码失败；仅在构建命令中设置 UTF-8 后成功，未改动全局环境配置。

## 视觉复核与修复

已查看整体、面料细节、主机、双区冷暖、水路透视和窄屏截图。既有造型、标识、织物纹理、左右独立流光保留。

iOS 模拟器初次复核发现硬件深度比较产生大面积地面阴影，单纯消息/状态通过不足以发现该问题。`src/shadow-compat.js` 在 iOS 改用 GLSL 原始深度比较，保留五个 Vogel 采样点及双线性过滤；修复后原生画面显示局部投影，背景恢复。桌面继续使用硬件 PCF，未关闭阴影或降低科技光效。

- 原生模拟器画面：`output/qa-embed/ios-simulator.png`。
- 嵌入双区、主机、织物、水路截图：`output/qa-embed/`。
- 桌面整体和细节：`output/qa/`。
- 手机窄屏：`output/qa-mobile/`。

空闲渲染优化曾暴露渐变无法到达精确终点的问题，已增加渐变终点收敛及未收敛时继续绘制；暂停像素和恢复像素变化均重新验证。Shader 编译或绘制失败会回报错误，不将异常画面继续标为 ready。

## 尚未完成的外部验收

- **Android 原生构建和运行未验证**：本机 `flutter doctor -v` 报 cmdline-tools 缺失、许可证状态未知。没有自动修改用户 SDK 或代替用户处理许可。
- **物理手机未验证**：模拟器不是实际 iPhone，更不能推定 Android 的 GPU、温升、耗电、内存和低端机帧率。
- **真实设备联调未进行**：没有业务 APP 源码和设备协议；需要映射实际温度、运行状态、故障与过期规则。
- **未发布**：示例为 Debug / 模拟器工程，未配置生产签名，也未推送、上传或部署。
- 构建期预生成纹理、远程更新和可选画质档位尚未启用；现有优化首先移除不可见与空闲计算，后续以真机数据决定是否需要进一步改造。
