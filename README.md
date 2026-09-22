# 温控床笠 3D Studio

温控床笠与主机的 Three.js 交互模型，支持左右独立冷暖流光、水路透视、视角切换和触摸操作。APP 采用 **Flutter 原生控件 + WebView 纯 3D**：Flutter 管理业务和设备通信，本项目提供离线渲染组件。

## Flutter 同事从这里开始

交付入口为 [`integrations/flutter`](integrations/flutter)，包名 `thermal_3d`。包内已经包含约 2 MB 的离线 HTML、模型和纹理，**仅接入 Flutter 时无需安装 Node.js、运行网页服务或重新导出资源**。需要支持 WebGL2 的 WebView。

1. 获取本仓库后，将整个 `integrations/flutter` 目录复制到 APP 的 `packages/thermal_3d/`，保留 `lib`、`assets` 和 `pubspec.yaml`。
2. 在 APP 的 `pubspec.yaml` 添加依赖，并执行 `flutter pub get`：

```yaml
dependencies:
  flutter:
    sdk: flutter
  thermal_3d:
    path: packages/thermal_3d
```

3. 在具有明确尺寸的区域放入组件：

```dart
import 'package:thermal_3d/thermal_3d.dart';

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
      right: const ThermalZoneState(),
    ),
    camera: ThermalCamera.overview,
    visible: true,
  ),
)
```

示例数据仅用于说明。真实 APP 应把设备上报映射为新的、包含左右两侧的 `ThermalDeviceState`，维持组件位置和 key，不随滑杆拖动反复创建 WebView。资源已在包内声明，宿主无需重复注册 assets。

4. 运行原生示例，检查所在平台的 WebView 与手势：

```sh
cd integrations/flutter/example
flutter pub get
flutter run
```

示例包含 Flutter 滑杆、运行状态模拟、镜头、暂停、断连与页面覆盖操作，不连接设备。完整 API、桥接协议、生命周期与恢复策略见 [Flutter 接入文档](docs/flutter-integration.md)。

### 业务接入必须对齐

| 内容 | 宿主 APP 的责任 |
| --- | --- |
| 温度和设备指令 | 原生控件负责输入、范围校验、发送与设备确认；3D 的 `applied` 只确认渲染器接受消息 |
| 冷暖状态 | 用实际 `heating/cooling` 状态驱动；不能通过目标温度猜测设备正在加热或制冷 |
| 断连与过期 | 正确提供 `online`、`stale`；未知、故障、待机、关闭、离线或过期均无运行光效 |
| 页面可见性 | 非当前 Tab / Offstage 传 `visible: false`；路由覆盖使用持久的 `RouteObserver`，详见接入文档 |
| 手势 | 3D 区域接收旋转与缩放；滚动页面从 3D 区域外起手 |
| 错误处理 | 组件提供重试占位，也可传 `fallback`；设备错误提示仍由 APP 管理 |

初始未知状态没有运行光效；暂停动画不会停止真实设备。演示页的 18–40℃ 与 28℃ 中性点只是美术演示参数，不是产品温度规格。

### 环境与验收范围

本次验证组合为 Flutter 3.13.9 / Dart 3.1.5 / webview_flutter 4.5.0。包声明允许兼容的 4.x 依赖，宿主最终解析的版本需重新验证；示例模板不代表产品最低 Android/iOS 版本。Android 需启用硬件加速；iOS 需完整 Xcode / CocoaPods 环境。无法创建 WebGL2 时使用组件错误占位。

已通过浏览器行为检查、离线包检查、Flutter 模拟平台单测，以及 iOS 18.6 模拟器中的真实 WKWebView 集成场景。**Android 原生运行、物理手机性能与真实设备联调尚未验收**。上线前还需检查代表机型上的首帧、持续运行发热、内存、前后台和断连恢复。完整证据与限制见 [验证记录](docs/flutter-validation.md)。

## 修改模型或光效

Node.js 24（见 `.nvmrc`），在仓库根目录执行：

```sh
npm ci
npm run dev
```

开发服务提供桌面演示 `/`、手机演示 `/mobile.html` 和模拟 APP 宿主 `/embed-preview.html`。后者用于调试桥接，真正 APP 使用包内本地资源。不要将带网页控件的手机演示作为 APP 嵌入入口，也不能用主机 GLB 代替完整床笠场景。

修改运行代码、模型或纹理后：

```sh
npm run build
npm run export:embed
npm run export:mobile
# 保持另一终端的 npm run dev 运行
npm test
npm run test:mobile
npm run test:embed
```

`export:embed` 自动同步 `output/embed/` 与 `integrations/flutter/assets/`。提交时一起提交源码、导出的 HTML 与 manifest；Flutter 同事更新依赖后重新构建 APP。不要手工编辑生成的 HTML、GLB、`dist` 或 `node_modules`。

Flutter 组件变更另需验证：

```sh
cd integrations/flutter
flutter pub get
flutter analyze
flutter test
cd example
flutter test
flutter test integration_test/thermal_3d_test.dart -d <device-id>
```

`npm test` 默认访问 `http://127.0.0.1:5173`，可通过 `THERMAL_TEST_URL` 修改；浏览器检查使用本机 Chrome。运行原生集成测试需要已连接设备或启动的模拟器。源码不变时，现有截图记录可作为参考，不能替代新宿主的验收。

## 目录导航

| 路径 | 用途 |
| --- | --- |
| `integrations/flutter/` | Flutter 包、离线 assets、原生示例与测试 |
| `src/viewer.js` | 共享场景、渲染调度和资源释放 |
| `src/embed.js` / `src/device-state.js` | 桥接协议和设备状态映射 |
| `src/model.js` / `src/materials.js` | 床笠、床垫、管路几何和织物材质 |
| `src/controller.js` | CAD 主机材质、标识与状态灯 |
| `src/thermal-glow.js` / `src/thermal-route.js` | 双区流光与共用水路 |
| `src/shadow-compat.js` | iOS 软阴影兼容；升级 Three.js 时需复测 |
| `public/models/` / `public/textures/` | 网页运行模型和本地纹理 |
| `references/source/` | 原始 STEP 与 ID PDF 保留副本，不放入网页公开目录 |
| `output/embed/` | 可独立交付的嵌入 HTML 与校验 manifest |
| `output/qa*/` | 本轮自动检查记录与截图 |
| [产品输入与边界](docs/product-input.md) | 已确认输入、概念设计与待确认事项 |
| [主机细节记录](docs/controller-refinement.md) | CAD 材质与细节优化依据 |

`npm run convert:controller` 可从原始 STEP 重建主机；`npm run preview:mobile` 服务导出的手机演示，默认端口 5180。源模型、材质与离线运行资源随项目交付；本机工具缓存、构建目录和历史诊断中间文件不纳入版本管理。

主机几何来自设计文件，材质参考 ID PDF；床笠、床垫、软管及接口仍为概念方案，不代表已确认生产尺寸。项目不包含真实设备通信、账号凭证、生产签名或业务 APP。
