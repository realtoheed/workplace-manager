import 'dart:async';
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
  String? _error;

  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 60), (_) => _load());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    _error = null;
    try {
      final data = await _api.get('/dashboard/stats');
      setState(() {
        _stats = data['stats'] ?? {};
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Dashboard] Failed to load stats: $e');
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  String _formatMinutes(int minutes) {
    if (minutes < 60) return '${minutes}m';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return '${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text('Failed to load dashboard', style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 8),
            Text('Tap Retry to try again', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: () { setState(() { _loading = true; _error = null; }); _load(); }, child: const Text('Retry')),
          ],
        ),
      );
    }
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

  Widget _statCard(BuildContext context, String label, String value, IconData icon, Color color, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Theme.of(context).dividerTheme.color ?? Colors.grey.shade200),
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
      ),
    );
  }

  Widget _employeeStats(BuildContext context) {
    final att = _stats['myAttendance'];
    final minutes = int.tryParse('${att?['totalWorkMinutes'] ?? 0}') ?? 0;
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: [
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Today', _formatMinutes(minutes), Icons.access_time, Colors.blue),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaves'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Active Meetings', '${_stats['upcomingMeetings'] ?? 0}', Icons.videocam, Colors.green),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
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
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Team Today', '${_stats['teamAttendance'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Active Meetings', '${_stats['activeMeetings'] ?? 0}', Icons.videocam, Colors.green),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
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
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Total Employees', '${_stats['totalEmployees'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Active', '${_stats['activeEmployees'] ?? 0}', Icons.person, Colors.green),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.orange),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
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
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Total Employees', '${_stats['totalEmployees'] ?? 0}', Icons.people, Colors.blue),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Departments', '${_stats['totalDepartments'] ?? 0}', Icons.business, Colors.green),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Active Meetings', '${_stats['activeMeetings'] ?? 0}', Icons.videocam, Colors.orange),
        ),
        SizedBox(
          width: (MediaQuery.of(context).size.width - 80) * 0.25,
          child: _statCard(context, 'Pending Leaves', '${_stats['pendingLeaveRequests'] ?? 0}', Icons.event, Colors.purple),
        ),
      ],
    );
  }
}
