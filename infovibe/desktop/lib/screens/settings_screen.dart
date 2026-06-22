import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../main.dart' show kAppVersion;
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _joinMicOn = false;
  bool _joinCameraOn = false;
  bool _notificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadJoinDefaults();
  }

  Future<void> _loadJoinDefaults() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() {
      _joinMicOn = prefs.getBool('joinMicOn') ?? false;
      _joinCameraOn = prefs.getBool('joinCameraOn') ?? false;
      _notificationsEnabled = prefs.getBool('notificationsEnabled') ?? true;
    });
  }

  Future<void> _setJoinMicOn(bool v) async {
    (await SharedPreferences.getInstance()).setBool('joinMicOn', v);
    if (mounted) setState(() => _joinMicOn = v);
  }

  Future<void> _setJoinCameraOn(bool v) async {
    (await SharedPreferences.getInstance()).setBool('joinCameraOn', v);
    if (mounted) setState(() => _joinCameraOn = v);
  }

  Future<void> _setNotifications(bool v) async {
    (await SharedPreferences.getInstance()).setBool('notificationsEnabled', v);
    if (mounted) setState(() => _notificationsEnabled = v);
  }

  Future<void> _clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k != 'auth_cookies');
    for (final k in keys) {
      await prefs.remove(k);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cache cleared'), duration: Duration(seconds: 1)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final theme = context.watch<ThemeProvider>();
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Settings', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 20),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Profile', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                _infoRow(context, 'Name', user?.name ?? '-'),
                _infoRow(context, 'Email', user?.email ?? '-'),
                _infoRow(context, 'Role', user?.role.replaceAll('_', ' ') ?? '-'),
                _infoRow(context, 'Department', user?.department ?? '-'),
                _infoRow(context, 'Designation', user?.designation ?? '-'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Theme', style: Theme.of(context).textTheme.titleMedium),
                SegmentedButton<ThemeMode>(
                  segments: const [
                    ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode, size: 16)),
                    ButtonSegment(value: ThemeMode.system, label: Text('System'), icon: Icon(Icons.settings, size: 16)),
                    ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode, size: 16)),
                  ],
                  selected: {theme.mode},
                  onSelectionChanged: (v) => theme.setThemeMode(v.first),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Notifications', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: _notificationsEnabled,
                  onChanged: _setNotifications,
                  title: const Text('Enable notifications'),
                  subtitle: const Text('Receive meeting and chat notifications'),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Join Preferences', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: _joinMicOn,
                  onChanged: _setJoinMicOn,
                  title: const Text('Join with microphone on'),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
                SwitchListTile(
                  value: _joinCameraOn,
                  onChanged: _setJoinCameraOn,
                  title: const Text('Join with camera on'),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Clear Cache', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                TextButton(
                  onPressed: _clearCache,
                  child: const Text('Clear'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('About', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                _infoRow(context, 'App Version', 'v$kAppVersion'),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => showLicensePage(
                    context: context,
                    applicationName: 'Workplace Manager',
                    applicationVersion: kAppVersion,
                  ),
                  icon: const Icon(Icons.description, size: 16),
                  label: const Text('Open Source Licenses'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (user != null)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  context.read<AuthProvider>().logout();
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (_) => false,
                  );
                },
                icon: const Icon(Icons.logout, color: Colors.red),
                label: Text('Logout', style: TextStyle(color: Colors.red[400])),
                style: OutlinedButton.styleFrom(side: BorderSide(color: Colors.red.withOpacity(0.4)), padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _card(Widget child) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerTheme.color!),
      ),
      child: child,
    );
  }

  Widget _infoRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
