import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' show desktopCapturer, SourceType;
import 'package:livekit_client/livekit_client.dart' as lk;
import '../screen_sharer.dart';

class WindowsScreenSharer implements ScreenSharer {
  @override
  Future<String?> startScreenShare(lk.LocalParticipant participant) async {
    // First try the native OS picker
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
      debugPrint('[ScreenShare] OS picker failed: $errorMsg');
    }

    // OS picker failed — fall back to DesktopCapturer + sourceId
    debugPrint('[ScreenShare] Trying DesktopCapturer fallback');
    try {
      final sources = await desktopCapturer
          .getSources(types: [SourceType.Screen, SourceType.Window])
          .timeout(const Duration(seconds: 5));

      if (sources.isEmpty) {
        return 'Screen capture not available on this system.\n'
            'This can happen when running in a Remote Desktop (RDP) session, a VM, or when graphics drivers are missing.\n'
            'Please try running directly on your local Windows desktop.';
      }

      await participant.setScreenShareEnabled(
        true,
        screenShareCaptureOptions: lk.ScreenShareCaptureOptions(sourceId: sources.first.id),
      ).timeout(const Duration(seconds: 15));

      return null;
    } on TimeoutException {
      return 'Screen share timed out. Please try again.';
    } catch (e) {
      final errorMsg = e.toString();
      if (errorMsg.contains('cancel') || errorMsg.contains('abort') || errorMsg.contains('cancelled')) {
        return 'Screen share cancelled';
      }
      return 'Screen capture not available on this system.\n'
          'This can happen when running in a Remote Desktop (RDP) session, a VM, or when graphics drivers are missing.\n'
          'Please try running directly on your local Windows desktop.';
    }
  }
}
