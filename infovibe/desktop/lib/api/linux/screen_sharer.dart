import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../screen_sharer.dart';

class LinuxScreenSharer implements ScreenSharer {
  @override
  Future<String?> startScreenShare(lk.LocalParticipant participant) async {
    try {
      await participant.setScreenShareEnabled(true).timeout(const Duration(seconds: 15));
      return null;
    } on TimeoutException {
      return 'Screen share timed out. Please try again.';
    } catch (e) {
      final errorMsg = e.toString();
      if (errorMsg.contains('cancel') || errorMsg.contains('abort') || errorMsg.contains('cancelled')) {
        return 'Screen share cancelled';
      }
      debugPrint('[ScreenShare] Portal picker failed: $errorMsg');
      return 'Screen share is not available on this Linux system.\n'
          'The PipeWire screen cast portal did not open. This is a known limitation\n'
          'of screen sharing on Linux with this version of Flutter WebRTC.\n'
          'Please use the Windows app for screen sharing.';
    }
  }
}
