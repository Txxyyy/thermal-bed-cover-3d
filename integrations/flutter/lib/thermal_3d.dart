library thermal_3d;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

enum ThermalOperation { heating, cooling, idle, off, unknown, fault }

enum ThermalCamera { overview, detail, hub }

@immutable
class ThermalZoneState {
  const ThermalZoneState({
    this.targetTemperature,
    this.currentTemperature,
    this.operatingState = ThermalOperation.unknown,
    this.online = false,
    this.stale = true,
    this.visualIntensity = .6,
  });
  final double? targetTemperature;
  final double? currentTemperature;
  final ThermalOperation operatingState;
  final bool online;
  final bool stale;

  /// Presentation strength, not measured thermal output or device power.
  final double visualIntensity;

  Map<String, Object?> toJson() {
    if ((targetTemperature != null && !targetTemperature!.isFinite) ||
        (currentTemperature != null && !currentTemperature!.isFinite) ||
        !visualIntensity.isFinite ||
        visualIntensity < 0 ||
        visualIntensity > 1) {
      throw ArgumentError('Invalid temperature or visual intensity');
    }
    return {
      'targetTemperature': targetTemperature,
      'currentTemperature': currentTemperature,
      'operatingState': operatingState.name,
      'online': online,
      'stale': stale,
      'visualIntensity': visualIntensity,
    };
  }
}

@immutable
class ThermalDeviceState {
  const ThermalDeviceState({
    this.left = const ThermalZoneState(),
    this.right = const ThermalZoneState(),
  });
  final ThermalZoneState left;
  final ThermalZoneState right;
  Map<String, Object?> toJson() => {
        'zones': {'left': left.toJson(), 'right': right.toJson()},
      };
}

/// The host owns device communication and must mark expired telemetry stale.
/// Pass visible=false for inactive tabs/Offstage; use routeObserver for routes.
class Thermal3DView extends StatefulWidget {
  const Thermal3DView({
    super.key,
    required this.state,
    this.visible = true,
    this.camera = ThermalCamera.overview,
    this.cutaway = false,
    this.paused,
    this.glow = true,
    this.routeObserver,
    this.onEvent,
    this.fallback,
  });
  final ThermalDeviceState state;
  final bool visible;
  final ThermalCamera camera;
  final bool cutaway;
  final bool? paused;
  final bool glow;
  final RouteObserver<ModalRoute<dynamic>>? routeObserver;
  final ValueChanged<Map<String, dynamic>>? onEvent;
  final Widget? fallback;

  @override
  State<Thermal3DView> createState() => _Thermal3DViewState();
}

class _Thermal3DViewState extends State<Thermal3DView>
    with WidgetsBindingObserver, RouteAware {
  static const _asset = 'packages/thermal_3d/assets/thermal3d.html';
  late final WebViewController _controller;
  Timer? _timeout;
  Timer? _stateTimer;
  String? _session;
  final Set<String> _retiredSessions = {};
  bool _ready = false,
      _closed = false,
      _routeVisible = true,
      _appVisible = true;
  String? _error;
  int _sequence = 0, _revision = 0, _recoveries = 0, _loadEpoch = 0;
  ModalRoute<dynamic>? _route;
  RouteObserver<ModalRoute<dynamic>>? _observer;
  bool get _visible => widget.visible && _routeVisible && _appVisible;
  bool get _paused =>
      widget.paused ??
      (MediaQuery.maybeOf(context)?.disableAnimations ?? false);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final life = WidgetsBinding.instance.lifecycleState;
    _appVisible = life == null || life == AppLifecycleState.resumed;
    _controller = WebViewController();
    unawaited(_configure());
  }

  Future<void> _configure() async {
    try {
      await _controller.setJavaScriptMode(JavaScriptMode.unrestricted);
      await _controller.setBackgroundColor(const Color(0xffeeede8));
      await _controller.addJavaScriptChannel('ThermalBridge',
          onMessageReceived: _message);
      await _controller.setNavigationDelegate(NavigationDelegate(
        // This bundle contains no links or external resource dependencies.
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          final localEntry =
              uri?.scheme == 'file' && uri!.path.endsWith('/$_asset');
          return localEntry
              ? NavigationDecision.navigate
              : NavigationDecision.prevent;
        },
        onPageFinished: (_) {
          unawaited(_hello());
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame != false)
            _fail('页面加载失败：${error.description}');
        },
      ));
      if (!_closed) await _load();
    } catch (error) {
      _fail('3D 初始化失败：$error');
    }
  }

  Future<void> _load() async {
    if (_closed) return;
    final epoch = ++_loadEpoch;
    if (_session != null) _retiredSessions.add(_session!);
    _session = null;
    _stateTimer?.cancel();
    _stateTimer = null;
    _timeout?.cancel();
    setState(() {
      _ready = false;
      _error = null;
    });
    _timeout = Timer(const Duration(seconds: 30), () {
      if (!_closed && !_ready && epoch == _loadEpoch) _fail('3D 加载超时，可重试');
    });
    try {
      await _controller.loadFlutterAsset(_asset);
    } catch (error) {
      if (epoch == _loadEpoch) _fail('3D 资源加载失败：$error');
    }
  }

  Future<void> _hello() async {
    if (_closed || _error != null) return;
    try {
      final message = jsonEncode({
        'protocolVersion': 1,
        'id': 'hello-${++_sequence}',
        'type': 'hello'
      });
      await _controller.runJavaScript(
          'window.Thermal3D && window.Thermal3D.receive($message);');
    } catch (error) {
      _fail('3D 通信失败：$error');
    }
  }

  void _message(JavaScriptMessage message) {
    if (_closed) return;
    try {
      final event = jsonDecode(message.message) as Map<String, dynamic>;
      if (event['protocolVersion'] != 1 || event['sessionId'] is! String)
        return;
      final session = event['sessionId'] as String;
      if (_retiredSessions.contains(session)) return;
      if (event['type'] == 'ready') {
        if (_error != null) return;
        if (_ready && _session == session) return;
        _session = session;
        _timeout?.cancel();
        setState(() {
          _ready = true;
          _error = null;
        });
        _syncAll();
      } else if (event['type'] == 'error') {
        if (_session != null && _session != session) return;
        final payload = event['payload'] as Map<String, dynamic>;
        if (payload['code'] == 'CONTEXT_LOST' && _recoveries++ == 0) {
          unawaited(_load());
        } else {
          _fail('3D 显示异常：${payload['message']}');
        }
      } else if (_session != null && _session != session) {
        return;
      }
      widget.onEvent?.call(event);
    } catch (error) {
      _fail('3D 消息格式异常：$error');
    }
  }

  Future<void> _send(String type, Map<String, Object?> payload,
      {int? revision}) async {
    if (_closed || !_ready || _session == null) return;
    final session = _session;
    try {
      final message = jsonEncode({
        'protocolVersion': 1,
        'sessionId': session,
        'id': 'flutter-${++_sequence}',
        'type': type,
        'payload': payload,
        if (revision != null) 'revision': revision,
      });
      await _controller.runJavaScript('window.Thermal3D.receive($message);');
    } catch (error) {
      if (session == _session) _fail('3D 状态同步失败：$error');
    }
  }

  void _syncState() {
    try {
      unawaited(
          _send('applyState', widget.state.toJson(), revision: ++_revision));
    } catch (error) {
      _fail('设备状态格式错误：$error');
    }
  }

  void _syncVisibility() {
    unawaited(_send('setVisible', {'visible': _visible}));
  }

  void _syncPresentation() {
    unawaited(
        _send('setPresentation', {'paused': _paused, 'glow': widget.glow}));
  }

  void _syncView() {
    unawaited(_send(
        'setView', {'camera': widget.camera.name, 'cutaway': widget.cutaway}));
  }

  void _syncAll() {
    _syncVisibility();
    _syncState();
    _syncPresentation();
    _syncView();
  }

  void _fail(String message) {
    if (_closed || !mounted) return;
    _timeout?.cancel();
    _stateTimer?.cancel();
    _stateTimer = null;
    final session = _session;
    final wasReady = _ready;
    if (session != null) _retiredSessions.add(session);
    _session = null;
    setState(() {
      _error = message;
      _ready = false;
    });
    if (wasReady && session != null) {
      final envelope = jsonEncode({
        'protocolVersion': 1,
        'sessionId': session,
        'id': 'hide-error',
        'type': 'setVisible',
        'payload': {'visible': false}
      });
      unawaited(_controller
          .runJavaScript(
              'window.Thermal3D && window.Thermal3D.receive($envelope);')
          .catchError((Object _) {}));
    }
  }

  @override
  void didUpdateWidget(covariant Thermal3DView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.routeObserver != widget.routeObserver) _subscribe();
    if (oldWidget.state != widget.state) {
      // Coalesce display updates; actual device-command throttling belongs to the host.
      _stateTimer ??= Timer(const Duration(milliseconds: 80), () {
        _stateTimer = null;
        _syncState();
      });
    }
    if (oldWidget.visible != widget.visible) _syncVisibility();
    if (oldWidget.camera != widget.camera ||
        oldWidget.cutaway != widget.cutaway) _syncView();
    if (oldWidget.paused != widget.paused || oldWidget.glow != widget.glow)
      _syncPresentation();
  }

  void _subscribe() {
    final next = ModalRoute.of(context);
    if (_route == next && _observer == widget.routeObserver) return;
    _observer?.unsubscribe(this);
    _route = next;
    _observer = widget.routeObserver;
    if (next != null) _observer?.subscribe(this, next);
    _routeVisible = next?.isCurrent ?? true;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribe();
    _syncVisibility();
    _syncPresentation();
  }

  @override
  void didPushNext() {
    _routeVisible = false;
    _syncVisibility();
  }

  @override
  void didPopNext() {
    _routeVisible = true;
    _syncAll();
  }

  @override
  void didPush() {
    _routeVisible = true;
    _syncVisibility();
  }

  @override
  void didPop() {
    _routeVisible = false;
    _syncVisibility();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appVisible = state == AppLifecycleState.resumed;
    if (_appVisible) {
      _syncAll();
    } else {
      _syncVisibility();
    }
  }

  @override
  void dispose() {
    if (_session != null) {
      final message = jsonEncode({
        'protocolVersion': 1,
        'sessionId': _session,
        'id': 'dispose',
        'type': 'dispose'
      });
      unawaited(_controller
          .runJavaScript(
              'window.Thermal3D && window.Thermal3D.receive($message);')
          .catchError((Object _) {}));
    }
    _closed = true;
    _timeout?.cancel();
    _stateTimer?.cancel();
    _stateTimer = null;
    _observer?.unsubscribe(this);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(fit: StackFit.expand, children: [
        WebViewWidget(controller: _controller, gestureRecognizers: {
          Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
        }),
        if (!_ready)
          ColoredBox(
              color: const Color(0xffeeede8),
              child: Center(
                child: _error == null
                    ? const CircularProgressIndicator()
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          widget.fallback ??
                              const Icon(Icons.bed_outlined, size: 72),
                          const Text('3D 暂不可用，设备操作仍可继续'),
                          TextButton(
                              onPressed: () {
                                _recoveries = 0;
                                unawaited(_load());
                              },
                              child: const Text('重新加载')),
                        ],
                      ),
              )),
      ]);
}
