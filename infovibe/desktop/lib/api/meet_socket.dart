import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class MeetSocketService {
  static final MeetSocketService _instance = MeetSocketService._();
  factory MeetSocketService() => _instance;
  MeetSocketService._();

  IO.Socket? _socket;
  final String _serverUrl = 'https://meet.infovibex.com';
  bool get isConnected => _socket?.connected ?? false;
  String get serverUrl => _serverUrl;

  final ValueNotifier<String?> connectionError = ValueNotifier(null);
  final Map<String, List<Function>> _listeners = {};
  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  static const int _maxReconnectDelay = 30;

  String? _pendingUserId;
  String? _pendingUserName;
  bool _pendingIsClient = false;
  void connect({String? userId, String? userName, bool isClient = false}) {
    if (_socket != null && _socket!.connected &&
        _pendingUserId == userId && _pendingUserName == userName) {
      return;
    }
    _pendingUserId = userId;
    _pendingUserName = userName;
    _pendingIsClient = isClient;
    _reconnectAttempt = 0;

    disconnect();
    final query = <String, String>{};
    if (userId != null) query['userId'] = userId;
    if (userName != null) query['userName'] = userName;
    if (isClient) query['isClient'] = 'true';
    _socket = IO.io(_serverUrl, IO.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setPath('/socket.io/')
      .setQuery(query)
      .enableAutoConnect()
      .build());
    _socket!
      ..onConnect((_) {
        connectionError.value = null;
        _reconnectAttempt = 0;
      })
      ..onDisconnect((_) => _scheduleReconnect())
      ..onConnectError((error) {
        connectionError.value = error.toString();
        _scheduleReconnect();
      })
      ..onError((error) {
        connectionError.value = error.toString();
      });
    _socket!.connect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    if (_pendingUserId == null && _pendingUserName == null) return;
    _reconnectAttempt++;
    final delay = (_reconnectAttempt * 2).clamp(1, _maxReconnectDelay);
    _reconnectTimer = Timer(Duration(seconds: delay), () {
      if (_pendingUserId != null || _pendingUserName != null) {
        debugPrint('[MeetSocket] Reconnecting (attempt $_reconnectAttempt)...');
        connect(userId: _pendingUserId, userName: _pendingUserName, isClient: _pendingIsClient);
      }
    });
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _listeners.clear();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    connectionError.value = null;
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void Function() on(String event, Function(dynamic) callback) {
    _listeners.putIfAbsent(event, () => []);
    _listeners[event]!.add(callback);
    _socket?.on(event, callback);
    return () {
      _listeners[event]?.remove(callback);
      if (_listeners[event]?.isEmpty == true) _listeners.remove(event);
      _socket?.off(event);
    };
  }

  void off(String event) {
    _listeners.remove(event);
    _socket?.off(event);
  }
}
