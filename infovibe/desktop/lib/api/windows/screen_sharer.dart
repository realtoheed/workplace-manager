import 'dart:async';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../screen_sharer.dart';

class WindowsScreenSharer implements ScreenSharer {
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
      } else if (errorMsg.contains('getDisplayMedia') || errorMsg.contains('source not found')) {
        return 'Screen capture not available on this system.\n'
            'This can happen when running in a Remote Desktop (RDP) session, a VM, or when graphics drivers are missing.\n'
            'Please try running directly on your local Windows desktop.';
      }
      return 'Screen share failed: $errorMsg';
    }
  }
}
