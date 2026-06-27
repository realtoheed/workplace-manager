import 'dart:ui' show PlatformDispatcher;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';
import 'theme/app_theme.dart';
import 'api/client.dart';
import 'api/socket.dart';
import 'api/livekit_service.dart';
import 'services/update_service.dart';
import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/socket_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_layout.dart';

const String kApiBaseUrl = 'https://app.infovibex.com/api';
const String kSocketUrl = 'https://app.infovibex.com';
const String kAppVersion = '1.0.25';

class _CloseListener with WindowListener {
  @override
  void onWindowClose() {
    LiveKitService().dispose();
    windowManager.destroy();
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[Fatal] ${details.exception}\n${details.stack}');
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[Platform] Error: $error\n$stack');
    return true;
  };
  await windowManager.ensureInitialized();
  await windowManager.setMinimumSize(const Size(1024, 720));
  await windowManager.setSize(const Size(1200, 900));
  await windowManager.setTitle('Workplace Manager');
  windowManager.addListener(_CloseListener());
  ApiClient().setBaseUrl(kApiBaseUrl);
  SocketService().setServerUrl(kSocketUrl);
  await LiveKitService().initialize();
  UpdateService().initialize(kAppVersion);
  runApp(const WorkplaceManagerApp());
}

class WorkplaceManagerApp extends StatelessWidget {
  const WorkplaceManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => SocketProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) {
          return MaterialApp(
            title: 'Workplace Manager',
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: themeProvider.mode,
            debugShowCheckedModeBanner: false,
            home: AppShell(),
          );
        },
      ),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  final _updateService = UpdateService();
  bool _socketConnected = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _updateService.attach(context);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _updateService.dispose();
    ApiClient().dispose();
    LiveKitService().dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      debugPrint('[AppShell] App paused');
    } else if (state == AppLifecycleState.resumed) {
      debugPrint('[AppShell] App resumed');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.isLoading) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            if (!auth.isLoggedIn) {
              return const LoginScreen();
            }
            if (!_socketConnected && auth.currentUser != null) {
              _socketConnected = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (auth.currentUser != null) {
                  context.read<SocketProvider>().connect(auth.currentUser!.id, auth.currentUser!.name);
                }
              });
            }
            return const DashboardLayout();
          },
        ),
        ValueListenableBuilder<bool>(
          valueListenable: _updateService.showOverlay,
          builder: (_, show, __) => show ? _UpdateOverlay(service: _updateService) : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

class _UpdateOverlay extends StatelessWidget {
  final UpdateService service;
  const _UpdateOverlay({required this.service});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Card(
          margin: const EdgeInsets.all(32),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: ValueListenableBuilder(
              valueListenable: service.progress,
              builder: (_, progress, __) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.system_update, size: 48, color: Colors.cyan),
                  const SizedBox(height: 16),
                  Text(progress.status, style: const TextStyle(fontSize: 16)),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(value: progress.fraction),
                  const SizedBox(height: 8),
                  Text('${(progress.fraction * 100).toStringAsFixed(0)}%'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
