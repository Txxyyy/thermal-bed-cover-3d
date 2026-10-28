# thermal_3d

离线 Three.js 床笠渲染组件；Flutter 负责控件和业务，WebView 负责 3D。

完整接入、协议和生命周期说明见 [接入文档](../../docs/flutter-integration.md)。本包提供 `Thermal3DView`、`ThermalDeviceState`、`ThermalZoneState`、`ThermalOperation` 和 `ThermalCamera`。

```sh
flutter pub get
flutter analyze
flutter test
cd example
flutter run
```

在仓库根目录运行 `npm run export:embed` 会更新本包 assets。更新网页代码或模型后必须重新导出，再构建 APP。

`example` 是模拟设备数据的 Android/iOS 工程，不包含真实设备通信。3D 区域使用固定尺寸或 Expanded；请正确设置页面可见性，支持 WebGL2 的真实设备仍需验证。

3D WebView 背景透明，默认跟随 Flutter 的深浅主题；`brightness` 可覆盖当前主题。宿主负责提供页面背景，示例含背景渐变与主题切换。
