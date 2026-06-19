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
  String? _controllerParticipantId;

  final ValueNotifier<RemoteControlRole> role = ValueNotifier(RemoteControlRole.none);
  final ValueNotifier<bool> hasControl = ValueNotifier(false);
  final ValueNotifier<bool> isControlled = ValueNotifier(false);

  StreamController<Map<String, dynamic>>? _incomingEvents;

  void initialize(String roomId) {
    _socket.on('remote-control-request', (payload) {
      if (_role == RemoteControlRole.none && payload['targetParticipantId'] != null) {
        _controllerParticipantId = payload['participantId'];
        hasControl.value = false;
        isControlled.value = payload['targetParticipantId'] == _socket.serverUrl; // simplified
      }
    });

    _socket.on('remote-control-granted', (payload) {
      if (_role == RemoteControlRole.controller) {
        hasControl.value = true;
      }
    });

    _socket.on('remote-control-denied', (_) {
      if (_role == RemoteControlRole.controller) {
        _role = RemoteControlRole.none;
        role.value = RemoteControlRole.none;
        hasControl.value = false;
      }
    });

    _socket.on('remote-control-event', (payload) {
      if (_role == RemoteControlRole.target) {
        _incomingEvents?.add(Map<String, dynamic>.from(payload));
      }
    });

    _socket.on('remote-control-ended', (_) {
      _role = RemoteControlRole.none;
      role.value = RemoteControlRole.none;
      hasControl.value = false;
      isControlled.value = false;
    });
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
    _controllerParticipantId = controllerId;
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
    await sendInputEvent({'type': 'mousemove', 'x': x, 'y': y});
  }

  Future<void> sendMouseClick(int button) async {
    await sendInputEvent({'type': 'mouseclick', 'button': button});
  }

  Future<void> sendKeyPress(int keyCode, bool isDown) async {
    await sendInputEvent({'type': 'key', 'keyCode': keyCode, 'isDown': isDown});
  }

  Stream<Map<String, dynamic>> get incomingEvents {
    _incomingEvents ??= StreamController<Map<String, dynamic>>.broadcast();
    return _incomingEvents!.stream;
  }

  Future<void> endControl() async {
    _socket.emit('end-remote-control', {
      'targetParticipantId': _targetParticipantId,
    });
    _role = RemoteControlRole.none;
    role.value = RemoteControlRole.none;
    hasControl.value = false;
    isControlled.value = false;
    _targetParticipantId = null;
    _controllerParticipantId = null;
  }

  void dispose() {
    _incomingEvents?.close();
  }
}
