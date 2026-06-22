import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static final SocketService _instance = SocketService._();
  factory SocketService() => _instance;
  SocketService._();

  IO.Socket? _socket;
  String _serverUrl = 'https://app.infovibex.com';
  bool get isConnected => _socket?.connected ?? false;
  String get serverUrl => _serverUrl;

  final ValueNotifier<String?> connectionError = ValueNotifier(null);
  final ValueNotifier<bool> connectionState = ValueNotifier(false);

  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  static const int _maxReconnectDelay = 30;

  String? _pendingUserId;
  String? _pendingUserName;
  bool _pendingIsClient = false;

  void setServerUrl(String url) {
    _serverUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  void connect(String userId, String userName, {bool isClient = false}) {
    _pendingUserId = userId;
    _pendingUserName = userName;
    _pendingIsClient = isClient;

    if (_socket != null) {
      if (_socket!.connected) return;
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _reconnectAttempt = 0;

    final query = <String, String>{'userId': userId, 'userName': userName};
    if (isClient) query['isClient'] = 'true';
    _socket = IO.io(_serverUrl, IO.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setPath('/socket.io/')
      .setQuery(query)
      .enableAutoConnect()
      .setReconnectionAttempts(20)
      .build());
    _socket!
      ..onConnect((_) {
        connectionError.value = null;
        connectionState.value = true;
        _reconnectAttempt = 0;
      })
      ..onDisconnect((_) {
        connectionState.value = false;
        _scheduleReconnect();
      })
      ..onConnectError((error) {
        connectionError.value = error.toString();
        connectionState.value = false;
        _scheduleReconnect();
      })
      ..onError((error) {
        connectionError.value = error.toString();
      });
    _socket!.connect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    if (_pendingUserId == null) return;
    _reconnectAttempt++;
    final delay = (_reconnectAttempt * 2).clamp(1, _maxReconnectDelay);
    _reconnectTimer = Timer(Duration(seconds: delay), () {
      if (_pendingUserId != null) {
        debugPrint('[Socket] Reconnecting (attempt $_reconnectAttempt, delay ${delay}s)...');
        connect(_pendingUserId!, _pendingUserName!, isClient: _pendingIsClient);
      }
    });
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _pendingUserId = null;
    _pendingUserName = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    connectionState.value = false;
    connectionError.value = null;
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void Function() on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
    return () => _socket?.off(event);
  }

  void off(String event) {
    _socket?.off(event);
  }
}
