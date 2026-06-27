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
      return 'Timed out waiting for screen selection';
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('cancel') || msg.contains('abort') || msg.contains('cancelled')) {
        return null;
      }
      debugPrint('[ScreenShare] OS picker failed: $msg');
      return null;
    }
  }
}
