import 'package:socket_io_client/socket_io_client.dart' as IO;

class MeetSocketService {
  static final MeetSocketService _instance = MeetSocketService._();
  factory MeetSocketService() => _instance;
  MeetSocketService._();

  IO.Socket? _socket;
  final String _serverUrl = 'https://meet.infovibex.com';
  bool get isConnected => _socket?.connected ?? false;
  String get serverUrl => _serverUrl;

  void connect({String? userId, String? userName, bool isClient = false}) {
    disconnect();
    final query = <String, String>{};
    if (userId != null) query['userId'] = userId;
    if (userName != null) query['userName'] = userName;
    if (isClient) query['isClient'] = 'true';
    _socket = IO.io(_serverUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
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
