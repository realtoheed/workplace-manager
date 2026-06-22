import 'package:flutter/foundation.dart';
import '../api/socket.dart';

class SocketProvider extends ChangeNotifier {
  final SocketService _socket = SocketService();
  SocketService get socket => _socket;
  bool get isConnected => _socket.isConnected;

  final List<void Function()> _cleanups = [];

  void connect(String userId, String userName, {bool isClient = false}) {
    _socket.connect(userId, userName, isClient: isClient);
  }

  void disconnect() {
    for (final c in _cleanups) {
      c();
    }
    _cleanups.clear();
    _socket.disconnect();
  }

  void emit(String event, dynamic data) {
    _socket.emit(event, data);
  }

  void Function() on(String event, Function(dynamic) callback) {
    final cleanup = _socket.on(event, callback);
    _cleanups.add(cleanup);
    return cleanup;
  }

  void off(String event) {
    _socket.off(event);
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
