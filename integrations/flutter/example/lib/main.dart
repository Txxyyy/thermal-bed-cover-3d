import 'package:flutter/material.dart';
import 'package:thermal_3d/thermal_3d.dart';

void main() => runApp(const ExampleApp());
final routes = RouteObserver<ModalRoute<dynamic>>();

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        navigatorObservers: [routes],
        home: const DemoPage(),
      );
}

class DemoPage extends StatefulWidget {
  const DemoPage({super.key});
  @override
  State<DemoPage> createState() => _DemoPageState();
}

class _DemoPageState extends State<DemoPage> {
  double left = 26, right = 32;
  ThermalOperation leftOperation = ThermalOperation.heating;
  ThermalOperation rightOperation = ThermalOperation.cooling;
  ThermalCamera camera = ThermalCamera.overview;
  bool paused = false, cutaway = false, online = true;
  ThermalZoneState zone(double target, ThermalOperation operation) =>
      ThermalZoneState(
        targetTemperature: target,
        currentTemperature: null,
        operatingState: operation,
        online: online,
        stale: !online,
      );
  Widget control(
          String label,
          double value,
          ThermalOperation operation,
          ValueChanged<double> changeTemperature,
          ValueChanged<ThermalOperation> changeOperation) =>
      Column(
        children: [
          Text('$label · 目标 ${value.round()}℃'),
          Slider(
              value: value,
              min: 18,
              max: 40,
              divisions: 22,
              onChanged: changeTemperature),
          DropdownButton<ThermalOperation>(
              value: operation,
              items: ThermalOperation.values
                  .map((mode) =>
                      DropdownMenuItem(value: mode, child: Text(mode.name)))
                  .toList(),
              onChanged: (value) {
                if (value != null) changeOperation(value);
              }),
        ],
      );
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('温控床笠 · 模拟数据')),
        body: Column(children: [
          Expanded(
              child: Thermal3DView(
            state: ThermalDeviceState(
                left: zone(left, leftOperation),
                right: zone(right, rightOperation)),
            camera: camera,
            paused: paused,
            cutaway: cutaway,
            routeObserver: routes,
          )),
          Padding(
              padding: const EdgeInsets.all(12),
              child: Column(children: [
                const Text('仅演示：18–40℃ 非产品规格；运行状态由下拉框模拟上报'),
                Row(children: [
                  Expanded(
                      child: control(
                          '左侧',
                          left,
                          leftOperation,
                          (value) => setState(() => left = value),
                          (value) => setState(() => leftOperation = value))),
                  Expanded(
                      child: control(
                          '右侧',
                          right,
                          rightOperation,
                          (value) => setState(() => right = value),
                          (value) => setState(() => rightOperation = value))),
                ]),
                Wrap(spacing: 8, children: [
                  for (final view in ThermalCamera.values)
                    TextButton(
                        onPressed: () => setState(() => camera = view),
                        child: Text(view.name)),
                  TextButton(
                      onPressed: () => setState(() => cutaway = !cutaway),
                      child: const Text('水路 / 织物')),
                  TextButton(
                      onPressed: () => setState(() => paused = !paused),
                      child: Text(paused ? '继续动画' : '暂停动画')),
                  TextButton(
                      onPressed: () => setState(() => online = !online),
                      child: Text(online ? '模拟断连' : '模拟重连')),
                  TextButton(
                      onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                              builder: (_) => Scaffold(
                                  appBar:
                                      AppBar(title: const Text('返回后恢复 3D'))))),
                      child: const Text('覆盖页面')),
                ]),
              ])),
        ]),
      );
}
