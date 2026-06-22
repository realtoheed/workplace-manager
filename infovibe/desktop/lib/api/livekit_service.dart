import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
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
  final ValueNotifier<lk.LocalVideoTrack?> localVideoTrack = ValueNotifier(null);
  final ValueNotifier<lk.LocalVideoTrack?> screenShareTrack = ValueNotifier(null);
  String? lastError;

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
          localVideoTrack.value = null;
          screenShareTrack.value = null;
        })
        ..on<lk.ParticipantConnectedEvent>((_) => _updateParticipants())
        ..on<lk.ParticipantDisconnectedEvent>((_) => _updateParticipants())
        ..on<lk.TrackSubscribedEvent>((event) {
          if (event.track is lk.RemoteVideoTrack) {
            final identity = event.participant.identity;
            final tracks = Map<String, lk.RemoteVideoTrack?>.from(videoTracks.value);
            tracks[identity] = event.track as lk.RemoteVideoTrack;
            videoTracks.value = tracks;
          }
        })
        ..on<lk.TrackUnsubscribedEvent>((event) {
          final identity = event.participant.identity;
          final tracks = Map<String, lk.RemoteVideoTrack?>.from(videoTracks.value);
          tracks.remove(identity);
          videoTracks.value = tracks;
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
    final videoPub = p.videoTrackPublications.isNotEmpty ? p.videoTrackPublications.first : null;
    final audioPub = p.audioTrackPublications.isNotEmpty ? p.audioTrackPublications.first : null;
    final activeSpeakers = _room?.activeSpeakers;
    return {
      'id': p.identity,
      'name': p.name.isNotEmpty ? p.name : p.identity,
      'muted': audioPub?.muted ?? true,
      'videoOff': videoPub?.muted ?? true,
      'speaking': activeSpeakers?.contains(p) ?? false,
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
    if (_room?.localParticipant == null) return;
    try {
      await _room!.localParticipant!.setMicrophoneEnabled(enabled);
      isMuted.value = !enabled;
      _socket.emit('participant-update', {'isAudioEnabled': enabled});
      _updateParticipants();
    } catch (e) {
      debugPrint('[LiveKit] setMicEnabled failed: $e');
    }
  }

  Future<void> setCameraEnabled(bool enabled) async {
    if (_room?.localParticipant == null) {
      lastError = 'Not connected to meeting';
      return;
    }
    try {
      debugPrint('[LiveKit] Setting camera enabled: $enabled');
      await _room!.localParticipant!.setCameraEnabled(enabled);
      _syncLocalTrackState();
      _socket.emit('participant-update', {'isVideoEnabled': enabled});
      _updateParticipants();
      debugPrint('[LiveKit] Camera ${enabled ? "enabled" : "disabled"} successfully');
      lastError = null;
    } catch (e) {
      final errorMsg = e.toString();
      debugPrint('[LiveKit] setCameraEnabled failed: $errorMsg');
      if (errorMsg.contains('Permission') || errorMsg.contains('permission')) {
        lastError = 'Camera permission denied. Please check your system settings.';
      } else if (errorMsg.contains('device') || errorMsg.contains('Device')) {
        lastError = 'No camera device found or device not accessible.';
      } else {
        lastError = 'Failed to toggle camera: $errorMsg';
      }
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
        await _room!.localParticipant!.setScreenShareEnabled(true);
        _syncLocalTrackState();
      }
      _updateParticipants();
      debugPrint('[LiveKit] Screen share: ${willBeSharing ? "started" : "stopped"}');
      return null;
    } catch (e) {
      debugPrint('[LiveKit] Screen share failed: $e');
      lastError = 'Screen share failed: $e';
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
    localVideoTrack.value = null;
    screenShareTrack.value = null;
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
