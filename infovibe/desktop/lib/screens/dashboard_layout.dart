import 'package:flutter/material.dart';
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

  final _titles = ['Dashboard', 'Employees', 'Meetings', 'Attendance', 'Leave', 'Salary', 'Settings', 'Company Meeting'];
  final _icons = [Icons.dashboard, Icons.people, Icons.videocam, Icons.access_time, Icons.event, Icons.attach_money, Icons.settings, Icons.meeting_room];

  void _navigate(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser!;
    final isAdmin = user.isAdmin;

    final screens = [
      const DashboardHome(),
      const EmployeesScreen(),
      const MeetingsScreen(),
      const AttendanceScreen(),
      const LeaveScreen(),
      const SalaryScreen(),
      const SettingsScreen(),
      if (isAdmin) const CompanyMeetingSettings(),
    ];

    final filteredTitles = [..._titles];
    final filteredIcons = [..._icons];
    if (!isAdmin) {
      filteredTitles.removeLast();
      filteredIcons.removeLast();
    }

    return Scaffold(
      body: Stack(
        children: [
          Row(
            children: [
              Sidebar(
                currentIndex: _currentIndex,
                titles: filteredTitles,
                icons: filteredIcons,
                user: user,
                onItemSelected: _navigate,
                onLogout: () => auth.logout(),
              ),
              Expanded(
                child: Column(
                  children: [
                    TopBar(
                      title: filteredTitles[_currentIndex],
                      actions: _currentIndex == 2 ? [
                        TextButton.icon(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                fullscreenDialog: true,
                                builder: (_) => const PrejoinScreen(
                                  meetingId: 'quick-meeting',
                                  roomId: 'quick-meeting',
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Quick Meeting'),
                        ),
                      ] : [],
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: screens.length > _currentIndex ? screens[_currentIndex] : const SizedBox.shrink(),
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
