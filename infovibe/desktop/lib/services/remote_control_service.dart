import 'dart:async';
import 'package:flutter/foundation.dart';
import '../api/socket.dart';

enum RemoteControlRole { none, controller, target }

class RemoteControlService {
  static final RemoteControlService _instance = RemoteControlService._();
  factory RemoteControlService() => _instance;
  RemoteControlService._();

  final SocketService _socket = SocketService();
  RemoteControlRole _role = RemoteControlRole.none;
  String? _targetParticipantId;
  String? _localParticipantId;

  final ValueNotifier<RemoteControlRole> role = ValueNotifier(RemoteControlRole.none);
  final ValueNotifier<bool> hasControl = ValueNotifier(false);
  final ValueNotifier<bool> isControlled = ValueNotifier(false);

  final StreamController<Map<String, dynamic>> _incomingEvents = StreamController<Map<String, dynamic>>.broadcast();

  final List<void Function()> _socketCleanups = [];

  Timer? _mouseThrottle;
  double _pendingX = 0;
  double _pendingY = 0;

  void initialize(String roomId) {
    _cleanupListeners();

    _socketCleanups.add(
      _socket.on('remote-control-request', (payload) {
        if (_role == RemoteControlRole.none && payload['targetParticipantId'] != null) {
          hasControl.value = false;
          isControlled.value = payload['targetParticipantId'] == _localParticipantId;
        }
      }),
    );

    _socketCleanups.add(
      _socket.on('remote-control-granted', (payload) {
        if (_role == RemoteControlRole.controller) {
          hasControl.value = true;
        }
      }),
    );

    _socketCleanups.add(
      _socket.on('remote-control-denied', (_) {
        if (_role == RemoteControlRole.controller) {
          _role = RemoteControlRole.none;
          role.value = RemoteControlRole.none;
          hasControl.value = false;
        }
      }),
    );

    _socketCleanups.add(
      _socket.on('remote-control-event', (payload) {
        if (_role == RemoteControlRole.target) {
          _incomingEvents.add(Map<String, dynamic>.from(payload));
        }
      }),
    );

    _socketCleanups.add(
      _socket.on('remote-control-ended', (_) {
        _role = RemoteControlRole.none;
        role.value = RemoteControlRole.none;
        hasControl.value = false;
        isControlled.value = false;
      }),
    );
  }

  void setLocalParticipantId(String id) {
    _localParticipantId = id;
  }

  void _cleanupListeners() {
    for (final cleanup in _socketCleanups) {
      cleanup();
    }
    _socketCleanups.clear();
  }

  Future<void> requestControl(String targetId) async {
    _role = RemoteControlRole.controller;
    role.value = RemoteControlRole.controller;
    _targetParticipantId = targetId;
    _socket.emit('request-remote-control', {
      'targetParticipantId': targetId,
    });
  }

  Future<void> approveControl(String controllerId) async {
    _role = RemoteControlRole.target;
    role.value = RemoteControlRole.target;
    _socket.emit('approve-remote-control', {
      'participantId': controllerId,
    });
  }

  Future<void> declineControl(String controllerId) async {
    _socket.emit('decline-remote-control', {
      'participantId': controllerId,
    });
  }

  Future<void> sendInputEvent(Map<String, dynamic> event) async {
    if (_role != RemoteControlRole.controller || !hasControl.value) return;
    _socket.emit('remote-control-event', {
      'targetParticipantId': _targetParticipantId,
      ...event,
    });
  }

  Future<void> sendMouseMove(double x, double y) async {
    _pendingX = x;
    _pendingY = y;
    _mouseThrottle ??= Timer(const Duration(milliseconds: 50), () {
      _mouseThrottle = null;
      sendInputEvent({'type': 'mousemove', 'x': _pendingX, 'y': _pendingY});
    });
  }

  Future<void> sendMouseClick(int button) async {
    await sendInputEvent({'type': 'mouseclick', 'button': button});
  }

  Future<void> sendKeyPress(int keyCode, bool isDown) async {
    await sendInputEvent({'type': 'key', 'keyCode': keyCode, 'isDown': isDown});
  }

  Stream<Map<String, dynamic>> get incomingEvents => _incomingEvents.stream;

  Future<void> endControl() async {
    _socket.emit('end-remote-control', {
      'targetParticipantId': _targetParticipantId,
    });
    _role = RemoteControlRole.none;
    role.value = RemoteControlRole.none;
    hasControl.value = false;
    isControlled.value = false;
    _targetParticipantId = null;
    _mouseThrottle?.cancel();
    _mouseThrottle = null;
  }

  void dispose() {
    _cleanupListeners();
    _incomingEvents.close();
    _mouseThrottle?.cancel();
    _mouseThrottle = null;
  }
}
