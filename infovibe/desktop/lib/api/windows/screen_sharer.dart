import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../screen_sharer.dart';

class WindowsScreenSharer implements ScreenSharer {
  @override
  Future<String?> startScreenShare(lk.LocalParticipant participant, [BuildContext? context]) async {
    if (context == null) return 'Screen sharing requires a UI context';

    try {
      final sources = await desktopCapturer.getSources(
        types: [SourceType.Screen, SourceType.Window],
        thumbnailSize: ThumbnailSize(320, 240),
      );

      if (sources.isEmpty) {
        return 'No screens found to share.';
      }

      final selected = await showDialog<DesktopCapturerSource>(
        context: context,
        builder: (_) => _ScreenPickerDialog(sources: sources),
      );

      if (selected == null) return null;

      await participant.setScreenShareEnabled(
        true,
        screenShareCaptureOptions: lk.ScreenShareCaptureOptions(sourceId: selected.id),
      ).timeout(const Duration(seconds: 15));

      return null;
    } on TimeoutException {
      return 'Timed out waiting for screen selection';
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('cancel') || msg.contains('abort') || msg.contains('cancelled')) {
        return null;
      }
      debugPrint('[ScreenShare] Windows picker failed: $msg');
      return null;
    }
  }
}

class _ScreenPickerDialog extends StatelessWidget {
  final List<DesktopCapturerSource> sources;

  const _ScreenPickerDialog({required this.sources});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select a screen to share'),
      content: SizedBox(
        width: 440,
        height: 320,
        child: ListView.builder(
          itemCount: sources.length,
          itemBuilder: (_, i) {
            final source = sources[i];
            return Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListTile(
                leading: source.thumbnail != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Image.memory(
                          source.thumbnail!,
                          width: 80,
                          height: 60,
                          fit: BoxFit.cover,
                        ),
                      )
                    : Container(
                        width: 80,
                        height: 60,
                        color: Colors.grey.shade800,
                        child: const Icon(Icons.desktop_windows, size: 32),
                      ),
                title: Text(source.name),
                subtitle: Text(
                  source.type == SourceType.Screen ? 'Entire screen' : 'Window',
                ),
                onTap: () => Navigator.of(context).pop(source),
              ),
            );
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
      ],
    );
  }
}
