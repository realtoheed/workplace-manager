import 'package:flutter/foundation.dart';
import '../api/socket.dart';

class SocketProvider extends ChangeNotifier {
  final SocketService _socket = SocketService();
  SocketService get socket => _socket;
  bool get isConnected => _socket.isConnected;

  void connect(String userId, String userName, {bool isClient = false}) {
    _socket.connect(userId, userName, isClient: isClient);
  }

  void disconnect() {
    _socket.disconnect();
  }

  void emit(String event, dynamic data) {
    _socket.emit(event, data);
  }

  void on(String event, Function(dynamic) callback) {
    _socket.on(event, callback);
  }

  void off(String event) {
    _socket.off(event);
  }
}
