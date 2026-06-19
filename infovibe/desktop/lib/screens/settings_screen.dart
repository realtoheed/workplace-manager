import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../main.dart' show kAppVersion;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _joinMicOn = false;
  bool _joinCameraOn = false;

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
                Text('App Version', style: Theme.of(context).textTheme.titleMedium),
                Text('v$kAppVersion', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                context.read<AuthProvider>().logout();
                Navigator.pushReplacementNamed(context, '/login');
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
