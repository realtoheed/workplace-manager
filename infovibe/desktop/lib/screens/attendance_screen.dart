import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../models/attendance_record.dart';
import '../providers/auth_provider.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _api = ApiClient();
  List<AttendanceRecord> _records = [];
  bool _loading = true;
  int _page = 0;
  final _fromCtrl = TextEditingController();
  final _toCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = context.read<AuthProvider>().currentUser;
      final query = <String, String>{};
      if (_fromCtrl.text.isNotEmpty) query['from'] = _fromCtrl.text;
      if (_toCtrl.text.isNotEmpty) query['to'] = _toCtrl.text;

      Map<String, dynamic> data;
      if (user?.isAdmin == true || user?.isTeamLead == true) {
        data = await _api.get('/attendance/report', query: {...query, 'userId': user!.id});
      } else {
        data = await _api.get('/attendance/my', query: query);
      }
      setState(() {
        _records = (data['records'] as List?)?.map((e) => AttendanceRecord.fromJson(e)).toList() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _fromCtrl.dispose();
    _toCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final pageData = _records.skip(_page * 10).take(10).toList();
    final totalPages = (_records.length / 10).ceil();
    final totalMinutes = _records.fold<int>(0, (s, r) => s + r.totalWorkMinutes);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Attendance', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Row(
          children: [
            SizedBox(width: 160, child: TextField(controller: _fromCtrl, decoration: const InputDecoration(labelText: 'From', hintText: 'YYYY-MM-DD'))),
            const SizedBox(width: 12),
            SizedBox(width: 160, child: TextField(controller: _toCtrl, decoration: const InputDecoration(labelText: 'To', hintText: 'YYYY-MM-DD'))),
            const SizedBox(width: 12),
            ElevatedButton(onPressed: () { setState(() => _page = 0); _load(); }, child: const Text('Filter')),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _summaryCard('Total Hours', '${(totalMinutes / 60).toStringAsFixed(1)}h', Icons.timer, Colors.blue),
            const SizedBox(width: 12),
            _summaryCard('Days Present', '${_records.where((r) => r.status == 'present' || r.status == 'active').length}', Icons.check_circle, Colors.green),
            const SizedBox(width: 12),
            _summaryCard('Late', '${_records.where((r) => r.status == 'late').length}', Icons.warning, Colors.orange),
            const SizedBox(width: 12),
            _summaryCard('Absent', '${_records.where((r) => r.status == 'absent').length}', Icons.cancel, Colors.red),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: pageData.isEmpty
            ? Center(child: Text('No records', style: Theme.of(context).textTheme.bodyLarge))
            : SingleChildScrollView(
                child: DataTable(
                  columnSpacing: 16,
                  columns: [
                    if (_records.any((r) => r.userName != null)) const DataColumn(label: Text('Employee')),
                    const DataColumn(label: Text('Date')),
                    const DataColumn(label: Text('Join')),
                    const DataColumn(label: Text('Leave')),
                    const DataColumn(label: Text('Work')),
                    const DataColumn(label: Text('Break')),
                    const DataColumn(label: Text('Screen')),
                    const DataColumn(label: Text('Status')),
                  ],
                  rows: pageData.map((r) => DataRow(cells: [
                    if (r.userName != null) DataCell(Text(r.userName!, style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text(r.date.substring(0, 10), style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text(r.firstJoinAt?.substring(11, 19) ?? '-', style: Theme.of(context).textTheme.bodySmall)),
                    DataCell(Text(r.lastLeaveAt?.substring(11, 19) ?? '-', style: Theme.of(context).textTheme.bodySmall)),
                    DataCell(Text('${r.totalWorkMinutes}m', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('${r.breakMinutes}m', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('${r.screenshareMinutes}m', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(_statusBadge(r.status)),
                  ])).toList(),
                ),
              ),
        ),
        if (totalPages > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(icon: const Icon(Icons.chevron_left), onPressed: _page > 0 ? () => setState(() => _page--) : null),
                Text('${_page + 1} / $totalPages'),
                IconButton(icon: const Icon(Icons.chevron_right), onPressed: _page < totalPages - 1 ? () => setState(() => _page++) : null),
              ],
            ),
          ),
      ],
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Theme.of(context).dividerTheme.color!),
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: Theme.of(context).textTheme.titleLarge),
                Text(label, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String status) {
    Color c;
    switch (status) {
      case 'present': c = Colors.green; break;
      case 'late': c = Colors.orange; break;
      case 'absent': c = Colors.red; break;
      case 'half_day': c = Colors.blue; break;
      case 'active': c = Colors.teal; break;
      default: c = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(status, style: TextStyle(fontSize: 12, color: c, fontWeight: FontWeight.w500)),
    );
  }
}
