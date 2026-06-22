import 'dart:io';
import 'package:flutter/foundation.dart';

enum RecordingState { idle, requesting, approved, recording, denied }

class RecordingService {
  static final RecordingService _instance = RecordingService._();
  factory RecordingService() => _instance;
  RecordingService._();

  Process? _ffmpegProcess;
  String? _outputPath;

  final ValueNotifier<RecordingState> state = ValueNotifier(RecordingState.idle);
  final ValueNotifier<String> status = ValueNotifier('');

  Future<String> get _defaultOutputPath async {
    final dir = Platform.environment['HOME'] ??
                 Platform.environment['USERPROFILE'] ??
                 Directory.current.path;
    final documents = '$dir/Documents';
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return '$documents/recording_$timestamp.mp4';
  }

  Future<bool> startRecording({String? outputPath, String? audioDevice, String? videoDevice, String? resolution}) async {
    try {
      _outputPath = outputPath ?? await _defaultOutputPath;
      final outDir = Directory(_outputPath!);
      if (!outDir.parent.existsSync()) {
        outDir.parent.createSync(recursive: true);
      }
      state.value = RecordingState.recording;
      status.value = 'Starting recording...';

      final ffmpegCheck = await Process.run('which', ['ffmpeg']);
      if (ffmpegCheck.exitCode != 0) {
        state.value = RecordingState.idle;
        status.value = 'ffmpeg not found. Please install ffmpeg.';
        return false;
      }

      final args = _buildFfmpegArgs(resolution: resolution, audioDevice: audioDevice, videoDevice: videoDevice);
      _ffmpegProcess = await Process.start('ffmpeg', args);
      status.value = 'Recording to ${_outputPath ?? 'unknown location'}';
      return true;
    } catch (e) {
      state.value = RecordingState.idle;
      status.value = 'Failed: $e';
      return false;
    }
  }

  List<String> _buildFfmpegArgs({String? resolution, String? audioDevice, String? videoDevice}) {
    final res = resolution ?? '1920x1080';
    if (Platform.isLinux) {
      return [
        '-f', 'x11grab',
        '-s', res,
        '-i', videoDevice ?? ':0.0',
        '-f', 'pulse',
        '-i', audioDevice ?? 'default',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-y',
        _outputPath!,
      ];
    } else if (Platform.isWindows) {
      final args = [
        '-f', 'gdigrab',
        '-s', res,
        '-i', 'desktop',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
      ];
      if (audioDevice != null) {
        args.addAll(['-f', 'dshow', '-i', 'audio=$audioDevice']);
      } else {
        args.addAll(['-f', 'dshow', '-i', 'audio=virtual-audio-capturer']);
      }
      args.addAll(['-c:a', 'aac', '-y', _outputPath!]);
      return args;
    }
    return [];
  }

  Future<void> stopRecording({Duration? delayBeforeKill}) async {
    if (_ffmpegProcess != null) {
      _ffmpegProcess!.stdin.writeln('q');
      await Future.delayed(delayBeforeKill ?? const Duration(milliseconds: 300));
      _ffmpegProcess!.kill();
      _ffmpegProcess = null;
    }
    state.value = RecordingState.idle;
    status.value = _ffmpegProcess == null ? 'Recording saved to ${_outputPath ?? 'unknown location'}' : 'Recording stopped';
  }

  Future<void> dispose() async {
    await stopRecording();
  }
}
