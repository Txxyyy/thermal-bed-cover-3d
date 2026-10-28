# 项目约定

- 目标：基于用户主机 STEP 与 ID 文件，制作温控床笠 Three.js 模型及冷暖水循环动画。
- 用户确认上传文件是主机，床笠暂无设计图；授权原创高级织物床笠与床垫组合，并参考 Eight Sleep 的贴合外观。
- `references/source/` 是原始资料副本，保留原文不改；`public/models/` 是运行模型；临时转换在 `tmp/`。
- `src/model.js` 定义床笠几何／动画，`src/materials.js` 定义床笠织物，`src/controller.js` 定义 CAD 主机材质／曲面 UV，`src/viewer.js` 定义共享场景与生命周期，`src/main.js` 适配网页演示控件。
- 尺寸、接口、水路、生产材质和 APP 架构的事实／假设边界见 `docs/product-input.md`；未经确认不得把概念方案写为产品规格。
- Node.js 24；安装 `npm ci`，开发 `npm run dev`，构建 `npm run build`。
- 主机重建命令 `npm run convert:controller`。不要手改 GLB、`dist/` 或 `node_modules/`；修改生成脚本再生成。
- `npm test` 对已运行的本机服务执行 Chrome 无头验证；可设 `THERMAL_TEST_URL`。验证结束必须关闭浏览器。
- 模型或动画修改需构建、浏览器行为验证与整体／细节／主机／冷暖／窄屏截图复核；测试记录见 `output/qa/checks.json`。
- 浏览器验证不能替代真实 APP WebView、移动设备性能或产品外观验收。
- `npm run export:mobile` 生成内嵌模型和纹理的独立 HTML；`npm run preview:mobile` 仅服务 `output/mobile` 中的预览页面，默认端口 5180。改动运行代码或模型后须重新导出。
- `npm run test:mobile` 以断网 `file://` 和手机触摸模拟验证独立 HTML；截图与记录在 `output/qa-mobile/`。不要把模拟触摸描述为真机验收。
- 项目内安装 `.agents/skills/img2threejs/`；本轮仅用于既有 CAD 的图像／材质／诊断模块，未完成全流程门禁。事实边界和证据见 `docs/controller-refinement.md`。
- 相机控件用 `button[data-camera]` 选择；`.stage[data-camera]` 仅用于布局，不应绑定相机点击事件。
- 用户已确认左右独立温控。`src/thermal.js` 保存演示范围，`src/thermal-glow.js` 负责织物光效，`src/thermal-controls.js` 是桌面／手机共用控件。不可把暂定 18–40℃ 范围写成已确认产品规格。
- 调温／光效改动须验证另一侧状态不变、单侧待机、暂停、真实渲染像素变化，以及导出 HTML 中的手机手势；`scripts/zone-checks.mjs` 为两端共用检查。
- 织物流光与透视水路共用 `src/model.js` 的 `circuitCurves`；`src/thermal-route.js` 生成距离／弧长纹理。修改走线应保持两种视图一致，纹理由织物材质的 dispose 事件释放。`scripts/check-thermal-route.mjs` 随 `npm test` 验证坐标、弯道、方向和双区通道。
- 主机正面为带状态灯的局部 -X 窄面，背面为带格栅／凹槽的 +X 窄面，背面接管方向已由用户确认。Logo 应在正面与状态灯中轴对齐，软管末端使用 `controller.hoseAnchor`，不要再接回正面。具体接头尺寸和槽内位置仍为概念；`scripts/check-controller-placement.mjs` 为桌面／离线 HTML 共用验证。
- 默认主机摆在床头右侧枕头附近，`HUB_POSITION=(1.35,0,-0.75)`、`HUB_YAW=π/2`，正面仍朝世界 +Z（床尾）。床笠管口在床头正中（-Z），软管绕床头后方连接主机背部，展示外径由 48 mm 调细为 26 mm；具体尺寸仍为概念。镜头方位和接管使用同一摆放变换，主机避让转回局部坐标检查；同步验证软管避让床体、四条芯管包含关系与双区汇管连续性。床笠原织标位置显示 `DeRUCCI`，字号需在面料细节视角完整可见。

- Flutter 分工已确认：原生控件和设备状态由 Flutter 管理，WebView 只负责 3D。`src/embed.js` 为纯 3D 入口；`src/device-state.js` 以设备上报 operatingState 映射冷暖，不能用演示温度阈值判断真实运行状态。
- `npm run export:embed` 生成 `output/embed/thermal3d.html` 和 manifest，并同步 Flutter 包 assets；运行源码或模型变化后必须重新导出。`npm run test:embed` 验证离线桥接、状态原子性、生命周期、像素、手势及资源销毁，记录在 `output/qa-embed/`。
- `integrations/flutter/` 为组件包，`example/` 为模拟状态的 Android/iOS 示例。包内运行 `flutter analyze`、`flutter test`；模拟 WebView 测试不能称为原生渲染或设备联调通过。接入与当前验证边界见 `docs/flutter-integration.md`、`docs/flutter-validation.md`。
- `src/shadow-compat.js` 为 iOS 深度比较兼容层，保留原 PCF 采样分布；不要删除织物 `onBeforeCompile`，阴影补丁必须组合原回调。升级 Three.js 须复测 shader chunk 与 iOS 地面透明区域；`example/integration_test/thermal_3d_test.dart` 覆盖原生 WKWebView 加载、状态、页面覆盖和上下文恢复。
- 床笠顶面与围边共用顶面边界，围边首尾顶点和法线必须闭合；`scripts/check-cover-geometry.mjs` 随 `npm test` 检查连接、闭合和床垫避让。数值仅用于概念模型，不代表生产尺寸。
- 方向光阴影图按投影物可见性变化更新；新增或移动投影物、灯光或其变换时须主动使阴影失效，并检查主机、水路、页面隐藏恢复与 iOS 阴影分支。默认保持原画质和刷新节奏。
- Flutter 嵌入页保持透明以融入宿主背景；`setTheme` 和 `Thermal3DView.brightness` 同步深浅主题及受光，主题切换不得重建 WebView 或改变左右设备状态。`theme-preview.html` 是网页模拟界面，不是真实设备 APP。
