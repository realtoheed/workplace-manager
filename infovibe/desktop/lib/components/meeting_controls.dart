import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;

class MeetingControls extends StatefulWidget {
  final bool isMuted;
  final bool isVideoOff;
  final bool isScreenSharing;
  final bool isRecording;
  final bool isHandRaised;
  final bool isCameraLoading;
  final List<lk.MediaDevice> microphones;
  final List<lk.MediaDevice> cameras;
  final List<lk.MediaDevice> speakers;
  final lk.MediaDevice? selectedMicrophone;
  final lk.MediaDevice? selectedCamera;
  final lk.MediaDevice? selectedSpeaker;
  final VoidCallback onToggleMute;
  final VoidCallback onToggleVideo;
  final VoidCallback onToggleScreenShare;
  final VoidCallback onRaiseHand;
  final VoidCallback onToggleChat;
  final VoidCallback onToggleParticipants;
  final VoidCallback onRequestRecording;
  final VoidCallback onRequestRemoteControl;
  final VoidCallback onLeave;
  final VoidCallback onShowBreakout;
  final ValueChanged<lk.MediaDevice> onSelectMicrophone;
  final ValueChanged<lk.MediaDevice> onSelectCamera;
  final ValueChanged<lk.MediaDevice> onSelectSpeaker;

  const MeetingControls({
    super.key,
    required this.isMuted,
    required this.isVideoOff,
    required this.isScreenSharing,
    required this.isRecording,
    required this.isHandRaised,
    required this.onToggleMute,
    required this.onToggleVideo,
    required this.onToggleScreenShare,
    required this.onRaiseHand,
    required this.onToggleChat,
    required this.onToggleParticipants,
    required this.onRequestRecording,
    required this.onRequestRemoteControl,
    required this.onLeave,
    required this.onShowBreakout,
    this.isCameraLoading = false,
    this.microphones = const [],
    this.cameras = const [],
    this.speakers = const [],
    this.selectedMicrophone,
    this.selectedCamera,
    this.selectedSpeaker,
    required this.onSelectMicrophone,
    required this.onSelectCamera,
    required this.onSelectSpeaker,
  });

  @override
  State<MeetingControls> createState() => _MeetingControlsState();
}

class _MeetingControlsState extends State<MeetingControls>
    with SingleTickerProviderStateMixin {
  bool _showTooltips = true;
  late final AnimationController _leavePulseController;
  late final Animation<double> _leavePulse;

  @override
  void initState() {
    super.initState();
    _leavePulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    )..repeat(reverse: true);
    _leavePulse = Tween<double>(begin: 0.98, end: 1.07).animate(
      CurvedAnimation(parent: _leavePulseController, curve: Curves.easeInOut),
    );
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _showTooltips = false);
    });
  }

  @override
  void dispose() {
    _leavePulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 74,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: const BoxDecoration(
        color: Color(0xFF111827),
        border: Border(top: BorderSide(color: Color(0xFF253041))),
        boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 14)],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _group([
            _button(
              icon: widget.isMuted ? Icons.mic_off : Icons.mic,
              label: widget.isMuted ? 'Unmute' : 'Mute',
              active: widget.isMuted,
              activeColor: const Color(0xFFEF4444),
              onTap: widget.onToggleMute,
            ),
            _deviceMenu(
              icon: Icons.keyboard_arrow_up,
              title: 'Microphone',
              devices: widget.microphones,
              selected: widget.selectedMicrophone,
              onSelected: widget.onSelectMicrophone,
            ),
          ]),
          _divider(),
          _group([
            _button(
              icon: widget.isVideoOff ? Icons.videocam_off : Icons.videocam,
              label: widget.isVideoOff ? 'Start Video' : 'Stop Video',
              active: widget.isVideoOff,
              activeColor: const Color(0xFFEF4444),
              loading: widget.isCameraLoading,
              onTap: widget.isCameraLoading ? null : widget.onToggleVideo,
            ),
            _deviceMenu(
              icon: Icons.keyboard_arrow_up,
              title: 'Camera',
              devices: widget.cameras,
              selected: widget.selectedCamera,
              onSelected: widget.onSelectCamera,
            ),
          ]),
          _divider(),
          _button(
            icon: widget.isScreenSharing ? Icons.stop_screen_share : Icons.screen_share,
            label: widget.isScreenSharing ? 'Stop Share' : 'Share Screen',
            active: widget.isScreenSharing,
            activeColor: const Color(0xFF22C55E),
            onTap: widget.onToggleScreenShare,
          ),
          _divider(),
          _button(
            icon: widget.isHandRaised ? Icons.pan_tool : Icons.pan_tool_outlined,
            label: widget.isHandRaised ? 'Lower Hand' : 'Raise Hand',
            active: widget.isHandRaised,
            activeColor: const Color(0xFFF59E0B),
            onTap: widget.onRaiseHand,
          ),
          const SizedBox(width: 12),
          _group([
            _button(icon: Icons.chat_bubble_outline, label: 'Chat', onTap: widget.onToggleChat),
            _button(icon: Icons.people_outline, label: 'Participants', onTap: widget.onToggleParticipants),
            _moreMenu(),
            _deviceMenu(
              icon: Icons.volume_up_outlined,
              title: 'Speaker',
              devices: widget.speakers,
              selected: widget.selectedSpeaker,
              onSelected: widget.onSelectSpeaker,
            ),
          ]),
          const SizedBox(width: 18),
          ScaleTransition(
            scale: _leavePulse,
            child: _PressScale(
              child: Tooltip(
                message: 'Leave meeting',
                child: Material(
                  color: const Color(0xFFDC2626),
                  shape: const CircleBorder(),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    splashColor: Colors.white24,
                    onTap: widget.onLeave,
                    child: const SizedBox(
                      width: 54,
                      height: 54,
                      child: Icon(Icons.call_end, color: Colors.white, size: 25),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _group(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF1F2937),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: children),
    );
  }

  Widget _button({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    bool active = false,
    bool loading = false,
    Color activeColor = Colors.white,
  }) {
    final color = active ? activeColor : Colors.white;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Tooltip(
        message: _showTooltips ? label : '',
        child: _PressScale(
          child: Material(
            color: active ? activeColor.withOpacity(0.20) : Colors.white.withOpacity(0.09),
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              customBorder: const CircleBorder(),
              splashColor: color.withOpacity(0.18),
              onTap: onTap,
              child: SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Icon(icon, color: color, size: 22),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _deviceMenu({
    required IconData icon,
    required String title,
    required List<lk.MediaDevice> devices,
    required lk.MediaDevice? selected,
    required ValueChanged<lk.MediaDevice> onSelected,
  }) {
    return PopupMenuButton<lk.MediaDevice>(
      tooltip: _showTooltips ? '$title settings' : '',
      color: const Color(0xFF1F2937),
      elevation: 14,
      offset: const Offset(0, -8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: onSelected,
      itemBuilder: (context) => [
        PopupMenuItem<lk.MediaDevice>(
          enabled: false,
          child: Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ),
        if (devices.isEmpty)
          const PopupMenuItem<lk.MediaDevice>(
            enabled: false,
            child: Text('No devices found', style: TextStyle(color: Colors.white54)),
          ),
        ...devices.map((device) => PopupMenuItem<lk.MediaDevice>(
              value: device,
              child: Row(
                children: [
                  Icon(
                    selected?.deviceId == device.deviceId ? Icons.check : Icons.devices,
                    size: 18,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      device.label.isEmpty ? 'Default device' : device.label,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
            )),
      ],
      child: _smallCircle(icon),
    );
  }

  Widget _moreMenu() {
    return PopupMenuButton<int>(
      tooltip: _showTooltips ? 'More' : '',
      color: const Color(0xFF1F2937),
      elevation: 14,
      offset: const Offset(0, -8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (value) {
        if (value == 0) widget.onRequestRecording();
        if (value == 1) widget.onRequestRemoteControl();
        if (value == 2) widget.onShowBreakout();
      },
      itemBuilder: (_) => [
        PopupMenuItem(value: 0, child: _menuRow(Icons.fiber_manual_record, widget.isRecording ? 'Stop recording' : 'Record')),
        PopupMenuItem(value: 1, child: _menuRow(Icons.settings_remote, 'Remote control')),
        PopupMenuItem(value: 2, child: _menuRow(Icons.meeting_room_outlined, 'Breakout rooms')),
      ],
      child: _smallCircle(Icons.more_horiz),
    );
  }

  Widget _smallCircle(IconData icon) {
    return _PressScale(
      child: Material(
        color: Colors.white.withOpacity(0.08),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: SizedBox(width: 32, height: 32, child: Icon(icon, color: Colors.white, size: 18)),
      ),
    );
  }

  Widget _menuRow(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.white),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(color: Colors.white)),
      ],
    );
  }

  Widget _divider() => Container(
        width: 1,
        height: 34,
        margin: const EdgeInsets.symmetric(horizontal: 10),
        color: Colors.white.withOpacity(0.12),
      );
}

class _PressScale extends StatefulWidget {
  final Widget child;
  const _PressScale({required this.child});

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.94 : 1,
        duration: const Duration(milliseconds: 90),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
