import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../components/sidebar.dart';
import '../components/top_bar.dart';
import '../components/permanent_meeting_button.dart';
import 'dashboard_home.dart';
import 'employees_screen.dart';
import 'meetings_screen.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';
import 'salary_screen.dart';
import 'settings_screen.dart';
import 'company_meeting_settings.dart';
import 'prejoin_screen.dart';

class DashboardLayout extends StatefulWidget {
  const DashboardLayout({super.key});
  @override
  State<DashboardLayout> createState() => _DashboardLayoutState();
}

class _DashboardLayoutState extends State<DashboardLayout> {
  int _currentIndex = 0;
  bool _lastAdminState = false;

  final _titles = ['Dashboard', 'Employees', 'Meetings', 'Attendance', 'Leave', 'Salary', 'Settings', 'Company Meeting'];
  final _icons = [Icons.dashboard, Icons.people, Icons.videocam, Icons.access_time, Icons.event, Icons.attach_money, Icons.settings, Icons.meeting_room];

  final _screens = const [
    DashboardHome(),
    EmployeesScreen(),
    MeetingsScreen(),
    AttendanceScreen(),
    LeaveScreen(),
    SalaryScreen(),
    SettingsScreen(),
    CompanyMeetingSettings(),
  ];

  void _navigate(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser!;
    final isAdmin = user.isAdmin;

    if (isAdmin != _lastAdminState) {
      _lastAdminState = isAdmin;
      if (!isAdmin && _currentIndex >= _titles.length - 1) {
        _currentIndex = 0;
      }
    }

    final filteredTitles = [..._titles];
    final filteredIcons = [..._icons];
    if (!isAdmin) {
      filteredTitles.removeLast();
      filteredIcons.removeLast();
    }

    final adjustedIndex = isAdmin ? _currentIndex : (_currentIndex >= _titles.length - 1 ? 0 : _currentIndex);

    return Focus(
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent) {
          final int? tabIndex;
          if (event.logicalKey == LogicalKeyboardKey.digit1) tabIndex = 0;
          else if (event.logicalKey == LogicalKeyboardKey.digit2) tabIndex = 1;
          else if (event.logicalKey == LogicalKeyboardKey.digit3) tabIndex = 2;
          else if (event.logicalKey == LogicalKeyboardKey.digit4) tabIndex = 3;
          else if (event.logicalKey == LogicalKeyboardKey.digit5) tabIndex = 4;
          else if (event.logicalKey == LogicalKeyboardKey.digit6) tabIndex = 5;
          else if (event.logicalKey == LogicalKeyboardKey.digit7) tabIndex = 6;
          else if (event.logicalKey == LogicalKeyboardKey.digit8) tabIndex = 7;
          else tabIndex = null;

          if (tabIndex != null && HardwareKeyboard.instance.isControlPressed && tabIndex < filteredTitles.length) {
            _navigate(tabIndex);
            return KeyEventResult.handled;
          }
        }
        return KeyEventResult.ignored;
      },
      child: Scaffold(
      body: Stack(
        children: [
          Row(
            children: [
              Sidebar(
                currentIndex: isAdmin ? _currentIndex : adjustedIndex,
                titles: filteredTitles,
                icons: filteredIcons,
                user: user,
                onItemSelected: (i) {
                  _navigate(i);
                },
                onLogout: () => auth.logout(),
              ),
              Expanded(
                child: Column(
                  children: [
                    TopBar(
                      title: filteredTitles[isAdmin ? _currentIndex : adjustedIndex],
                      actions: [
                        TextButton.icon(
                          onPressed: () {
                            final id = 'quick-${DateTime.now().millisecondsSinceEpoch}';
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                fullscreenDialog: true,
                                builder: (_) => PrejoinScreen(meetingId: id, roomId: id),
                              ),
                            );
                          },
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Quick Meeting'),
                        ),
                      ],
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: IndexedStack(
                          index: isAdmin ? _currentIndex : adjustedIndex,
                          children: _screens,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const PermanentMeetingButton(),
        ],
      ),
    );
  }
}
