import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../providers/auth_provider.dart';

class DashboardHome extends StatefulWidget {
  const DashboardHome({super.key});
  @override
  State<DashboardHome> createState() => _DashboardHomeState();
}

class _DashboardHomeState extends State<DashboardHome> {
  final _api = ApiClient();
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/dashboard/stats');
      setState(() {
        _stats = data['stats'] ?? {};
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Welcome, ${user?.name ?? ''}', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 24),
        if (user?.role == 'employee') _employeeStats(context)
        else if (user?.role == 'team_lead') _teamLeadStats(context)
        else if (user?.role == 'hr') _hrStats(context)
        else _adminStats(context),
      ],
    );
  }

  Widget _statCard(BuildContext context, String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerTheme.color!),
      ),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: Theme.of(context).textTheme.headlineMedium),
                Text(label, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ],
        ),
    );
  }

  Widget _employeeStats(BuildContext context) {
    final att = _stats['myAttendance'];
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: [
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Today', att != null ? '${att['totalWorkMinutes']}m' : '--', Icons.access_time, Colors.blue),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaves'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Active Meetings', '${_stats['upcomingMeetings'] ?? 0}', Icons.videocam, Colors.green),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Tasks', '${_stats['tasksCount'] ?? 0}', Icons.checklist, Colors.purple),
        ),
      ],
    );
  }

  Widget _teamLeadStats(BuildContext context) {
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: [
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Team Today', '${_stats['teamAttendance'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Active Meetings', '${_stats['activeMeetings'] ?? 0}', Icons.videocam, Colors.green),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Team Size', '${_stats['departmentMembers'] ?? 0}', Icons.group, Colors.purple),
        ),
      ],
    );
  }

  Widget _hrStats(BuildContext context) {
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: [
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Total Employees', '${_stats['totalEmployees'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Active', '${_stats['activeEmployees'] ?? 0}', Icons.person, Colors.green),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Departments', '${_stats['departmentsCount'] ?? 0}', Icons.business, Colors.purple),
        ),
      ],
    );
  }

  Widget _adminStats(BuildContext context) {
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: [
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Total Employees', '${_stats['totalEmployees'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Departments', '${_stats['totalDepartments'] ?? 0}', Icons.business, Colors.green),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Active Meetings', '${_stats['activeMeetings'] ?? 0}', Icons.videocam, Colors.orange),
        ),
        SizedBox(
          width: MediaQuery.of(context).size.width * 0.22,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.purple),
        ),
      ],
    );
  }
}
