import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../api/livekit_service.dart';
import '../api/meet_socket.dart';
import '../components/meeting_controls.dart';
import '../models/chat_message.dart';
import '../providers/auth_provider.dart';

class MeetingWindow extends StatefulWidget {
  final String meetingId;
  final String roomId;
  final bool initialMicOn;
  final bool initialCameraOn;

  const MeetingWindow({
    super.key,
    required this.meetingId,
    required this.roomId,
    this.initialMicOn = false,
    this.initialCameraOn = false,
  });

  @override
  State<MeetingWindow> createState() => _MeetingWindowState();
}

class _MeetingWindowState extends State<MeetingWindow> with TickerProviderStateMixin {
  final _lk = LiveKitService();
  final _socket = MeetSocketService();
  final _api = ApiClient();
  final _chatController = TextEditingController();
  final List<ChatMessage> _chatMessages = [];
  final Set<String> _seenMessageIds = {};
  static const int _maxChatMessages = 500;

  bool _showChat = false;
  bool _showParticipants = false;
  bool _showSettings = false;
  bool _showBreakout = false;
  bool _isControlled = false;
  bool _connecting = true;
  bool _cameraBusy = false;
  bool _noiseSuppression = true;
  bool _closedCaptions = false;
  String? _error;
  int _sidePanelTab = 0;
  int _settingsTab = 0;
  double _volume = 75;
  double _speakerSensitivity = 60;
  String _viewMode = 'gallery';
  String _nameTagFontSize = 'Medium';
  String? _selectedScreenShareId;

  double get _speakingThreshold => 1 - (_speakerSensitivity / 100);

  bool get _hasScreenShares {
    if (_lk.isScreenSharing.value) return true;
    return _lk.participants.value.any(
      (participant) =>
          participant['isLocal'] != true &&
          (participant['screenSharing'] == true || participant['isScreenSharing'] == true),
    );
  }

  List<Map<String, dynamic>> get _screenSharers {
    final sharers = <Map<String, dynamic>>[];
    if (_lk.isScreenSharing.value) {
      sharers.add({
        'id': context.read<AuthProvider>().currentUser?.id ?? 'local',
        'name': context.read<AuthProvider>().currentUser?.name ?? 'You',
        'isLocal': true,
      });
    }
    for (final participant in _lk.participants.value) {
      if (participant['isLocal'] == true) continue;
      if (participant['screenSharing'] == true || participant['isScreenSharing'] == true) {
        sharers.add(participant);
      }
    }
    return sharers;
  }

  final List<void Function()> _socketCleanups = [];
  StreamSubscription<List<lk.MediaDevice>>? _deviceSub;
  List<lk.MediaDevice> _microphones = [];
  List<lk.MediaDevice> _cameras = [];
  List<lk.MediaDevice> _speakers = [];
  lk.MediaDevice? _selectedMicrophone;
  lk.MediaDevice? _selectedCamera;
  lk.MediaDevice? _selectedSpeaker;

  @override
  void initState() {
    super.initState();
    _deviceSub = lk.Hardware.instance.onDeviceChange.stream.listen(_loadDevices);
    _loadInitialDevices();
    _joinMeeting();
  }

  Future<void> _loadInitialDevices() async {
    try {
      final devices = await lk.Hardware.instance.enumerateDevices();
      _loadDevices(devices);
    } catch (e) {
      debugPrint('[Meeting] Failed to enumerate devices: $e');
    }
  }

  @override
  void dispose() {
    _deviceSub?.cancel();
    _chatController.dispose();
    _reportAttendanceLeave();
    _socket.emit('leave-room', {});
    for (final cleanup in _socketCleanups) {
      cleanup();
    }
    _socketCleanups.clear();
    _lk.disconnect();
    super.dispose();
  }

  Future<void> _loadDevices(List<lk.MediaDevice> devices) async {
    if (!mounted) return;
    setState(() {
      _microphones = devices.where((d) => d.kind == 'audioinput').toList();
      _cameras = devices.where((d) => d.kind == 'videoinput').toList();
      _speakers = devices.where((d) => d.kind == 'audiooutput').toList();
      _selectedMicrophone ??= lk.Hardware.instance.selectedAudioInput ?? (_microphones.isNotEmpty ? _microphones.first : null);
      _selectedCamera ??= lk.Hardware.instance.selectedVideoInput ?? (_cameras.isNotEmpty ? _cameras.first : null);
      _selectedSpeaker ??= lk.Hardware.instance.selectedAudioOutput ?? (_speakers.isNotEmpty ? _speakers.first : null);
    });
  }

  Future<void> _joinMeeting() async {
    final user = context.read<AuthProvider>().currentUser;
    if (user == null) {
      setState(() {
        _connecting = false;
        _error = 'Not logged in';
      });
      return;
    }

    _reportAttendanceJoin();
    _socket.connect(userId: user.id, userName: user.name);
    _socket.emit('join-room', {
      'roomId': widget.roomId,
      'participantId': user.id,
      'name': user.name,
      'profileId': user.id,
      'meetingId': widget.meetingId,
      'meetingType': 'instant',
    });

    _socketCleanups.add(_socket.on('joined-room', (_) => _connectLiveKit(user.id, user.name)));
    _socketCleanups.add(_socket.on('join-room-error', (error) {
      if (!mounted) return;
      setState(() {
        _connecting = false;
        _error = error is Map ? error['message'] ?? 'Failed to join' : 'Failed to join';
      });
    }));
    _socketCleanups.add(_socket.on('chat-message', _receiveChatMessage));
    _socketCleanups.add(_socket.on('participant-joined', (data) {
      _softRefresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${data is Map ? data['name'] ?? 'Someone' : 'Someone'} joined'),
          duration: const Duration(seconds: 2),
        ));
      }
    }));
    _socketCleanups.add(_socket.on('participant-left', (data) {
      _softRefresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${data is Map ? data['name'] ?? 'Someone' : 'Someone'} left'),
          duration: const Duration(seconds: 2),
        ));
      }
    }));
    _socketCleanups.add(_socket.on('meeting-ended', (_) {
      if (mounted) Navigator.of(context).pop();
    }));

    if (_lk.isConnected) {
      await _applyInitialMedia();
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _connectLiveKit(String userId, String name) async {
    if (!_lk.isConnected) {
      final error = await _lk.connect(widget.roomId, userId, name);
      if (error != null) {
        if (mounted) {
          setState(() {
            _connecting = false;
            _error = error;
          });
        }
        return;
      }
    }
    await _applyInitialMedia();
    if (mounted) setState(() => _connecting = false);
  }

  Future<void> _applyInitialMedia() async {
    await _lk.setMicEnabled(widget.initialMicOn);
    await _lk.setCameraEnabled(widget.initialCameraOn);
  }

  void _softRefresh() {
    if (mounted) setState(() {});
  }

  void _reportAttendanceJoin() {
    _api.post('/attendance/join', body: {'meetingId': widget.meetingId, 'room': widget.roomId}).then((_) {}, onError: (e) {
      debugPrint('[Meeting] Failed to report join: $e');
    });
  }

  void _reportAttendanceLeave() {
    _api.post('/attendance/leave', body: {'meetingId': widget.meetingId, 'room': widget.roomId}).then((_) {}, onError: (e) {
      debugPrint('[Meeting] Failed to report leave: $e');
    });
  }

  void _receiveChatMessage(dynamic msg) {
    if (!mounted || msg is! Map) return;
    final id = (msg['id'] ?? '${msg['senderId']}-${msg['createdAt'] ?? DateTime.now().microsecondsSinceEpoch}').toString();
    if (_seenMessageIds.contains(id)) return;
    _seenMessageIds.add(id);
    final currentUserId = context.read<AuthProvider>().currentUser?.id;
    final senderId = (msg['senderId'] ?? msg['userId'] ?? '').toString();
    setState(() {
      _chatMessages.add(ChatMessage(
        id: id,
        userId: senderId,
        userName: senderId == currentUserId ? 'You' : (msg['senderName'] ?? msg['userName'] ?? 'Unknown').toString(),
        message: (msg['body'] ?? msg['message'] ?? '').toString(),
        fileUrl: msg['fileUrl']?.toString(),
        createdAt: (msg['createdAt'] ?? DateTime.now().toIso8601String()).toString(),
      ));
      if (_chatMessages.length > _maxChatMessages) {
        final removed = _chatMessages.removeAt(0);
        _seenMessageIds.remove(removed.id);
      }
    });
  }

  void _sendMessage() {
    final text = _chatController.text.trim();
    if (text.isEmpty) return;
    if (text.startsWith('/')) {
      _handleSlashCommand(text);
      return;
    }
    _socket.emit('chat-message', {'body': text});
    _chatController.clear();
  }

  void _handleSlashCommand(String cmd) {
    final parts = cmd.split(' ');
    if (parts[0] == '/mute' && parts.length > 1 && parts[1] == 'all') {
      _socket.emit('mute-all', {});
    }
    _chatController.clear();
  }

  Future<void> _toggleVideo() async {
    setState(() => _cameraBusy = true);
    await _lk.toggleVideo();
    if (!mounted) return;
    setState(() => _cameraBusy = false);
    if (_lk.lastError != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_lk.lastError!), backgroundColor: const Color(0xFFB91C1C)));
      }
    }
  }

  Future<void> _toggleScreenShare() async {
    final error = await _lk.toggleScreenShare();
    if (!mounted || error == null) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error), backgroundColor: const Color(0xFFB91C1C)));
  }

  Future<void> _selectMicrophone(lk.MediaDevice device) async {
    await _lk.room?.setAudioInputDevice(device);
    setState(() => _selectedMicrophone = device);
  }

  Future<void> _selectCamera(lk.MediaDevice device) async {
    await _lk.room?.setVideoInputDevice(device);
    setState(() => _selectedCamera = device);
  }

  Future<void> _selectSpeaker(lk.MediaDevice device) async {
    await _lk.room?.setAudioOutputDevice(device);
    setState(() => _selectedSpeaker = device);
  }

  @override
  Widget build(BuildContext context) {
    if (_connecting) return _stateScaffold('Connecting to meeting...', null);
    if (_error != null) return _stateScaffold(_error!, Icons.error_outline);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1A),
      body: Stack(
        children: [
          Column(
            children: [
              _TopBar(
                meetingId: widget.meetingId,
                onSettings: () => setState(() {
                  _sidePanelTab = 2;
                  _showSettings = !_showSettings;
                  if (_showSettings) {
                    _showChat = false;
                    _showParticipants = false;
                  }
                }),
                onLeave: _confirmLeave,
              ),
              _screenShareBar(),
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: ListenableBuilder(
                        listenable: Listenable.merge([
                          _lk.isScreenSharing,
                          _lk.participants,
                          _lk.screenShareTrack,
                          _lk.videoTracks,
                          _lk.screenShareTracks,
                        ]),
                        builder: (_, __) {
                          final selectedShareExists = _selectedScreenShareId != null &&
                              _screenSharers.any(
                                (participant) => participant['id'].toString() == _selectedScreenShareId,
                              );
                          return selectedShareExists
                              ? _screenShareView(_selectedScreenShareId!)
                              : (_viewMode == 'speaker' ? _speakerView() : _videoGrid());
                        },
                      ),
                    ),
                    if (_showChat || _showParticipants || _showSettings)
                      SizedBox(
                        width: 320,
                        child: _sidePanelTabs(),
                      ),
                  ],
                ),
              ),
              ListenableBuilder(
                listenable: Listenable.merge([
                  _lk.isMuted,
                  _lk.isVideoOff,
                  _lk.isScreenSharing,
                  _lk.isRecording,
                  _lk.isHandRaised,
                ]),
                builder: (_, __) => MeetingControls(
                  isMuted: _lk.isMuted.value,
                  isVideoOff: _lk.isVideoOff.value,
                  isScreenSharing: _lk.isScreenSharing.value,
                  isRecording: _lk.isRecording.value,
                  isHandRaised: _lk.isHandRaised.value,
                  isCameraLoading: _cameraBusy,
                  microphones: _microphones,
                  cameras: _cameras,
                  speakers: _speakers,
                  selectedMicrophone: _selectedMicrophone,
                  selectedCamera: _selectedCamera,
                  selectedSpeaker: _selectedSpeaker,
                  onToggleMute: _lk.toggleMute,
                  onToggleVideo: _toggleVideo,
                  onToggleScreenShare: _toggleScreenShare,
                  onRaiseHand: _lk.raiseHand,
                  onToggleChat: () => setState(() {
                    _sidePanelTab = 0;
                    _showChat = !_showChat;
                    if (_showChat) {
                      _showParticipants = false;
                      _showSettings = false;
                    }
                  }),
                  onToggleParticipants: () => setState(() {
                    _sidePanelTab = 1;
                    _showParticipants = !_showParticipants;
                    if (_showParticipants) {
                      _showChat = false;
                      _showSettings = false;
                    }
                  }),
                  onRequestRecording: () => {
                    _lk.isRecording.value = !_lk.isRecording.value,
                    if (_lk.isRecording.value && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Recording started'), duration: Duration(seconds: 2)),
                      )
                    }
                  },
                  onRequestRemoteControl: () => setState(() => _isControlled = !_isControlled),
                  onLeave: _confirmLeave,
                  onShowBreakout: () => setState(() => _showBreakout = true),
                  onSelectMicrophone: _selectMicrophone,
                  onSelectCamera: _selectCamera,
                  onSelectSpeaker: _selectSpeaker,
                ),
              ),
            ],
          ),
          ValueListenableBuilder<bool>(
            valueListenable: _lk.isRecording,
            builder: (_, recording, __) => recording ? const Positioned(top: 58, left: 14, child: _RecordingBadge()) : const SizedBox.shrink(),
          ),
          ValueListenableBuilder<bool>(
            valueListenable: _lk.isScreenSharing,
            builder: (_, sharing, __) => sharing ? Positioned(top: 58, left: 0, right: 0, child: Center(child: _sharingBanner())) : const SizedBox.shrink(),
          ),
          if (_isControlled) Positioned(top: 58, right: 18, child: _statusPill(Icons.settings_remote, 'Screen is being controlled', const Color(0xFFF59E0B))),
          if (_showBreakout) _breakoutOverlay(),
        ],
      ),
    );
  }

  void _confirmLeave() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave Meeting'),
        content: const Text('Are you sure you want to leave the meeting?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Stay')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.of(context).pop();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
  }

  Widget _stateScaffold(String text, IconData? icon) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1A),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon == null) const CircularProgressIndicator(color: Color(0xFF22D3EE)) else Icon(icon, color: const Color(0xFFF87171), size: 46),
            const SizedBox(height: 16),
            Text(text, style: const TextStyle(color: Colors.white, fontSize: 16)),
            if (icon != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Back')),
            ],
          ],
        ),
      ),
    );
  }

  Widget _videoGrid() {
    return Container(
      color: const Color(0xFF0A0F1A),
      padding: const EdgeInsets.all(10),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return ValueListenableBuilder<List<Map<String, dynamic>>>(
            valueListenable: _lk.participants,
            builder: (_, participants, __) {
              final list = List<Map<String, dynamic>>.from(participants.isEmpty
                  ? [
                      {
                        'id': context.read<AuthProvider>().currentUser?.id ?? 'local',
                        'name': context.read<AuthProvider>().currentUser?.name ?? 'You',
                        'muted': _lk.isMuted.value,
                        'videoOff': _lk.isVideoOff.value,
                        'speaking': false,
                        'isLocal': true,
                      }
                    ]
                  : participants);
              list.sort((a, b) {
                final aLocal = a['isLocal'] == true;
                final bLocal = b['isLocal'] == true;
                if (aLocal != bLocal) return aLocal ? 1 : -1;
                final aRank = a['videoOff'] != true
                    ? 0
                    : a['speaking'] == true
                        ? 1
                        : 2;
                final bRank = b['videoOff'] != true
                    ? 0
                    : b['speaking'] == true
                        ? 1
                        : 2;
                return aRank.compareTo(bRank);
              });
              final count = list.length;
              final cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
              final rows = (count + cols - 1) ~/ cols;
              final tileWidth = constraints.maxWidth / cols;
              final tileHeight = constraints.maxHeight / rows;

              if (count == 2) {
                return Row(
                  children: list.map((p) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(5),
                      child: _videoTile(p),
                    ),
                  )).toList(),
                );
              }

              return Wrap(
                children: [
                  for (final participant in list)
                    SizedBox(
                      width: tileWidth,
                      height: tileHeight,
                      child: Padding(
                        padding: const EdgeInsets.all(5),
                        child: _videoTile(participant),
                      ),
                    ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _videoTile(Map<String, dynamic> participant) {
    final name = (participant['name'] ?? 'Unknown').toString();
    final id = (participant['id'] ?? '').toString();
    final isLocal = participant['isLocal'] == true;
    final muted = isLocal ? _lk.isMuted.value : participant['muted'] == true;
    final speaking = participant['speaking'] == true;
    final showSpeaking = speaking && _speakingThreshold < 0.9;

    return ListenableBuilder(
      listenable: Listenable.merge([_lk.videoTracks, _lk.localVideoTrack]),
      builder: (_, __) {
        final track = isLocal ? _lk.localVideoTrack.value : _lk.videoTracks.value[id];
        final videoOff = isLocal ? track == null : participant['videoOff'] == true || track == null;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          decoration: BoxDecoration(
            color: const Color(0xFF111827),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: showSpeaking ? const Color(0xFF22C55E) : const Color(0xFF293548), width: showSpeaking ? 3 : 1),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (!videoOff)
                lk.VideoTrackRenderer(track)
              else
                Center(child: _avatar(name, 42, 38)),
              Positioned(left: 10, bottom: 10, child: _nameTag(name, muted)),
              if (showSpeaking) const Positioned(top: 10, right: 10, child: _SpeakingBadge()),
            ],
          ),
        );
      },
    );
  }

  Widget _speakerView() {
    return ValueListenableBuilder<List<Map<String, dynamic>>>(
      valueListenable: _lk.participants,
      builder: (_, participants, __) {
        final list = List<Map<String, dynamic>>.from(participants.isEmpty
            ? [
                {
                  'id': context.read<AuthProvider>().currentUser?.id ?? 'local',
                  'name': context.read<AuthProvider>().currentUser?.name ?? 'You',
                  'muted': _lk.isMuted.value,
                  'videoOff': _lk.isVideoOff.value,
                  'speaking': false,
                  'isLocal': true,
                }
              ]
            : participants);
        final focused = _focusedSpeaker(list);
        return Container(
          color: const Color(0xFF0A0F1A),
          padding: const EdgeInsets.all(10),
          child: Column(
            children: [
              Expanded(child: _videoTile(focused)),
              if (list.length > 1) ...[
                const SizedBox(height: 10),
                SizedBox(
                  height: 90,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, index) => SizedBox(
                      width: 128,
                      height: 80,
                      child: _videoTile(list[index]),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Map<String, dynamic> _focusedSpeaker(List<Map<String, dynamic>> participants) {
    return participants.firstWhere(
      (participant) => participant['videoOff'] != true,
      orElse: () => participants.firstWhere(
        (participant) => participant['speaking'] == true,
        orElse: () => participants.first,
      ),
    );
  }

  Widget _screenShareBar() {
    return ListenableBuilder(
      listenable: Listenable.merge([
        _lk.isScreenSharing,
        _lk.participants,
        _lk.screenShareTrack,
        _lk.videoTracks,
        _lk.screenShareTracks,
      ]),
      builder: (_, __) {
        if (!_hasScreenShares) return const SizedBox.shrink();
        final tabs = <Widget>[
          _screenShareTab(
            label: 'Meeting',
            icon: _viewMode == 'speaker' ? Icons.person : Icons.grid_view,
            isActive: _selectedScreenShareId == null,
            isLive: false,
            onTap: () => setState(() => _selectedScreenShareId = null),
          ),
          for (final participant in _screenSharers)
            _screenShareTab(
              label: (participant['name'] ?? 'Screen share').toString(),
              icon: Icons.screen_share,
              isActive: _selectedScreenShareId == participant['id'].toString(),
              isLive: _screenShareTrackFor(participant) != null,
              onTap: () => setState(() => _selectedScreenShareId = participant['id'].toString()),
            ),
        ];
        return Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: const BoxDecoration(
            color: Color(0xFF111827),
            border: Border(bottom: BorderSide(color: Color(0xFF263244))),
          ),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: tabs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 4),
            itemBuilder: (_, index) => tabs[index],
          ),
        );
      },
    );
  }

  Widget _screenShareTab({
    required String label,
    required IconData icon,
    required bool isActive,
    required bool isLive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF164E63) : const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isActive ? const Color(0xFF22D3EE) : const Color(0xFF263244),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isActive ? const Color(0xFF22D3EE) : Colors.white54),
            const SizedBox(width: 6),
            Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isActive ? Colors.white : Colors.white54,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (isLive) ...[
              const SizedBox(width: 6),
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Color(0xFF22C55E),
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  lk.VideoTrack? _screenShareTrackFor(Map<String, dynamic> participant) {
    if (participant['isLocal'] == true) return _lk.screenShareTrack.value;
    return _lk.screenShareTracks.value[participant['id'].toString()];
  }

  Widget _screenShareView(String participantId) {
    return ListenableBuilder(
      listenable: Listenable.merge([
        _lk.participants,
        _lk.screenShareTrack,
        _lk.videoTracks,
        _lk.screenShareTracks,
      ]),
      builder: (_, __) {
        final participant = _screenSharers.firstWhere(
          (item) => item['id'].toString() == participantId,
          orElse: () => {
            'id': participantId,
            'name': 'Screen share',
            'isLocal': false,
          },
        );
        final participantName = (participant['name'] ?? 'Screen share').toString();
        final track = _screenShareTrackFor(participant);
        return Container(
          color: const Color(0xFF0A0F1A),
          padding: const EdgeInsets.all(10),
          child: Center(
            child: track != null
                ? lk.VideoTrackRenderer(track, fit: lk.VideoViewFit.contain)
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.screen_share, size: 64, color: Colors.white38),
                      const SizedBox(height: 16),
                      Text(
                        participantName,
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Waiting for screen share stream...',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }

  Widget _sidePanelTabs() {
    return _sidePanel(
      title: _sidePanelTab == 0
          ? 'Chat'
          : _sidePanelTab == 1
              ? 'Participants'
              : 'Settings',
      onClose: () {
        setState(() {
          _showChat = false;
          _showParticipants = false;
          _showSettings = false;
        });
      },
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _sidePanelTab = 0;
                    _showChat = true;
                    _showParticipants = false;
                    _showSettings = false;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: _sidePanelTab == 0 ? const Color(0xFF22D3EE) : const Color(0xFF263244), width: 2)),
                    ),
                    child: Center(child: Text('Chat', style: TextStyle(color: _sidePanelTab == 0 ? Colors.white : Colors.white54, fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _sidePanelTab = 1;
                    _showChat = false;
                    _showParticipants = true;
                    _showSettings = false;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: _sidePanelTab == 1 ? const Color(0xFF22D3EE) : const Color(0xFF263244), width: 2)),
                    ),
                    child: Center(child: Text('Participants', style: TextStyle(color: _sidePanelTab == 1 ? Colors.white : Colors.white54, fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _sidePanelTab = 2;
                    _showSettings = true;
                    _showChat = false;
                    _showParticipants = false;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: _sidePanelTab == 2 ? const Color(0xFF22D3EE) : const Color(0xFF263244), width: 2)),
                    ),
                    child: Center(child: Text('Settings', style: TextStyle(color: _sidePanelTab == 2 ? Colors.white : Colors.white54, fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
            ],
          ),
          Expanded(
            child: _sidePanelTab == 0
                ? _chatPanelContent()
                : _sidePanelTab == 1
                    ? _participantsPanelContent()
                    : _settingsPanelContent(),
          ),
        ],
      ),
    );
  }

  Widget _chatPanelContent() {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(14),
            itemCount: _chatMessages.length,
            itemBuilder: (_, index) {
              final msg = _chatMessages[index];
              final time = DateTime.tryParse(msg.createdAt);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(msg.userName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                        const SizedBox(width: 8),
                        Text(time == null ? '' : DateFormat('HH:mm').format(time), style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(msg.message, style: const TextStyle(color: Colors.white70, height: 1.35)),
                  ],
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFF263244)))),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.emoji_emotions_outlined, color: Colors.white54, size: 20),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Emoji picker coming soon'), duration: Duration(seconds: 1)),
                  );
                },
              ),
              Expanded(
                child: TextField(
                  controller: _chatController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Message everyone',
                    hintStyle: const TextStyle(color: Colors.white54),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send, color: Color(0xFF22D3EE))),
            ],
          ),
        ),
      ],
    );
  }

  Widget _participantsPanelContent() {
    return ValueListenableBuilder<List<Map<String, dynamic>>>(
      valueListenable: _lk.participants,
      builder: (_, participants, __) => ListView.builder(
        padding: const EdgeInsets.all(10),
        itemCount: participants.length,
        itemBuilder: (_, index) {
          final p = participants[index];
          final name = (p['name'] ?? 'Unknown').toString();
          return ListTile(
            leading: _avatar(name, 17, 15),
            title: Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white)),
            subtitle: p['isLocal'] == true ? const Text('You', style: TextStyle(color: Colors.white54, fontSize: 12)) : null,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  p['muted'] == true ? Icons.mic_off : Icons.mic,
                  color: p['muted'] == true ? const Color(0xFFF87171) : const Color(0xFF22C55E),
                  size: 16,
                ),
                const SizedBox(width: 6),
                Icon(
                  p['videoOff'] == true ? Icons.videocam_off : Icons.videocam,
                  color: p['videoOff'] == true ? const Color(0xFFF87171) : const Color(0xFF22C55E),
                  size: 16,
                ),
                const SizedBox(width: 6),
                Opacity(
                  opacity: _isParticipantScreenSharing(p) ? 1 : 0.3,
                  child: Icon(
                    Icons.screen_share,
                    color: _isParticipantScreenSharing(p) ? const Color(0xFF22C55E) : const Color(0xFF374151),
                    size: 16,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  bool _isParticipantScreenSharing(Map<String, dynamic> participant) {
    if (participant['isLocal'] == true) return _lk.isScreenSharing.value;
    return participant['screenSharing'] == true || participant['isScreenSharing'] == true;
  }

  Widget _settingsPanelContent() {
    return Column(
      children: [
        Row(
          children: [
            _settingsTabButton('Audio', 0),
            _settingsTabButton('View', 1),
            _settingsTabButton('Accessibility', 2),
          ],
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _settingsTab == 0
                ? _audioSettings()
                : _settingsTab == 1
                    ? _viewSettings()
                    : _accessibilitySettings(),
          ),
        ),
      ],
    );
  }

  Widget _settingsTabButton(String label, int index) {
    final selected = _settingsTab == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _settingsTab = index),
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: selected ? const Color(0xFF22D3EE) : const Color(0xFF263244), width: 2)),
          ),
          child: Text(label, style: TextStyle(color: selected ? Colors.white : Colors.white54, fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Widget _audioSettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _deviceDropdown('Microphone', _microphones, _selectedMicrophone, _selectMicrophone),
        const SizedBox(height: 16),
        _deviceDropdown('Speaker', _speakers, _selectedSpeaker, _selectSpeaker),
        const SizedBox(height: 16),
        _deviceDropdown('Camera', _cameras, _selectedCamera, _selectCamera),
        const SizedBox(height: 22),
        _sliderSetting(
          label: 'Volume',
          value: _volume,
          valueLabel: '${_volume.round()}%',
          onChanged: (value) => setState(() => _volume = value),
        ),
        const SizedBox(height: 10),
        _darkSwitchTile(
          title: 'Noise suppression',
          value: _noiseSuppression,
          onChanged: (value) => setState(() => _noiseSuppression = value),
        ),
      ],
    );
  }

  Widget _viewSettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Layout', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: ToggleButtons(
            isSelected: [_viewMode == 'gallery', _viewMode == 'speaker'],
            onPressed: (index) => setState(() => _viewMode = index == 0 ? 'gallery' : 'speaker'),
            borderColor: const Color(0xFF263244),
            selectedBorderColor: const Color(0xFF22D3EE),
            fillColor: const Color(0xFF164E63),
            selectedColor: Colors.white,
            color: Colors.white54,
            constraints: const BoxConstraints(minHeight: 40, minWidth: 136),
            borderRadius: BorderRadius.circular(6),
            children: const [Text('Gallery View'), Text('Speaker View')],
          ),
        ),
        const SizedBox(height: 24),
        _sliderSetting(
          label: 'Speaker sensitivity',
          value: _speakerSensitivity,
          valueLabel: '${_speakerSensitivity.round()}%',
          onChanged: (value) => setState(() => _speakerSensitivity = value),
        ),
        const SizedBox(height: 4),
        const Text('Higher is more sensitive. Below 10% disables the speaking indicator.', style: TextStyle(color: Colors.white54, fontSize: 11, height: 1.4)),
      ],
    );
  }

  Widget _accessibilitySettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _darkSwitchTile(
          title: 'Closed captions',
          value: _closedCaptions,
          onChanged: (value) => setState(() => _closedCaptions = value),
        ),
        const SizedBox(height: 18),
        const Text('Font size', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: _nameTagFontSize,
          dropdownColor: const Color(0xFF111827),
          style: const TextStyle(color: Colors.white),
          decoration: _settingsInputDecoration(),
          items: const [
            DropdownMenuItem(value: 'Small', child: Text('Small')),
            DropdownMenuItem(value: 'Medium', child: Text('Medium')),
            DropdownMenuItem(value: 'Large', child: Text('Large')),
          ],
          onChanged: (value) {
            if (value != null) setState(() => _nameTagFontSize = value);
          },
        ),
      ],
    );
  }

  Widget _deviceDropdown(
    String label,
    List<lk.MediaDevice> devices,
    lk.MediaDevice? selected,
    Future<void> Function(lk.MediaDevice) onChanged,
  ) {
    final selectedValue = devices.any((device) => device.deviceId == selected?.deviceId) ? selected?.deviceId : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: selectedValue,
          isExpanded: true,
          dropdownColor: const Color(0xFF111827),
          style: const TextStyle(color: Colors.white),
          decoration: _settingsInputDecoration(),
          hint: const Text('No device available', style: TextStyle(color: Colors.white38)),
          items: devices
              .map((device) => DropdownMenuItem(
                    value: device.deviceId,
                    child: Text(device.label.isEmpty ? 'Default device' : device.label, overflow: TextOverflow.ellipsis),
                  ))
              .toList(),
          onChanged: (deviceId) {
            if (deviceId == null) return;
            final device = devices.firstWhere((item) => item.deviceId == deviceId);
            onChanged(device);
          },
        ),
      ],
    );
  }

  InputDecoration _settingsInputDecoration() {
    return InputDecoration(
      filled: true,
      fillColor: const Color(0xFF0F172A),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF263244))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF22D3EE))),
    );
  }

  Widget _sliderSetting({
    required String label,
    required double value,
    required String valueLabel,
    required ValueChanged<double> onChanged,
  }) {
    return Column(
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(valueLabel, style: const TextStyle(color: Color(0xFF22D3EE), fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
        Slider(
          value: value,
          min: 0,
          max: 100,
          activeColor: const Color(0xFF22D3EE),
          inactiveColor: const Color(0xFF263244),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _darkSwitchTile({
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      value: value,
      activeColor: const Color(0xFF22D3EE),
      onChanged: onChanged,
    );
  }

  Widget _sidePanel({required String title, required VoidCallback onClose, required Widget child}) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF111827),
        border: Border(left: BorderSide(color: Color(0xFF263244))),
      ),
      child: Column(
        children: [
          Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFF263244)))),
            child: Row(
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                const Spacer(),
                IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: Colors.white70, size: 20)),
              ],
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }

  Widget _breakoutOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black54,
        alignment: Alignment.center,
        child: Container(
          width: 380,
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF263244))),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Text('Breakout Rooms', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  IconButton(onPressed: () => setState(() => _showBreakout = false), icon: const Icon(Icons.close, color: Colors.white70)),
                ],
              ),
              const SizedBox(height: 12),
              _roomRow('Main Room', 'Joined'),
              _roomRow('Room 1', '0 participants'),
              _roomRow('Room 2', '0 participants'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _roomRow(String title, String status) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: [
          const Icon(Icons.meeting_room_outlined, color: Colors.white70),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(color: Colors.white))),
          Text(status, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _sharingBanner() => _statusPill(Icons.screen_share, 'You are sharing your screen', const Color(0xFF16A34A));

  static Widget _statusPill(IconData icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 15),
          const SizedBox(width: 7),
          Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _nameTag(String name, bool muted) {
    final fontSize = _nameTagFontSize == 'Small'
        ? 10.0
        : _nameTagFontSize == 'Large'
            ? 14.0
            : 12.0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: Colors.black.withOpacity(0.62), borderRadius: BorderRadius.circular(14)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (muted) ...[
            const Icon(Icons.mic_off, color: Color(0xFFF87171), size: 14),
            const SizedBox(width: 5),
          ],
          Text(name, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: fontSize)),
        ],
      ),
    );
  }

  Widget _avatar(String name, double radius, double fontSize) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFF164E63),
      child: Text(initial, style: TextStyle(color: const Color(0xFFA5F3FC), fontSize: fontSize, fontWeight: FontWeight.w900)),
    );
  }
}

class _TopBar extends StatelessWidget {
  final String meetingId;
  final VoidCallback onSettings;
  final VoidCallback onLeave;
  static final _lk = LiveKitService();

  const _TopBar({required this.meetingId, required this.onSettings, required this.onLeave});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: const BoxDecoration(color: Color(0xFF111827), border: Border(bottom: BorderSide(color: Color(0xFF263244)))),
      child: Row(
        children: [
          const Icon(Icons.lock_outline, color: Colors.white70, size: 18),
          const SizedBox(width: 8),
          Text(meetingId, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          const SizedBox(width: 18),
          const _ElapsedTimer(),
          const SizedBox(width: 18),
          ValueListenableBuilder<int>(
            valueListenable: _lk.participantCount,
            builder: (_, count, __) => Row(
              children: [
                const Icon(Icons.people_outline, color: Colors.white70, size: 18),
                const SizedBox(width: 5),
                Text('$count', style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const Spacer(),
          IconButton(
            tooltip: 'Copy meeting link',
            icon: const Icon(Icons.link, color: Colors.white70, size: 20),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: 'https://app.infovibex.com/join/$meetingId'));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied'), duration: Duration(seconds: 1)));
            },
          ),
          IconButton(
            tooltip: 'Meeting settings',
            onPressed: onSettings,
            icon: const Icon(Icons.settings, color: Colors.white70, size: 20),
          ),
          IconButton(tooltip: 'Leave meeting', onPressed: onLeave, icon: const Icon(Icons.close, color: Colors.white)),
        ],
      ),
    );
  }
}

class _ElapsedTimer extends StatefulWidget {
  final TextStyle? style;
  const _ElapsedTimer({this.style});

  @override
  State<_ElapsedTimer> createState() => _ElapsedTimerState();
}

class _ElapsedTimerState extends State<_ElapsedTimer> {
  int _seconds = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = _seconds ~/ 3600;
    final m = (_seconds % 3600) ~/ 60;
    final s = _seconds % 60;
    final text = h > 0
        ? '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}'
        : '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    return Row(
      children: [
        const Icon(Icons.timer_outlined, color: Colors.white70, size: 18),
        const SizedBox(width: 5),
        Text(text, style: widget.style ?? const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _RecordingBadge extends StatelessWidget {
  const _RecordingBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFB91C1C), borderRadius: BorderRadius.circular(16)),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.fiber_manual_record, color: Colors.white, size: 13),
          SizedBox(width: 5),
          Text('REC', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
          SizedBox(width: 7),
          _ElapsedTimer(style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
        ],
      ),
    );
  }
}

class _SpeakingBadge extends StatelessWidget {
  const _SpeakingBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle),
      child: const Icon(Icons.graphic_eq, color: Colors.white, size: 14),
    );
  }
}
