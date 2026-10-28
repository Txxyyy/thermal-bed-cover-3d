import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:thermal_3d_example/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
      'Native WebView loads offline bundle and follows Flutter controls',
      (tester) async {
    app.main();
    await tester.pump();
    final controller = tester
        .widget<WebViewWidget>(find.byType(WebViewWidget))
        .platform
        .params
        .controller;
    Future<Map<String, dynamic>> snapshot() async {
      final result = await controller.runJavaScriptReturningResult(
          'JSON.stringify(window.__thermalStudio?.snapshot() ?? {})');
      return jsonDecode(result as String) as Map<String, dynamic>;
    }

    Future<Map<String, dynamic>> waitFor(
        bool Function(Map<String, dynamic>) predicate) async {
      for (var attempt = 0; attempt < 200; attempt++) {
        await tester.pump(const Duration(milliseconds: 150));
        try {
          final state = await snapshot();
          if (predicate(state)) return state;
        } catch (_) {}
      }
      throw TestFailure('Timed out waiting for native WebView state');
    }

    var state = await waitFor(
        (s) => s['ready'] == true && s['zones']?['left']?['mode'] == 'warm');
    final themeSession = state['sessionId'];
    await tester.tap(find.byTooltip('切换主题'));
    state = await waitFor((s) => s['theme'] == 'dark');
    expect(state['sessionId'], themeSession);
    await tester.tap(find.byTooltip('切换主题'));
    state = await waitFor((s) => s['theme'] == 'light');
    expect(state['render']['triangles'], greaterThan(12000));
    expect(
        state['shadowSampling'],
        defaultTargetPlatform == TargetPlatform.iOS
            ? 'manual-pcf'
            : 'hardware-pcf');
    await controller.runJavaScript(
        "requestAnimationFrame(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2'),p=new Uint8Array(4);g.readPixels(Math.floor(c.width/2),Math.floor(c.height*.05),1,1,g.RGBA,g.UNSIGNED_BYTE,p);window.__shadowProbe=p[3];});");
    await tester.pump(const Duration(milliseconds: 400));
    expect(
        await controller.runJavaScriptReturningResult('window.__shadowProbe'),
        lessThan(5));
    expect(state['zones']['left']['temperature'], 26);
    expect(state['zones']['right']['mode'], 'cool');
    final right = state['zones']['right']['temperature'];
    await tester.drag(find.byType(Slider).first, const Offset(40, 0));
    state = await waitFor((s) => s['zones']?['left']?['temperature'] != 26);
    expect(state['zones']['right']['temperature'], right);
    expect(state['zones']['left']['mode'], 'warm');
    await tester.tap(find.text('模拟断连'));
    await waitFor((s) =>
        s['zones']?['left']?['mode'] == 'off' &&
        s['zones']?['right']?['mode'] == 'off');
    await tester.tap(find.text('模拟重连'));
    await waitFor((s) => s['zones']?['left']?['mode'] == 'warm');
    await tester.tap(find.text('暂停动画'));
    state = await waitFor((s) => s['paused'] == true);
    final phase = state['zones']['left']['phase'];
    await tester.pump(const Duration(milliseconds: 400));
    expect((await snapshot())['zones']['left']['phase'], phase);
    await tester.tap(find.text('覆盖页面'));
    await tester.pumpAndSettle();
    state = await waitFor((s) => s['visible'] == false);
    final frames = state['frames'];
    await tester.pump(const Duration(milliseconds: 400));
    expect((await snapshot())['frames'], frames);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await waitFor((s) => s['visible'] == true && s['paused'] == true);
    final oldSession = (await snapshot())['sessionId'];
    await controller.runJavaScript(
        "document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();");
    state = await waitFor((s) =>
        s['ready'] == true &&
        s['sessionId'] != oldSession &&
        s['zones']?['left']?['mode'] == 'warm');
    expect(state['paused'], true);
    // Leave a visible native result for simulator screenshots after the test.
    await tester.tap(find.text('继续动画'));
    await tester.pump(const Duration(seconds: 2));
  });
}
