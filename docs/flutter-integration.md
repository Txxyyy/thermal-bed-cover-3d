# Flutter 原生控件 + WebView 3D 接入

用户已确认 Flutter 负责操作界面，WebView 仅负责 3D。项目已提供共享渲染核心、离线嵌入资源、通信协议、Flutter 包与 Android/iOS 示例工程。实际 APP 源码和设备协议尚未提供，示例使用模拟状态，不连接真实设备。

## 交付与构建

| 路径 | 用途 |
| --- | --- |
| `src/viewer.js` | 共享场景、灯光、相机、渲染调度与销毁，无网页控件依赖 |
| `src/main.js` | 原有网页演示控件适配 |
| `src/shadow-compat.js` | iOS 深度比较兼容，保留五点 Vogel 与双线性 PCF 软阴影 |
| `src/device-state.js` | 设备状态校验和视觉映射，不使用演示温度阈值 |
| `src/embed.js` / `embed.html` | 纯 3D 入口及协议接收端 |
| `output/embed/thermal3d.html` | 自包含离线运行包，约 2 MB，无外部资源请求 |
| `output/embed/manifest.json` | 协议版本、文件大小、SHA-256 和 WebGL2 要求 |
| `integrations/flutter/` | 可作为 path dependency 引入的 Flutter 包 |
| `integrations/flutter/example/` | 原生滑杆、状态模拟、视角与页面切换示例 |
| `embed-preview.html` | 浏览器中的模拟宿主；用于接入前调试，不进入 APP |

在项目根目录执行：

```sh
npm ci
npm run build
npm run export:embed
npm run export:mobile
npm run dev
```

`export:embed` 同时更新 Flutter 包的 `assets/thermal3d.html` 和 `assets/manifest.json`，无需手工复制。之后可打开 `http://127.0.0.1:5173/embed-preview.html`。APP 加载包内资源，不依赖开发服务器。单独打开嵌入 HTML 时，未接收状态前显示无冷暖运行光效的模型，这是预期行为。

嵌入包使用已打包的普通 script，模型和图片内嵌；不是运行时从 file URL 导入多个 ES modules。程序化床笠、材质和光效保留，不能只拿主机 GLB 替代整个资源包。未来需要拆分大资源时，再实现对应平台的本地来源适配，不开启通用文件跨域访问。

## 接入现有 APP

仅接入组件不需要 Node.js，也不需要启动网页服务。将整个 `integrations/flutter` 目录复制到 APP 的 `packages/thermal_3d/`，在 APP 的 pubspec 中配置：

```yaml
dependencies:
  thermal_3d:
    path: packages/thermal_3d
```

包已声明所需 assets。APP 不需要重复声明，也不要把 `output/mobile` 中包含网页控件的演示版作为嵌入入口。

3D 页面和 WebView 使用透明背景，可叠放在 APP 自己的主题背景上。`Thermal3DView` 默认跟随 `Theme.of(context).brightness`，主题切换时更新模型受光和场景氛围，不重建 WebView；如 3D 区域使用不同主题，可传 `brightness: Brightness.light` 或 `Brightness.dark`。浅蓝 / 深色背景示例和主题切换见 `integrations/flutter/example/`；网页可运行 `npm run dev` 后打开 `/theme-preview.html` 查看。

本版默认总览以床垫为中心，主机位于画面右侧。给组件提供有明确高度的区域，并在目标手机上检查两种主题、不同屏幕比例下模型和主机是否完整；示例高度 `380` 是布局示例，不是产品规定尺寸。背景渐变由 Flutter 绘制，透明 WebView 的实际合成效果需在 Android 和 iOS 原生 WebView 上确认。

### 更新组件资源

从本仓库获取更新时，保持 `integrations/flutter/` 整个目录一致更新，尤其是 `lib/`、`pubspec.yaml` 和 `assets/`；只替换 HTML 可能导致桥接协议与组件版本不匹配。在 APP 根目录执行 `flutter pub get` 并重新构建 APP；运行中的 APP 不会自动获取本地资源更新。开发本项目时修改渲染源码后，先运行 `npm run export:embed`，该命令会同时更新独立交付文件和 Flutter 包内资源，不要手工编辑生成的 HTML。

本版资源的版本和校验值记录在 [`flutter-validation.md`](flutter-validation.md)，可与包内 `assets/manifest.json` 核对。接入前请确认包内 HTML 与 manifest 成对更新，切勿将开发服务器地址用于正式 APP。

```dart
import 'package:thermal_3d/thermal_3d.dart';

// 持久保留组件位置和 key；更新数据，不重复创建 WebView。
SizedBox(
  height: 380,
  child: Thermal3DView(
    state: ThermalDeviceState(
      left: ThermalZoneState(
        targetTemperature: 26,
        currentTemperature: 22,
        operatingState: ThermalOperation.heating,
        online: true,
        stale: false,
      ),
      right: const ThermalZoneState(), // 未知遥测默认无运行光效
    ),
    visible: true, // Offstage、非当前 Tab 等应传 false
    camera: ThermalCamera.overview,
  ),
)
```

以上温度仅为说明：目标 26℃ 且设备上报 heating 时显示暖光，与演示页的 28℃ 参考点无关。`visualIntensity` 默认 0.6，只代表美术强度，不表示功率或实测热量。

- 设备通信、指令确认、温度范围、错误提示由 APP 管理。不能用 `applied` 判断设备执行成功。
- `state` 为不可变对象；设备更新时创建新的 `ThermalDeviceState`。组件在约 80ms 窗口内合并显示更新，设备指令节流另由业务层决定。
- 当前温度或目标温度未提供时传 null；不进行 18–40℃ 裁剪。数值必须有限，真实产品范围由业务层校验。
- `online=false`、`stale=true`、`unknown/fault/idle/off` 均不显示运行光效。APP 根据设备协议自行确定遥测过期时间，并更新 `stale`；渲染器不会猜测超时阈值。
- 暂停动画不会停止真实设备，页面隐藏也不会发出设备控制指令。
- `paused=null` 时遵循 Flutter 的减少动画设置；显式传布尔值可控制展示暂停。
- `onEvent` 接收 ready、applied、ignored、error 等桥接事件；本机加载错误显示重试占位。需要自定义图片时传 `fallback` Widget。

页面覆盖监听：创建持久的 `RouteObserver<ModalRoute<dynamic>>`，注册到 `MaterialApp.navigatorObservers` 并传给 `Thermal3DView.routeObserver`。Tab、Offstage 和嵌套导航的可见性仍需宿主显式传入 `visible`。本组件自动监听 APP 前后台。

```dart
// 放在 build 之外，保持同一个 observer 实例。
final thermalRouteObserver = RouteObserver<ModalRoute<dynamic>>();

// MaterialApp(navigatorObservers: [thermalRouteObserver], ...)
// Thermal3DView(state: deviceState, routeObserver: thermalRouteObserver,
//   visible: isCurrentTab)
```

3D 区域通过 EagerGestureRecognizer 接收单指旋转和双指缩放。外层滚动页应从 3D 区域之外开始滚动；若产品要求在 3D 区域内单指滚屏，需要另行确定手势分工，不能同时把同一手势交给两个层。

## 通信协议 v1

Flutter → JS：`window.Thermal3D.receive(message)`，接收对象或 JSON 字符串。JS → Flutter：`ThermalBridge.postMessage(JSON.stringify(event))`。调试宿主可监听 `thermal3d` CustomEvent。

```json
{
  "protocolVersion": 1,
  "sessionId": "来自 ready 的当前会话",
  "id": "唯一请求标识",
  "revision": 12,
  "type": "applyState",
  "payload": {
    "zones": {
      "left": {
        "targetTemperature": 26,
        "currentTemperature": 22,
        "operatingState": "heating",
        "online": true,
        "stale": false,
        "visualIntensity": 0.6
      },
      "right": {
        "targetTemperature": null,
        "currentTemperature": null,
        "operatingState": "unknown",
        "online": false,
        "stale": true
      }
    }
  }
}
```

| 命令 | payload / 行为 |
| --- | --- |
| `hello` | 不需要 sessionId，返回当前 ready/loading；补偿通道订阅时序 |
| `applyState` | 必须包含完整左右区域；revision 为非负安全整数且递增；整体校验后原子应用 |
| `setView` | `{camera: "overview" / "detail" / "hub", cutaway: false}`；省略 cutaway 表示 false |
| `setVisible` | `{visible: true/false}`；隐藏时停止绘制及动画时钟 |
| `setTheme` | `{theme: "light" / "dark"}`；改变背景氛围与受光，不改变设备状态 |
| `setPresentation` | 可选 `{paused: true/false, glow: true/false}`；只接受这两个键 |
| `dispose` | 停止渲染、移除 canvas、释放资源；要再次展示须重新加载页面 |

消息除 hello 外必须使用本次 ready 的 sessionId。响应包含 protocolVersion、sessionId、id、type、payload。

- `ready`：模型、材质已加载并实际绘制过首帧，不等于 HTML onPageFinished。
- `applied`：指令已被渲染器接受；渐变/相机过渡可能尚未完成，更不代表设备确认。
- `ignored`：revision 重复或过期，不修改状态。
- `error`：包含 code 和 message；例如 INVALID_MESSAGE、NOT_READY、LOAD_FAILED、CONTEXT_LOST。
- APP 在 ready 前保留最新状态；ready 后重放完整状态。初始化默认 unknown/offline，绝不自动展示模拟运行状态。
- 重载产生新 sessionId，旧会话消息不能修改新页面。Flutter 封装忽略已退休会话事件。
- Flutter 组件会在新会话 ready 后重放当前主题；切换主题不代表设备状态发生变化。

## 生命周期与恢复

前后台/页面可见性和用户动画暂停分别管理；恢复可见不会取消用户暂停。正常活动状态保持浏览器刷新节奏，不以默认降帧降低光效。暂停后短暂完成材质和镜头过渡，稳定后停止绘制；不可见水路不更新粒子矩阵。

静态投影物的阴影图会复用，在主机视角和水路的投影物可见性变化时重新生成。关闭织物光效且未显示水路、没有其他可见动画时，稳定后也会停止绘制；隐藏的视觉相位在停止期间冻结，重新显示后继续，不影响真实设备状态。接入时仍须为非当前 Tab / Offstage 显式设置 `visible: false`。

Flutter 组件复用一个 controller；context lost 自动重载最多一次，重新 ready 后重放最新状态。再次失败或加载超过 30 秒显示占位和手动重试。手动重试开启新一轮恢复；销毁时清理 Timer、观察者并请求 JS dispose。

本次 iOS 18.6 模拟器的硬件深度比较出现整片地面阴影，已在 iOS 分支改用原始深度采样与 GLSL 比较，保持相同采样分布和软阴影过滤；浏览器和模拟器均检查了修复后的阴影。此兼容层依赖 Three.js 的 shader chunk 结构，升级 Three.js 时必须复测。额外纹理读取的实际耗电和帧率仍需物理设备评估。

包不访问设备、不携带账号凭证、不加载远程页面；导航只允许自身本地入口。当前首帧仍会生成织物纹理和水路场，不承诺低端机启动耗时。构建期预生成纹理、可选画质档位与远程资源更新尚未启用，需根据真机数据决定是否需要。

## 开发环境与验证

本次本机 Flutter 3.13.9 / Dart 3.1.5，依赖解析为 webview_flutter 4.5.0；pubspec 允许兼容的 4.x 版本。保留 lockfile 记录本次验证组合。没有改动本机 Flutter 安装或替现有 APP 升级依赖。样例平台工程由本机 Flutter 模板生成，不代表已经确定产品最低系统版本。

```sh
# 项目根目录；npm test 要求开发服务已启动
npm test
npm run test:mobile
npm run test:embed

# Flutter 包目录
cd integrations/flutter
flutter pub get
flutter analyze
flutter test

# Android / iOS 设备或模拟器环境完整时
cd example
flutter run

# 已连接设备或模拟器时运行真实 WebView 集成测试
flutter test integration_test/thermal_3d_test.dart -d <device-id>
```

Flutter 包测试使用模拟 WebView 平台，验证消息时序、最新状态合并、生命周期、超时、重载上限和导航边界；不会替代真实 WebView 渲染。浏览器检查和截图见 `output/qa/`、`output/qa-mobile/`、`output/qa-embed/`。本轮结果及构建限制见 `docs/flutter-validation.md`。

产品接入还需：实际 APP 版本与路由结构、Android/iOS 支持范围、代表机型，以及设备运行状态/在线状态/遥测过期规则。上线前需在这些机型验证离线首帧、持续渲染发热、内存、前后台和断连恢复，并确认视觉效果。

## 官方参考

- [webview_flutter](https://pub.dev/packages/webview_flutter)
- [WebViewController API](https://pub.dev/documentation/webview_flutter/latest/webview_flutter/WebViewController-class.html)
- [Android 本地资源](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Flutter 手势配置](https://pub.dev/documentation/webview_flutter/latest/webview_flutter/WebViewWidget/gestureRecognizers.html)
