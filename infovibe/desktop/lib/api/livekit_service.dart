import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' show desktopCapturer, SourceType;
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart' as lk;
import 'socket.dart';

class LiveKitService {
  static final LiveKitService _instance = LiveKitService._();
  factory LiveKitService() => _instance;
  LiveKitService._();

  static const String _meetBaseUrl = 'https://meet.infovibex.com';

  lk.Room? _room;
  final SocketService _socket = SocketService();
  lk.EventsListener<lk.RoomEvent>? _listener;

  lk.Room? get room => _room;
  bool get isConnected => _room?.connectionState == lk.ConnectionState.connected;

  final ValueNotifier<bool> isMuted = ValueNotifier(false);
  final ValueNotifier<bool> isVideoOff = ValueNotifier(false);
  final ValueNotifier<bool> isScreenSharing = ValueNotifier(false);
  final ValueNotifier<bool> isRecording = ValueNotifier(false);
  final ValueNotifier<bool> isHandRaised = ValueNotifier(false);
  final ValueNotifier<int> participantCount = ValueNotifier(0);
  final ValueNotifier<List<Map<String, dynamic>>> participants = ValueNotifier([]);
  final ValueNotifier<Map<String, lk.RemoteVideoTrack?>> videoTracks = ValueNotifier({});
  final ValueNotifier<Map<String, lk.RemoteVideoTrack?>> screenShareTracks = ValueNotifier({});
  final ValueNotifier<lk.LocalVideoTrack?> localVideoTrack = ValueNotifier(null);
  final ValueNotifier<lk.LocalVideoTrack?> screenShareTrack = ValueNotifier(null);
  String? lastError;
  bool _micOperationInProgress = false;
  bool _cameraOperationInProgress = false;

  final VoidCallbacks onRoomConnected = VoidCallbacks();
  final VoidCallbacks onRoomDisconnected = VoidCallbacks();

  final http.Client _httpClient = http.Client();

  Future<void> initialize() async {
    try {
      await lk.LiveKitClient.initialize();
    } catch (e) {
      debugPrint('[LiveKit] Failed to initialize: $e');
    }
  }

  Future<String?> _fetchToken(String roomId, String participantId, String name) async {
    try {
      final response = await _httpClient.post(
        Uri.parse('$_meetBaseUrl/api/livekit/token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'roomId': roomId,
          'participantId': participantId,
          'name': name,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['token'] as String?;
      }
      debugPrint('[LiveKit] Token fetch failed: ${response.statusCode} ${response.body}');
    } catch (e) {
      debugPrint('[LiveKit] Token fetch error: $e');
    }
    return null;
  }

  Future<String?> connect(String roomId, String participantId, String name) async {
    lastError = null;
    try {
      final token = await _fetchToken(roomId, participantId, name);
      if (token == null) {
        lastError = 'Failed to fetch LiveKit token';
        debugPrint('[LiveKit] $lastError');
        return lastError;
      }
      debugPrint('[LiveKit] Token fetched successfully: $token');

      _room?.disconnect();
      _room?.dispose();

      _listener?.dispose();
      _listener = null;

      final room = lk.Room(
        roomOptions: lk.RoomOptions(
          adaptiveStream: true,
          dynacast: true,
          defaultCameraCaptureOptions: const lk.CameraCaptureOptions(maxFrameRate: 30),
          defaultVideoPublishOptions: const lk.VideoPublishOptions(simulcast: true, videoCodec: 'vp8'),
        ),
      );

      _listener = room.createListener();
      _listener!
        ..on<lk.RoomConnectedEvent>((_) {
          debugPrint('[LiveKit] Room connected');
          onRoomConnected.notify();
          _room = room;
          _updateParticipants();
        })
        ..on<lk.RoomDisconnectedEvent>((_) {
          debugPrint('[LiveKit] Room disconnected');
          onRoomDisconnected.notify();
          videoTracks.value = {};
          screenShareTracks.value = {};
          localVideoTrack.value = null;
          screenShareTrack.value = null;
        })
        ..on<lk.ParticipantConnectedEvent>((_) => _updateParticipants())
        ..on<lk.ParticipantDisconnectedEvent>((_) => _updateParticipants())
        ..on<lk.TrackSubscribedEvent>((event) {
          if (event.track is lk.RemoteVideoTrack) {
            final identity = event.participant.identity;
            final isScreen = event.publication.source == lk.TrackSource.screenShareVideo;
            if (isScreen) {
              final tracks = Map<String, lk.RemoteVideoTrack?>.from(screenShareTracks.value);
              tracks[identity] = event.track as lk.RemoteVideoTrack;
              screenShareTracks.value = tracks;
            } else {
              final tracks = Map<String, lk.RemoteVideoTrack?>.from(videoTracks.value);
              tracks[identity] = event.track as lk.RemoteVideoTrack;
              videoTracks.value = tracks;
            }
            _updateParticipants();
          }
        })
        ..on<lk.TrackUnsubscribedEvent>((event) {
          final identity = event.participant.identity;
          final isScreen = event.publication.source == lk.TrackSource.screenShareVideo;
          if (isScreen) {
            final tracks = Map<String, lk.RemoteVideoTrack?>.from(screenShareTracks.value);
            tracks.remove(identity);
            screenShareTracks.value = tracks;
          } else {
            final tracks = Map<String, lk.RemoteVideoTrack?>.from(videoTracks.value);
            tracks.remove(identity);
            videoTracks.value = tracks;
          }
          _updateParticipants();
        })
        ..on<lk.ActiveSpeakersChangedEvent>((_) => _updateParticipants())
        ..on<lk.LocalTrackPublishedEvent>((event) {
          if (event.publication.track is lk.LocalVideoTrack) {
            final track = event.publication.track as lk.LocalVideoTrack;
            if (event.publication.source == lk.TrackSource.screenShareVideo) {
              screenShareTrack.value = track;
              isScreenSharing.value = true;
              debugPrint('[LiveKit] Local screen share track published');
            } else {
              localVideoTrack.value = track;
              isVideoOff.value = false;
              debugPrint('[LiveKit] Local video track published');
            }
            _updateParticipants();
          }
        })
        ..on<lk.LocalTrackUnpublishedEvent>((event) {
          if (event.publication.source == lk.TrackSource.screenShareVideo) {
            screenShareTrack.value = null;
            isScreenSharing.value = false;
          } else if (event.publication.track is lk.LocalVideoTrack ||
              event.publication.source == lk.TrackSource.camera) {
            localVideoTrack.value = null;
            isVideoOff.value = true;
          }
          _updateParticipants();
        })
        ..on<lk.TrackMutedEvent>((_) {
          _syncLocalTrackState();
          _updateParticipants();
        })
        ..on<lk.TrackUnmutedEvent>((_) {
          _syncLocalTrackState();
          _updateParticipants();
        });

      final url = await _resolveLiveKitUrl();
      debugPrint('[LiveKit] Connecting to $url');
      await room.connect(url, token, connectOptions: const lk.ConnectOptions(autoSubscribe: true));
      debugPrint('[LiveKit] Room.connect succeeded');

      return null;
    } catch (e, stack) {
      lastError = 'LiveKit error: $e';
      debugPrint('[LiveKit] Error: $e\n$stack');
      return lastError;
    }
  }

  Future<String> _resolveLiveKitUrl() async {
    try {
      final response = await _httpClient.post(
        Uri.parse('$_meetBaseUrl/api/livekit/token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'roomId': 'test', 'participantId': 'test', 'name': 'test'}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['url'] != null) return data['url'] as String;
      }
      debugPrint('[LiveKit] URL resolution failed: ${response.statusCode}');
    } catch (e) {
      debugPrint('[LiveKit] URL resolution error: $e');
    }
    return 'wss://meet.infovibex.com/livekit';
  }

  void _updateParticipants() {
    if (_room == null) return;
    final all = <Map<String, dynamic>>[];
    final local = _room!.localParticipant;
    if (local != null) {
      all.add(_participantToMap(local, true));
    }
    for (final p in _room!.remoteParticipants.values) {
      all.add(_participantToMap(p, false));
    }
    final oldIds = participants.value.map((m) => m['id']).join(',');
    final newIds = all.map((m) => m['id']).join(',');
    if (oldIds == newIds) return;
    participants.value = all;
    participantCount.value = all.length;
  }

  Map<String, dynamic> _participantToMap(lk.Participant p, bool isLocal) {
    final activeSpeakers = _room?.activeSpeakers;
    bool screenSharing = false;
    bool videoOff = true;
    for (final pub in p.videoTrackPublications) {
      if (pub.source == lk.TrackSource.screenShareVideo) {
        if (!pub.muted) screenSharing = true;
      } else {
        if (!pub.muted) videoOff = false;
      }
    }
    final audioPub = p.audioTrackPublications.isNotEmpty ? p.audioTrackPublications.first : null;
    return {
      'id': p.identity,
      'name': p.name.isNotEmpty ? p.name : p.identity,
      'muted': audioPub?.muted ?? true,
      'videoOff': videoOff,
      'speaking': activeSpeakers?.contains(p) ?? false,
      'screenSharing': screenSharing,
      'isLocal': isLocal,
    };
  }

  void _syncLocalTrackState() {
    final local = _room?.localParticipant;
    if (local == null) return;
    lk.LocalVideoTrack? cameraTrack;
    lk.LocalVideoTrack? shareTrack;
    bool hasLiveMic = false;

    for (final pub in local.audioTrackPublications) {
      if (!pub.muted) hasLiveMic = true;
    }
    for (final pub in local.videoTrackPublications) {
      final track = pub.track;
      if (track is! lk.LocalVideoTrack || pub.muted) continue;
      if (pub.source == lk.TrackSource.screenShareVideo) {
        shareTrack = track;
      } else {
        cameraTrack = track;
      }
    }

    localVideoTrack.value = cameraTrack;
    screenShareTrack.value = shareTrack;
    isMuted.value = !hasLiveMic;
    isVideoOff.value = cameraTrack == null;
    isScreenSharing.value = shareTrack != null;
  }

  Future<void> setMicEnabled(bool enabled) async {
    if (_micOperationInProgress || _room?.localParticipant == null) {
      if (_room?.localParticipant == null) {
        lastError = 'Not connected to meeting';
      }
      return;
    }
    _micOperationInProgress = true;
    lastError = null;
    try {
      debugPrint('[LiveKit] Setting mic enabled: $enabled');
      await _room!.localParticipant!.setMicrophoneEnabled(enabled).timeout(const Duration(seconds: 5));
      for (int i = 0; i < 30; i++) {
        await Future.delayed(const Duration(milliseconds: 100));
        _syncLocalTrackState();
        if (isMuted.value == !enabled) break;
      }
      _socket.emit('participant-update', {'isAudioEnabled': enabled});
      _updateParticipants();
      debugPrint('[LiveKit] Mic ${enabled ? "enabled" : "disabled"} (isMuted=${isMuted.value})');
    } on TimeoutException {
      lastError = 'Mic operation timed out. Please try again.';
      debugPrint('[LiveKit] setMicEnabled timed out');
    } catch (e) {
      final errorMsg = e.toString();
      debugPrint('[LiveKit] setMicEnabled failed: $errorMsg');
      if (errorMsg.contains('Permission') || errorMsg.contains('permission')) {
        lastError = 'Microphone permission denied. Please check your system settings.';
      } else if (errorMsg.contains('device') || errorMsg.contains('Device')) {
        lastError = 'No microphone device found or device not accessible.';
      } else if (errorMsg.contains('TrackCreateException') || errorMsg.contains('Failed to create stream')) {
        lastError = 'No microphone found or mic not available. Please check your device.';
      } else {
        lastError = 'Failed to toggle mic: $errorMsg';
      }
    } finally {
      _micOperationInProgress = false;
    }
  }

  Future<void> setCameraEnabled(bool enabled) async {
    if (_cameraOperationInProgress || _room?.localParticipant == null) {
      if (_room?.localParticipant == null) {
        lastError = 'Not connected to meeting';
      }
      return;
    }
    _cameraOperationInProgress = true;
    lastError = null;
    try {
      debugPrint('[LiveKit] Setting camera enabled: $enabled');
      await _room!.localParticipant!.setCameraEnabled(enabled).timeout(const Duration(seconds: 10));
      // Wait for the track publication event to propagate (max 3s)
      for (int i = 0; i < 30; i++) {
        await Future.delayed(const Duration(milliseconds: 100));
        _syncLocalTrackState();
        if (isVideoOff.value == !enabled) break;
      }
      _socket.emit('participant-update', {'isVideoEnabled': enabled});
      _updateParticipants();
      debugPrint('[LiveKit] Camera ${enabled ? "enabled" : "disabled"} (isVideoOff=${isVideoOff.value})');
    } on TimeoutException {
      lastError = 'Camera operation timed out. Please try again.';
      debugPrint('[LiveKit] setCameraEnabled timed out');
    } catch (e) {
      final errorMsg = e.toString();
      debugPrint('[LiveKit] setCameraEnabled failed: $errorMsg');
      if (errorMsg.contains('Permission') || errorMsg.contains('permission')) {
        lastError = 'Camera permission denied. Please check your system settings.';
      } else if (errorMsg.contains('device') || errorMsg.contains('Device')) {
        lastError = 'No camera device found or device not accessible.';
      } else if (errorMsg.contains('TrackCreateException') || errorMsg.contains('Failed to create stream')) {
        lastError = 'No camera found or camera not available. Please check your device.';
      } else {
        lastError = 'Failed to toggle camera: $errorMsg';
      }
    } finally {
      _cameraOperationInProgress = false;
    }
  }

  Future<void> toggleMute() async {
    await setMicEnabled(isMuted.value);
  }

  Future<void> toggleVideo() async {
    try {
      await setCameraEnabled(isVideoOff.value);
    } catch (e) {
      debugPrint('[LiveKit] Toggle video failed: $e');
      lastError = 'Failed to toggle camera: $e';
    }
  }

  Future<String?> toggleScreenShare() async {
    lastError = null;
    if (_room?.localParticipant == null) {
      lastError = 'Not connected to room';
      return lastError;
    }
    final willBeSharing = !isScreenSharing.value;
    try {
      debugPrint('[LiveKit] Screen share: ${willBeSharing ? "starting" : "stopping"}');
      if (!willBeSharing) {
        lk.LocalTrackPublication<lk.LocalVideoTrack>? sharePublication;
        for (final pub in _room!.localParticipant!.videoTrackPublications) {
          if (pub.source == lk.TrackSource.screenShareVideo) {
            sharePublication = pub;
            break;
          }
        }
        if (sharePublication != null) {
          await _room!.localParticipant!.removePublishedTrack(sharePublication.sid);
        } else {
          await _room!.localParticipant!.setScreenShareEnabled(false);
        }
        screenShareTrack.value = null;
        isScreenSharing.value = false;
      } else {
        // Pre-check: try to enumerate desktop sources via DesktopCapturer
        String? sourceId;
        try {
          final sources = await desktopCapturer
              .getSources(types: [SourceType.screen, SourceType.window])
              .timeout(const Duration(seconds: 3));
          if (sources.isNotEmpty) {
            sourceId = sources.first.id;
            debugPrint('[LiveKit] Desktop sources available, pre-selected: ${sources.first.name}');
          } else {
            debugPrint('[LiveKit] No desktop sources returned by DesktopCapturer');
          }
        } catch (e) {
          debugPrint('[LiveKit] DesktopCapturer pre-check failed: $e');
        }

        if (sourceId != null) {
          await _room!.localParticipant!.setScreenShareEnabled(
            true,
            screenShareCaptureOptions: lk.ScreenShareCaptureOptions(sourceId: sourceId),
          ).timeout(const Duration(seconds: 15));
        } else {
          await _room!.localParticipant!.setScreenShareEnabled(true).timeout(const Duration(seconds: 15));
        }
        // Wait for screen share track to appear (max 5s)
        for (int i = 0; i < 50; i++) {
          await Future.delayed(const Duration(milliseconds: 100));
          _syncLocalTrackState();
          if (isScreenSharing.value) break;
        }
      }
      _updateParticipants();
      debugPrint('[LiveKit] Screen share: ${willBeSharing ? "started" : "stopped"} (isScreenSharing=${isScreenSharing.value})');
      if (!willBeSharing || isScreenSharing.value) return null;
      lastError = 'Screen share source not selected or timed out';
      return lastError;
    } on TimeoutException {
      lastError = 'Screen share timed out. Please try again.';
      debugPrint('[LiveKit] Screen share timed out');
      return lastError;
    } catch (e) {
      final errorMsg = e.toString();
      debugPrint('[LiveKit] Screen share failed: $errorMsg');
      if (errorMsg.contains('cancel') || errorMsg.contains('abort') || errorMsg.contains('cancelled')) {
        lastError = 'Screen share cancelled';
      } else if (errorMsg.contains('getDisplayMedia') || errorMsg.contains('source not found')) {
        lastError = 'Screen capture not available on this system.\n'
            'This can happen when running in a Remote Desktop (RDP) session, a VM, or when graphics drivers are missing.\n'
            'Please try running directly on your local Windows desktop.';
      } else {
        lastError = 'Screen share failed: $errorMsg';
      }
      return lastError;
    }
  }

  Future<void> raiseHand() async {
    isHandRaised.value = !isHandRaised.value;
    _socket.emit('participant-update', {'isHandRaised': isHandRaised.value});
  }

  Future<void> disconnect() async {
    _listener?.dispose();
    _listener = null;
    if (_room != null) {
      await _room!.disconnect();
      _room!.dispose();
      _room = null;
    }
    isMuted.value = false;
    isVideoOff.value = false;
    isScreenSharing.value = false;
    isRecording.value = false;
    isHandRaised.value = false;
    participantCount.value = 0;
    participants.value = [];
    videoTracks.value = {};
    screenShareTracks.value = {};
    localVideoTrack.value = null;
    screenShareTrack.value = null;
    _micOperationInProgress = false;
    _cameraOperationInProgress = false;
  }

  void dispose() {
    _httpClient.close();
    disconnect();
  }
}

class VoidCallbacks {
  final List<VoidCallback> _callbacks = [];
  void add(VoidCallback cb) => _callbacks.add(cb);
  void remove(VoidCallback cb) => _callbacks.remove(cb);
  void notify() {
    for (final cb in List.from(_callbacks)) {
      try {
        cb();
      } catch (_) {}
    }
  }
}
