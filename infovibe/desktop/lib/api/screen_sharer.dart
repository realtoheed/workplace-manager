import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'linux/screen_sharer.dart' as linux;
import 'windows/screen_sharer.dart' as windows;

abstract class ScreenSharer {
  Future<String?> startScreenShare(lk.LocalParticipant participant, [BuildContext? context]);

  factory ScreenSharer() {
    if (Platform.isWindows) {
      return windows.WindowsScreenSharer();
    }
    return linux.LinuxScreenSharer();
  }
}
