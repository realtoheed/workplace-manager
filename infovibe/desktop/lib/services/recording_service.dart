import 'dart:async';
import 'dart:convert';
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
    final dir = Directory.current.path;
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return '$dir/recording_$timestamp.mp4';
  }

  Future<bool> startRecording({String? outputPath, String? audioDevice, String? videoDevice}) async {
    try {
      _outputPath = outputPath ?? await _defaultOutputPath;
      state.value = RecordingState.recording;
      status.value = 'Starting recording...';

      final args = _buildFfmpegArgs(audioDevice: audioDevice, videoDevice: videoDevice);
      _ffmpegProcess = await Process.start('ffmpeg', args);
      status.value = 'Recording to $_outputPath';
      return true;
    } catch (e) {
      state.value = RecordingState.idle;
      status.value = 'Failed: $e';
      return false;
    }
  }

  List<String> _buildFfmpegArgs({String? audioDevice, String? videoDevice}) {
    if (Platform.isLinux) {
      return [
        '-f', 'x11grab',
        '-s', '1920x1080',
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
      return [
        '-f', 'gdigrab',
        '-s', '1920x1080',
        '-i', 'desktop',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-y',
        _outputPath!,
      ];
    }
    return [];
  }

  Future<void> stopRecording() async {
    if (_ffmpegProcess != null) {
      _ffmpegProcess!.stdin.writeln('q');
      await _ffmpegProcess!.kill();
      _ffmpegProcess = null;
    }
    state.value = RecordingState.idle;
    status.value = recordingStopped ? 'Recording saved to $_outputPath' : 'Recording stopped';
  }

  bool get recordingStopped => _ffmpegProcess == null;

  Future<void> dispose() async {
    await stopRecording();
  }
}
