import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static final SocketService _instance = SocketService._();
  factory SocketService() => _instance;
  SocketService._();

  IO.Socket? _socket;
  String _serverUrl = 'https://app.infovibex.com';
  bool get isConnected => _socket?.connected ?? false;
  String get serverUrl => _serverUrl;

  void setServerUrl(String url) {
    _serverUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  void connect(String userId, String userName, {bool isClient = false}) {
    if (_socket != null) return;
    final query = <String, String>{'userId': userId, 'userName': userName};
    if (isClient) query['isClient'] = 'true';
    _socket = IO.io(_serverUrl, IO.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setPath('/socket.io/')
      .setQuery(query)
      .enableAutoConnect()
      .build());
    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  void off(String event) {
    _socket?.off(event);
  }
}
