# Flutter WebView 改造验证记录

日期：2026-09-22。当前项目改造及接入示例已完成；真实业务 APP 与真实设备协议未提供。

## 本轮通过

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
