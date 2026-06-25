import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class UpdateInfo {
  final String version;
  final int build;
  final String? releaseDate;
  final Map<String, dynamic> downloads;
  final String? changelog;
  final String? checksum;

  UpdateInfo({
    required this.version,
    required this.build,
    this.releaseDate,
    required this.downloads,
    this.changelog,
    this.checksum,
  });

  factory UpdateInfo.fromJson(Map<String, dynamic> json) => UpdateInfo(
    version: json['version'] ?? '0.0.0',
    build: json['build'] ?? 0,
    releaseDate: json['releaseDate'] as String?,
    downloads: json['downloads'] as Map<String, dynamic>? ?? {},
    changelog: json['changelog'] as String?,
    checksum: json['checksum'] as String?,
  );
}

class UpdateProgress {
  final double fraction;
  final String status;

  UpdateProgress(this.fraction, this.status);
}

class UpdateService {
  static final UpdateService _instance = UpdateService._();
  factory UpdateService() => _instance;
  UpdateService._();

  static const String _versionUrl = 'https://infovibex.com/version.json';
  static const Duration _checkInterval = Duration(hours: 1);

  Timer? _timer;
  String? _currentVersion;
  UpdateInfo? _latestInfo;
  bool _disposed = false;

  final ValueNotifier<bool> showOverlay = ValueNotifier(false);
  final ValueNotifier<UpdateProgress> progress = ValueNotifier(UpdateProgress(0, ''));

  final http.Client _httpClient = http.Client();
  static const String _skipVersionKey = 'skipped_update_version';

  String get currentVersion => _currentVersion ?? '0.0.0';

  void initialize(String appVersion) {
    _currentVersion = appVersion;
    Future.delayed(const Duration(seconds: 5), () {
      if (!_disposed) _checkForUpdate();
    });
    _timer = Timer.periodic(_checkInterval, (_) => _checkForUpdate());
  }

  Future<void> _checkForUpdate() async {
    if (_disposed) return;
    try {
      final response = await _httpClient.get(Uri.parse(_versionUrl)).timeout(const Duration(seconds: 10));
      if (response.statusCode != 200 || _disposed) return;

      final data = jsonDecode(response.body);
      _latestInfo = UpdateInfo.fromJson(data);

      if (_isNewerAvailable) {
        final prefs = await SharedPreferences.getInstance();
        final skipped = prefs.getString(_skipVersionKey);
        if (skipped == _latestInfo!.version) return;
        _showUpdateDialog();
      }
    } catch (e) {
      debugPrint('[Update] Check failed: $e');
    }
  }

  bool get _isNewerAvailable {
    if (_latestInfo == null || _currentVersion == null) return false;
    final cleanVersion = _currentVersion!.split('+').first;
    final currentParts = cleanVersion.split('.').map(int.tryParse).toList();
    final latestParts = _latestInfo!.version.split('.').map(int.tryParse).toList();
    for (int i = 0; i < 3; i++) {
      final c = i < currentParts.length ? currentParts[i] ?? 0 : 0;
      final l = i < latestParts.length ? latestParts[i] ?? 0 : 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  void _showUpdateDialog() {
    if (_disposed || _scaffoldMessenger == null) return;
    _scaffoldMessenger!.showMaterialBanner(
      MaterialBanner(
        backgroundColor: Colors.blueGrey.shade900,
        padding: const EdgeInsets.all(16),
        leading: const Icon(Icons.system_update, color: Colors.cyanAccent, size: 32),
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Update v${_latestInfo!.version} available',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
            ),
            if (_latestInfo!.changelog != null) ...[
              const SizedBox(height: 4),
              Text(
                _latestInfo!.changelog!.length > 150
                    ? '${_latestInfo!.changelog!.substring(0, 150)}...'
                    : _latestInfo!.changelog!,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              _scaffoldMessenger?.hideCurrentMaterialBanner();
            },
            child: const Text('Later', style: TextStyle(color: Colors.white70)),
          ),
          TextButton(
            onPressed: () {
              _scaffoldMessenger?.hideCurrentMaterialBanner();
              _skipVersion();
            },
            child: const Text('Skip this version', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.cyan),
            onPressed: () {
              _scaffoldMessenger?.hideCurrentMaterialBanner();
              _startUpdate();
            },
            child: const Text('Update Now'),
          ),
        ],
      ),
    );
  }

  Future<void> _skipVersion() async {
    if (_latestInfo == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_skipVersionKey, _latestInfo!.version);
  }

  void _startUpdate() async {
    if (_latestInfo == null) return;
    showOverlay.value = true;
    progress.value = UpdateProgress(0, 'Starting update...');

    try {
      await _downloadAndInstall();
    } catch (e) {
      progress.value = UpdateProgress(0, 'Update failed: $e');
      await Future.delayed(const Duration(seconds: 3));
      showOverlay.value = false;
    }
  }

  Future<void> _downloadAndInstall() async {
    final info = _latestInfo!;

    if (Platform.isWindows) {
      await _windowsUpdate(info);
    } else {
      await _linuxUpdate(info);
    }
  }

  Future<void> _windowsUpdate(UpdateInfo info) async {
    final win = info.downloads['windows'] as Map<String, dynamic>?;
    final url = win?['zip'] as String?;
    if (url == null) throw Exception('No Windows download URL found');

    final tempDir = Directory.systemTemp.path;
    final zipPath = '$tempDir\\workplace-manager-update.zip';
    final extractDir = '$tempDir\\workplace-manager-update';

    progress.value = UpdateProgress(0, 'Downloading update...');

    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse(url));
      final response = await client.send(request);
      final total = response.contentLength ?? 0;
      if (total == 0) throw Exception('Empty response');

      final sink = File(zipPath).openWrite();
      int received = 0;

      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) {
          progress.value = UpdateProgress(
            received / total,
            'Downloading... ${(received / 1024 / 1024).toStringAsFixed(1)}MB / ${(total / 1024 / 1024).toStringAsFixed(1)}MB',
          );
        }
      }
      await sink.close();
    } finally {
      client.close();
    }

    progress.value = UpdateProgress(0.9, 'Extracting update...');

    await Process.run('powershell', [
      '-Command',
      'Expand-Archive',
      '-Path',
      '"$zipPath"',
      '-DestinationPath',
      '"$extractDir"',
      '-Force',
    ]);

    progress.value = UpdateProgress(0.95, 'Installing update...');

    final execPath = Platform.resolvedExecutable;
    final appDir = File(execPath).parent.path;
    final newExePath = '$extractDir\\workplace_manager.exe';
    if (!File(newExePath).existsSync()) {
      throw Exception('Update archive does not contain workplace_manager.exe');
    }

    // Create updater batch script that: waits for this process to exit,
    // copies new files over current app directory, then restarts.
    final pid = Process.currentPid;
    final batContent = '''
@echo off
setlocal
set "OLD_PID=$pid"
set "APP_DIR=$appDir"
set "SRC_DIR=$extractDir"
set "LOG=$tempDir\\workplace-update-log.txt"

echo [updater] Waiting for process %OLD_PID% to exit... >> "%LOG%"
:waitloop
tasklist /FI "PID eq %OLD_PID%" 2>nul | find /I "%OLD_PID%" >nul
if not errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto :waitloop
)

echo [updater] Copying files from %SRC_DIR% to %APP_DIR%... >> "%LOG%"
xcopy /E /Y /Q "%SRC_DIR%\\*" "%APP_DIR%\\" >> "%LOG%" 2>&1

echo [updater] Launching %APP_DIR%\\workplace_manager.exe >> "%LOG%"
start "" "%APP_DIR%\\workplace_manager.exe"
echo [updater] Done >> "%LOG%"
exit /b 0
''';

    final batPath = '$tempDir\\workplace-updater.bat';
    await File(batPath).writeAsString(batContent);

    progress.value = UpdateProgress(1.0, 'Update ready. Restarting...');

    // Launch updater asynchronously, then exit immediately so the
    // batch script can wait for this process to terminate.
    await Process.start(batPath, []);
    await Future.delayed(const Duration(milliseconds: 200));
    exit(0);
  }

  Future<void> _linuxUpdate(UpdateInfo info) async {
    final linux = info.downloads['linux'] as Map<String, dynamic>?;

    final execPath = Platform.resolvedExecutable;
    final isSystemInstall = execPath.startsWith('/opt/') ||
                            execPath.startsWith('/usr/local/') ||
                            execPath.startsWith('/usr/');

    String? url;
    if (isSystemInstall) {
      url = linux?['deb'] as String?;
    } else {
      url = linux?['tar'] as String?;
    }
    if (url == null) throw Exception('No download URL found');

    final tempDir = Directory.systemTemp.path;
    final ext = url.endsWith('.tar.gz') ? '.tar.gz' : '.deb';
    final archivePath = '$tempDir/workplace-manager-update$ext';
    final logPath = '$tempDir/workplace-update-log.txt';

    progress.value = UpdateProgress(0, 'Downloading update...');

    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse(url));
      final response = await client.send(request);
      final total = response.contentLength ?? 0;
      if (total == 0) throw Exception('Empty response');

      final sink = File(archivePath).openWrite();
      int received = 0;

      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) {
          progress.value = UpdateProgress(
            received / total,
            'Downloading... ${(received / 1024 / 1024).toStringAsFixed(1)}MB / ${(total / 1024 / 1024).toStringAsFixed(1)}MB',
          );
        }
      }
      await sink.close();
    } finally {
      client.close();
    }

    progress.value = UpdateProgress(0.95, 'Installing update...');

    final homeDir = Platform.environment['HOME'] ?? '/tmp';
    final installDir = '$homeDir/.local/share/workplace-manager';
    final versionDir = '$installDir/v${info.version}';
    final binaryFromVersion = '$versionDir/workplace_manager';

    if (!isSystemInstall) {
      await Process.run('mkdir', ['-p', versionDir]);
      await Process.run('tar', ['xzf', archivePath, '-C', versionDir, '--strip-components=1']);
    }

    final portableBinDir = '$homeDir/.local/bin';
    final portableBinary = '$portableBinDir/workplace-manager';
    final targetBinary = isSystemInstall ? execPath : portableBinary;

    const tpl = r'''#!/bin/bash
LOG="__LOG__"
echo "[updater] $(date) Starting update" >> "$LOG"
sleep 1
SRC="__SRC__"
BINARY="__BINARY__"
ARCHIVE="__ARCHIVE__"
INSTALL_DIR="__INSTALL_DIR__"

copy_and_restart() {
  mkdir -p "$(dirname "$BINARY")" >> "$LOG" 2>&1
  cp "$SRC" "$BINARY" >> "$LOG" 2>&1
  chmod +x "$BINARY" >> "$LOG" 2>&1
  echo "[updater] Copied binary to $BINARY" >> "$LOG"
}

__DEB_INSTALL__
if [ "$INSTALL_DEB" = "1" ]; then
  echo "[updater] Deb install via pkexec" >> "$LOG"
  if command -v pkexec &>/dev/null; then
    pkexec dpkg -i "$ARCHIVE" >> "$LOG" 2>&1
    RC=$?
    echo "[updater] pkexec exit: $RC" >> "$LOG"
    if [ $RC -ne 0 ]; then
      echo "[updater] dpkg failed, aborting" >> "$LOG"
      exit 1
    fi
  else
    echo "[updater] pkexec not available, aborting deb install" >> "$LOG"
    exit 1
  fi
else
  copy_and_restart
fi

rm -f "$ARCHIVE"
sleep 1
if [ "$INSTALL_DEB" != "1" ]; then
  CURRENT_DIR="$SRC"
  for d in "$INSTALL_DIR"/v*; do
    if [ "$d" != "$(dirname "$CURRENT_DIR")" ] && [ -d "$d" ]; then
      rm -rf "$d"
    fi
  done
fi
echo "[updater] Launching $BINARY" >> "$LOG"
setsid "$BINARY" > /dev/null 2>&1 &
echo "[updater] Done" >> "$LOG"
''';

    final debInstallBlock = isSystemInstall ? 'INSTALL_DEB=1' : 'INSTALL_DEB=0';

    final updaterScript = tpl
        .replaceAll('__LOG__', logPath)
        .replaceAll('__ARCHIVE__', archivePath)
        .replaceAll('__BINARY__', targetBinary)
        .replaceAll('__SRC__', binaryFromVersion)
        .replaceAll('__INSTALL_DIR__', installDir)
        .replaceAll('__DEB_INSTALL__', debInstallBlock);

    progress.value = UpdateProgress(1.0, 'Update ready. Restarting...');

    final scriptPath = '$tempDir/workplace-updater.sh';
    await File(scriptPath).writeAsString(updaterScript);
    await Process.run('chmod', ['+x', scriptPath]);

    final result = await Process.run('/bin/bash', [scriptPath]);
    if (result.exitCode != 0 && result.exitCode != 1) {
      debugPrint('[Update] Updater script exited with code ${result.exitCode}');
    }
    await Future.delayed(const Duration(milliseconds: 200));
    exit(0);
  }

  ScaffoldMessengerState? _scaffoldMessenger;
  void attach(BuildContext context) {
    _scaffoldMessenger = ScaffoldMessenger.maybeOf(context);
  }

  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    _httpClient.close();
  }
}
