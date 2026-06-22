import 'dart:async';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/livekit_service.dart';
import '../providers/auth_provider.dart';
import 'meeting_window.dart';

class PrejoinScreen extends StatefulWidget {
  final String meetingId;
  final String roomId;

  const PrejoinScreen({
    super.key,
    required this.meetingId,
    required this.roomId,
  });

  @override
  State<PrejoinScreen> createState() => _PrejoinScreenState();
}

class _PrejoinScreenState extends State<PrejoinScreen> {
  final _lk = LiveKitService();
  bool _cameraOn = false;
  bool _micOn = false;
  bool _connecting = true;
  bool _cameraBusy = false;
  bool _joining = false;
  String? _error;
  String _userName = '';
  lk.LocalVideoTrack? _localVideoTrack;

  StreamSubscription<List<lk.MediaDevice>>? _deviceSub;
  List<lk.MediaDevice> _cameras = [];
  List<lk.MediaDevice> _microphones = [];
  List<lk.MediaDevice> _speakers = [];
  lk.MediaDevice? _selectedCamera;
  lk.MediaDevice? _selectedMicrophone;
  lk.MediaDevice? _selectedSpeaker;

  @override
  void initState() {
    super.initState();
    _lk.localVideoTrack.addListener(_onLocalVideoTrack);
    _deviceSub = lk.Hardware.instance.onDeviceChange.stream.listen(_loadDevices);
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    await _loadDefaults();
    await _connect();
  }

  Future<void> _loadDefaults() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    final user = context.read<AuthProvider>().currentUser;
    setState(() {
      _micOn = prefs.getBool('joinMicOn') ?? false;
      _cameraOn = prefs.getBool('joinCameraOn') ?? false;
      _userName = user?.name ?? '';
    });
  }

  Future<void> _loadDevices(List<lk.MediaDevice> devices) async {
    final cameras = devices.where((d) => d.kind == 'videoinput').toList();
    final microphones = devices.where((d) => d.kind == 'audioinput').toList();
    final speakers = devices.where((d) => d.kind == 'audiooutput').toList();
    if (!mounted) return;
    setState(() {
      _cameras = cameras;
      _microphones = microphones;
      _speakers = speakers;
      _selectedCamera ??= lk.Hardware.instance.selectedVideoInput ?? (cameras.isNotEmpty ? cameras.first : null);
      _selectedMicrophone ??= lk.Hardware.instance.selectedAudioInput ?? (microphones.isNotEmpty ? microphones.first : null);
      _selectedSpeaker ??= lk.Hardware.instance.selectedAudioOutput ?? (speakers.isNotEmpty ? speakers.first : null);
    });
  }

  void _onLocalVideoTrack() {
    if (mounted) setState(() => _localVideoTrack = _lk.localVideoTrack.value);
  }

  Future<void> _connect() async {
    final user = context.read<AuthProvider>().currentUser;
    if (user == null) {
      setState(() {
        _error = 'Not logged in';
        _connecting = false;
      });
      return;
    }

    _userName = user.name;
    setState(() {
      _connecting = true;
      _error = null;
    });

    final error = _lk.isConnected ? null : await _lk.connect(widget.roomId, user.id, user.name);
    if (error == null) {
      await _lk.setMicEnabled(_micOn);
      if (_cameraOn) await _setCamera(true);
    }
    if (!mounted) return;
    setState(() {
      _connecting = false;
      _error = error;
      _localVideoTrack = _lk.localVideoTrack.value;
    });
  }

  Future<void> _setCamera(bool enabled) async {
    setState(() => _cameraBusy = true);
    await _lk.setCameraEnabled(enabled);
    if (!mounted) return;
    setState(() {
      _cameraBusy = false;
      _cameraOn = !_lk.isVideoOff.value;
      _localVideoTrack = _lk.localVideoTrack.value;
    });
  }

  Future<void> _toggleCamera() async {
    final next = !_cameraOn;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('joinCameraOn', next);
    await _setCamera(next);
    if (_lk.lastError != null && mounted && next && !_cameraOn) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_lk.lastError!)));
    }
  }

  Future<void> _toggleMic() async {
    final next = !_micOn;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('joinMicOn', next);
    await _lk.setMicEnabled(next);
    if (mounted) setState(() => _micOn = next);
  }

  Future<void> _selectCamera(lk.MediaDevice? device) async {
    if (device == null) return;
    await _lk.room?.setVideoInputDevice(device);
    setState(() => _selectedCamera = device);
  }

  Future<void> _selectMicrophone(lk.MediaDevice? device) async {
    if (device == null) return;
    await _lk.room?.setAudioInputDevice(device);
    setState(() => _selectedMicrophone = device);
  }

  Future<void> _selectSpeaker(lk.MediaDevice? device) async {
    if (device == null) return;
    await _lk.room?.setAudioOutputDevice(device);
    setState(() => _selectedSpeaker = device);
  }

  @override
  void dispose() {
    _deviceSub?.cancel();
    _lk.localVideoTrack.removeListener(_onLocalVideoTrack);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF172033), Color(0xFF08111F), Color(0xFF020617)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.meetingId,
                      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _userName.isEmpty ? 'Meeting preview' : _userName,
                      style: const TextStyle(color: Colors.white70, fontSize: 15),
                    ),
                    const SizedBox(height: 26),
                    if (_connecting) _loadingCard() else if (_error != null) _errorCard() else _previewCard(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _loadingCard() {
    return const SizedBox(
      height: 420,
      child: Center(child: CircularProgressIndicator(color: Color(0xFF22D3EE))),
    );
  }

  Widget _errorCard() {
    return Column(
      children: [
        const Icon(Icons.error_outline, color: Color(0xFFF87171), size: 48),
        const SizedBox(height: 14),
        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
        const SizedBox(height: 18),
        ElevatedButton(onPressed: _connect, child: const Text('Try again')),
      ],
    );
  }

  Widget _previewCard() {
    return Column(
      children: [
        AspectRatio(
          aspectRatio: 16 / 10,
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 620),
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withOpacity(0.10)),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.45), blurRadius: 34, offset: const Offset(0, 20))],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (_cameraOn && _localVideoTrack != null)
                  lk.VideoTrackRenderer(_localVideoTrack!)
                else
                  Center(child: _avatar(radius: 52, fontSize: 46)),
                Positioned(
                  left: 14,
                  bottom: 14,
                  child: _pill(Icons.person, _userName.isEmpty ? 'Guest' : _userName),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 22),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _roundAction(
              icon: _micOn ? Icons.mic : Icons.mic_off,
              label: _micOn ? 'Mic on' : 'Mic off',
              active: !_micOn,
              onTap: _toggleMic,
            ),
            const SizedBox(width: 18),
            _roundAction(
              icon: _cameraOn ? Icons.videocam : Icons.videocam_off,
              label: _cameraOn ? 'Camera on' : 'Camera off',
              active: !_cameraOn,
              loading: _cameraBusy,
              onTap: _cameraBusy ? null : _toggleCamera,
            ),
          ],
        ),
        const SizedBox(height: 22),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 620;
            final children = [
              _deviceDropdown('Camera', Icons.videocam_outlined, _cameras, _selectedCamera, _selectCamera),
              _deviceDropdown('Mic', Icons.mic_none, _microphones, _selectedMicrophone, _selectMicrophone),
              _deviceDropdown('Speaker', Icons.volume_up_outlined, _speakers, _selectedSpeaker, _selectSpeaker),
            ];
            return wide
                ? Row(children: children.map((c) => Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 5), child: c))).toList())
                : Column(children: children.map((c) => Padding(padding: const EdgeInsets.only(bottom: 10), child: c)).toList());
          },
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: 260,
          height: 50,
          child: ElevatedButton.icon(
            onPressed: _joining ? null : _join,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF06B6D4),
              foregroundColor: Colors.white,
              elevation: 14,
              shadowColor: const Color(0xFF06B6D4).withOpacity(0.42),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
            ),
            icon: _joining
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.video_call),
            label: Text(_joining ? 'Joining...' : 'Join Meeting', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  Widget _roundAction({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback? onTap,
    bool loading = false,
  }) {
    final color = active ? const Color(0xFFF87171) : Colors.white;
    return Column(
      children: [
        Material(
          color: active ? const Color(0xFF7F1D1D).withOpacity(0.55) : Colors.white.withOpacity(0.12),
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 58,
              height: 58,
              child: Center(
                child: loading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Icon(icon, color: color, size: 25),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _deviceDropdown(
    String label,
    IconData icon,
    List<lk.MediaDevice> devices,
    lk.MediaDevice? selected,
    ValueChanged<lk.MediaDevice?> onChanged,
  ) {
    return Container(
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withOpacity(0.10)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<lk.MediaDevice>(
          value: selected != null && devices.contains(selected) ? selected : null,
          isExpanded: true,
          dropdownColor: const Color(0xFF111827),
          iconEnabledColor: Colors.white70,
          hint: Text(label, style: const TextStyle(color: Colors.white70)),
          items: devices
              .map((device) => DropdownMenuItem(
                    value: device,
                    child: Row(
                      children: [
                        Icon(icon, color: Colors.white70, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            device.label.isEmpty ? 'Default $label' : device.label,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _pill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.black.withOpacity(0.55), borderRadius: BorderRadius.circular(18)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 6),
          Text(text, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _avatar({required double radius, required double fontSize}) {
    final initial = _userName.isNotEmpty ? _userName[0].toUpperCase() : '?';
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFF155E75),
      child: Text(initial, style: TextStyle(color: const Color(0xFFA5F3FC), fontSize: fontSize, fontWeight: FontWeight.w800)),
    );
  }

  void _join() {
    setState(() => _joining = true);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => MeetingWindow(
          meetingId: widget.meetingId,
          roomId: widget.roomId,
          initialMicOn: _micOn,
          initialCameraOn: _cameraOn,
        ),
      ),
    );
  }
}
