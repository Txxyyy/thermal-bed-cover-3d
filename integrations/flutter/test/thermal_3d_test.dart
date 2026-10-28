import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:thermal_3d/thermal_3d.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

class FakeNavigation extends PlatformNavigationDelegate {
  FakeNavigation(super.params) : super.implementation();
  NavigationRequestCallback? navigation;
  PageEventCallback? finished;
  @override
  Future<void> setOnNavigationRequest(
      NavigationRequestCallback callback) async {
    navigation = callback;
  }

  @override
  Future<void> setOnPageFinished(PageEventCallback callback) async {
    finished = callback;
  }

  @override
  Future<void> setOnWebResourceError(WebResourceErrorCallback callback) async {}
}

class FakeController extends PlatformWebViewController {
  FakeController(super.params) : super.implementation();
  JavaScriptChannelParams? channel;
  FakeNavigation? navigation;
  final messages = <Map<String, dynamic>>[];
  final backgroundColors = <Color>[];
  Completer<void>? themeGate;
  int loads = 0;
  @override
  Future<void> setJavaScriptMode(JavaScriptMode mode) async {}
  @override
  Future<void> setBackgroundColor(Color color) async {
    backgroundColors.add(color);
  }

  @override
  Future<void> addJavaScriptChannel(JavaScriptChannelParams params) async {
    channel = params;
  }

  @override
  Future<void> setPlatformNavigationDelegate(
      PlatformNavigationDelegate handler) async {
    navigation = handler as FakeNavigation;
  }

  @override
  Future<void> loadFlutterAsset(String key) async {
    loads++;
  }

  @override
  Future<void> runJavaScript(String source) async {
    final start = source.indexOf('receive(') + 8;
    final message =
        jsonDecode(source.substring(start, source.lastIndexOf(');')))
            as Map<String, dynamic>;
    messages.add(message);
    if (message['type'] == 'setTheme' && themeGate != null) {
      await themeGate!.future;
    }
  }

  void event(String type, String session,
      [Map<String, Object?> payload = const {}]) {
    channel!.onMessageReceived(JavaScriptMessage(
        message: jsonEncode({
      'protocolVersion': 1,
      'sessionId': session,
      'type': type,
      'payload': payload,
    })));
  }

  List<Map<String, dynamic>> commands(String type) =>
      messages.where((e) => e['type'] == type).toList();
}

class FakeWidget extends PlatformWebViewWidget {
  FakeWidget(super.params) : super.implementation();
  @override
  Widget build(BuildContext context) => const SizedBox.expand();
}

class FakePlatform extends WebViewPlatform {
  late FakeController controller;
  int creations = 0;
  @override
  PlatformWebViewController createPlatformWebViewController(
      PlatformWebViewControllerCreationParams params) {
    creations++;
    return controller = FakeController(params);
  }

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(
          PlatformNavigationDelegateCreationParams params) =>
      FakeNavigation(params);
  @override
  PlatformWebViewWidget createPlatformWebViewWidget(
          PlatformWebViewWidgetCreationParams params) =>
      FakeWidget(params);
}

ThermalDeviceState sample(double temperature) => ThermalDeviceState(
      left: ThermalZoneState(
          targetTemperature: temperature,
          operatingState: ThermalOperation.heating,
          online: true,
          stale: false),
    );
Widget host(ThermalDeviceState state,
        {bool visible = true, bool paused = false}) =>
    MaterialApp(
        home: Scaffold(
      body: Thermal3DView(state: state, visible: visible, paused: paused),
    ));
void main() {
  late FakePlatform platform;
  setUp(() {
    platform = FakePlatform();
    WebViewPlatform.instance = platform;
  });
  test('Unknown telemetry is safe and real temperatures are not demo-clamped',
      () {
    expect(const ThermalZoneState().toJson()['stale'], true);
    expect(sample(12).toJson()['zones'], contains('left'));
    expect(sample(12).left.toJson()['targetTemperature'], 12);
    expect(() => const ThermalZoneState(targetTemperature: double.nan).toJson(),
        throwsArgumentError);
    expect(() => const ThermalZoneState(visualIntensity: 2).toJson(),
        throwsArgumentError);
  });
  testWidgets(
      'Waits for ready and sends latest state without rebuilding controller',
      (tester) async {
    await tester.pumpWidget(host(sample(22)));
    await tester.pump();
    final c = platform.controller;
    await tester.pumpWidget(host(sample(26)));
    await tester.pump(const Duration(milliseconds: 100));
    expect(c.commands('applyState'), isEmpty);
    c.event('ready', 'session-1');
    await tester.pump();
    expect(
        c.commands('applyState').last['payload']['zones']['left']
            ['targetTemperature'],
        26);
    await tester.pumpWidget(host(sample(30)));
    await tester.pumpWidget(host(sample(32)));
    await tester.pump(const Duration(milliseconds: 100));
    expect(
        c.commands('applyState').last['payload']['zones']['left']
            ['targetTemperature'],
        32);
    expect(platform.creations, 1);
    expect(c.loads, 1);
    await tester.pumpWidget(const SizedBox());
    expect(c.commands('dispose'), hasLength(1));
  });
  testWidgets('Background and host visibility preserve user pause',
      (tester) async {
    await tester.pumpWidget(host(sample(26), paused: true));
    await tester.pump();
    final c = platform.controller;
    c.event('ready', 'session-1');
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(c.commands('setVisible').last['payload']['visible'], false);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(c.commands('setPresentation').last['payload']['paused'], true);
    await tester.pumpWidget(host(sample(26), visible: false, paused: true));
    await tester.pump();
    expect(c.commands('setVisible').last['payload']['visible'], false);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('Theme follows Flutter and switches without reloading WebView',
      (tester) async {
    Widget themed(Brightness theme, {Brightness? override}) => MaterialApp(
          theme: ThemeData(brightness: theme),
          home: Scaffold(
              body: Thermal3DView(
                  state: sample(26), brightness: override, paused: true)),
        );
    await tester.pumpWidget(themed(Brightness.light));
    await tester.pump();
    final c = platform.controller;
    expect(c.backgroundColors.last, Colors.transparent);
    c.event('ready', 'theme-session');
    await tester.pump();
    expect(c.commands('setTheme').last['payload']['theme'], 'light');
    await tester.pumpWidget(themed(Brightness.dark));
    await tester.pump(const Duration(milliseconds: 250));
    expect(c.commands('setTheme').last['payload']['theme'], 'dark');
    await tester
        .pumpWidget(themed(Brightness.dark, override: Brightness.light));
    await tester.pump();
    expect(c.commands('setTheme').last['payload']['theme'], 'light');
    expect(platform.creations, 1);
    expect(c.loads, 1);
    await tester.pumpWidget(themed(Brightness.dark));
    await tester.pump(const Duration(milliseconds: 250));
    c.event(
        'error', 'theme-session', {'code': 'CONTEXT_LOST', 'message': 'lost'});
    await tester.pump();
    expect(c.loads, 2);
    c.event('ready', 'theme-session-2');
    await tester.pump();
    expect(c.commands('setTheme').last['payload']['theme'], 'dark');
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('A theme change before ready sends the latest brightness',
      (tester) async {
    Widget themed(Brightness brightness) => MaterialApp(
          theme: ThemeData(brightness: brightness),
          home: Scaffold(body: Thermal3DView(state: sample(26))),
        );
    await tester.pumpWidget(themed(Brightness.light));
    await tester.pump();
    final c = platform.controller;
    await tester.pumpWidget(themed(Brightness.dark));
    await tester.pump(const Duration(milliseconds: 250));
    expect(c.commands('setTheme'), isEmpty);
    c.event('ready', 'theme-pending');
    await tester.pump();
    expect(c.commands('setTheme').last['payload']['theme'], 'dark');
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('Context recovery is bounded and ignores retired sessions',
      (tester) async {
    await tester.pumpWidget(host(sample(26)));
    await tester.pump();
    final c = platform.controller;
    c.event('ready', 'session-1');
    await tester.pump();
    c.event('error', 'session-1', {'code': 'CONTEXT_LOST', 'message': 'lost'});
    await tester.pump();
    expect(c.loads, 2);
    c.event('ready', 'session-1');
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpWidget(host(sample(31)));
    await tester.pump(const Duration(milliseconds: 100));
    c.event('ready', 'session-2');
    await tester.pump();
    expect(c.commands('setTheme').last['payload']['theme'], 'light');
    expect(c.commands('setTheme'), hasLength(2));
    expect(
        c.commands('applyState').last['payload']['zones']['left']
            ['targetTemperature'],
        31);
    await tester.pumpWidget(host(sample(33)));
    await tester.pump(const Duration(milliseconds: 100));
    expect(
        c.commands('applyState').last['payload']['zones']['left']
            ['targetTemperature'],
        33);
    c.event('error', 'session-2',
        {'code': 'CONTEXT_LOST', 'message': 'lost again'});
    await tester.pump();
    expect(c.loads, 2);
    expect(find.text('重新加载'), findsOneWidget);
    await tester.tap(find.text('重新加载'));
    await tester.pump();
    expect(c.loads, 3);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('No ready signal produces a retryable timeout', (tester) async {
    await tester.pumpWidget(host(sample(26)));
    await tester.pump();
    await tester.pump(const Duration(seconds: 31));
    expect(find.text('重新加载'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('A stalled initial theme remains covered and times out',
      (tester) async {
    await tester.pumpWidget(host(sample(26)));
    await tester.pump();
    final c = platform.controller;
    c.themeGate = Completer<void>();
    c.event('ready', 'theme-stalled');
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pump(const Duration(seconds: 31));
    expect(find.text('重新加载'), findsOneWidget);
    c.themeGate!.complete();
    await tester.pump();
    expect(find.text('重新加载'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('External navigation is blocked', (tester) async {
    await tester.pumpWidget(host(sample(26)));
    await tester.pump();
    final callback = platform.controller.navigation!.navigation!;
    expect(
        await callback(const NavigationRequest(
            url: 'https://example.com', isMainFrame: true)),
        NavigationDecision.prevent);
    expect(
        await callback(const NavigationRequest(
            url: 'file:///private/other.html', isMainFrame: true)),
        NavigationDecision.prevent);
    expect(
        await callback(const NavigationRequest(
            url:
                'file:///flutter_assets/packages/thermal_3d/assets/thermal3d.html',
            isMainFrame: true)),
        NavigationDecision.navigate);
    await tester.pumpWidget(const SizedBox());
  });
}
