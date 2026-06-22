import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../models/leave_request.dart';
import '../providers/auth_provider.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});
  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final _api = ApiClient();
  List<LeaveRequest> _leaves = [];
  bool _loading = true;
  int _tab = 0;
  String _typeFilter = 'all';

  Map<String, int> _balance = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.get('/leave');
      setState(() {
        _leaves = (data['leaves'] as List?)?.map((e) => LeaveRequest.fromJson(e)).toList() ?? [];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Leave] Failed to load: $e');
      setState(() => _loading = false);
    }
    try {
      final balanceData = await _api.get('/leave/balance');
      if (balanceData['balance'] is Map) {
        final b = balanceData['balance'] as Map<String, dynamic>;
        _balance = b.map((k, v) => MapEntry(k, int.tryParse(v.toString()) ?? 0));
      }
    } catch (e) {
      debugPrint('[Leave] Failed to load balance: $e');
    }
  }

  void _submitLeave() async {
    final reasonCtrl = TextEditingController();
    final startCtrl = TextEditingController();
    final endCtrl = TextEditingController();
    String type = 'sick';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Leave'),
        content: SizedBox(
          width: 380,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: type,
                  decoration: const InputDecoration(labelText: 'Type'),
                  items: ['sick', 'casual', 'annual'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                  onChanged: (v) => type = v ?? type,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: startCtrl,
                  decoration: const InputDecoration(labelText: 'Start Date', hintText: 'YYYY-MM-DD', suffixIcon: Icon(Icons.calendar_today, size: 16)),
                  readOnly: true,
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(startCtrl.text) ?? DateTime.now(),
                      firstDate: DateTime.now().subtract(const Duration(days: 7)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null) startCtrl.text = date.toIso8601String().substring(0, 10);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: endCtrl,
                  decoration: const InputDecoration(labelText: 'End Date', hintText: 'YYYY-MM-DD', suffixIcon: Icon(Icons.calendar_today, size: 16)),
                  readOnly: true,
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(endCtrl.text) ?? DateTime.now(),
                      firstDate: DateTime.tryParse(startCtrl.text) ?? DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null) endCtrl.text = date.toIso8601String().substring(0, 10);
                  },
                ),
                const SizedBox(height: 12),
                TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 3),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (startCtrl.text.isEmpty || endCtrl.text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select start and end dates')));
                return;
              }
              if (endCtrl.text.compareTo(startCtrl.text) < 0) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('End date must be after start date')));
                return;
              }
              try {
                await _api.post('/leave', body: {
                  'leaveType': type, 'startDate': startCtrl.text, 'endDate': endCtrl.text, 'reason': reasonCtrl.text,
                });
                Navigator.pop(ctx);
                _load();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  void _tlAction(LeaveRequest l, String action) async {
    if (action == 'reject') {
      await _rejectDialog(
        title: 'Rejection Comment',
        onReject: (comment) => _api.patch('/leave/${l.id}/tl-action', body: {'action': 'reject', 'comment': comment}),
      );
    } else {
      await _api.patch('/leave/${l.id}/tl-action', body: {'action': action});
      _load();
    }
  }

  void _hrAction(LeaveRequest l, String action) async {
    if (action == 'reject') {
      await _rejectDialog(
        title: 'Rejection Comment',
        onReject: (comment) => _api.patch('/leave/${l.id}/hr-action', body: {'action': 'reject', 'comment': comment}),
      );
    } else {
      await _api.patch('/leave/${l.id}/hr-action', body: {'action': action});
      _load();
    }
  }

  Future<void> _rejectDialog({required String title, required Future<Map<String, dynamic>> Function(String comment) onReject}) async {
    final ctrl = TextEditingController();
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Comment'), maxLines: 3),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await onReject(ctrl.text);
              if (ctx.mounted) Navigator.pop(ctx);
              _load();
            },
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final canSubmit = user?.role == 'employee' || user?.role == 'team_lead';
    final isAdmin = user?.isAdmin == true;
    final isTL = user?.isTeamLead == true;
    final showAll = isAdmin || isTL;

    if (_loading) return const Center(child: CircularProgressIndicator());

    final myLeaves = _leaves.where((l) => l.userId == user?.id).toList();
    final pendingLeaves = _leaves.where((l) => l.isPending).toList();
    final displayLeaves = (_tab == 1 ? pendingLeaves : myLeaves)
        .where((l) => _typeFilter == 'all' || l.leaveType == _typeFilter)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Leave', style: Theme.of(context).textTheme.titleLarge)),
            if (canSubmit) ElevatedButton.icon(onPressed: _submitLeave, icon: const Icon(Icons.add, size: 18), label: const Text('Submit Leave')),
          ],
        ),
        if (_balance.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: _balance.entries.map((e) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Text('${e.key}: ${e.value} days', style: TextStyle(fontSize: 12, color: Colors.blue[600], fontWeight: FontWeight.w500)),
            )).toList(),
          ),
        ],
        const SizedBox(height: 12),
        if (showAll)
          Row(
            children: List.generate(2, (i) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(label: Text(i == 0 ? 'My Requests' : 'Pending'), selected: _tab == i, onSelected: (v) => setState(() => _tab = i)),
            )),
          ),
        const SizedBox(height: 12),
        Row(
          children: [
            SizedBox(
              width: 120,
              child: DropdownButtonFormField<String>(
                value: _typeFilter,
                decoration: const InputDecoration(labelText: 'Type', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8)),
                items: ['all', 'sick', 'casual', 'annual'].map((t) => DropdownMenuItem(value: t, child: Text(t == 'all' ? 'All Types' : t))).toList(),
                onChanged: (v) => setState(() => _typeFilter = v ?? 'all'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: displayLeaves.isEmpty
            ? Center(child: Text('No leave requests', style: Theme.of(context).textTheme.bodyLarge))
            : SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columnSpacing: 12,
                  columns: [
                    if (_tab == 1) const DataColumn(label: Text('Employee')),
                    const DataColumn(label: Text('Type')),
                    const DataColumn(label: Text('Dates')),
                    const DataColumn(label: Text('Status')),
                    const DataColumn(label: Text('Reason')),
                    if (_tab == 1) const DataColumn(label: Text('Actions')),
                  ],
                  rows: displayLeaves.map((l) {
                    final employeeName = l.user?['name']?.toString() ?? '';
                    return DataRow(cells: [
                      if (_tab == 1) DataCell(Text(employeeName, style: Theme.of(context).textTheme.bodyMedium)),
                      DataCell(Text(l.leaveType, style: Theme.of(context).textTheme.bodyMedium)),
                      DataCell(Text('${l.startDate.substring(0, 10)} - ${l.endDate.substring(0, 10)}', style: Theme.of(context).textTheme.bodySmall)),
                      DataCell(_statusBadge(l)),
                      DataCell(
                        Tooltip(
                          message: l.reason,
                          child: Text(l.reason.length > 25 ? '${l.reason.substring(0, 25)}...' : l.reason, style: Theme.of(context).textTheme.bodyMedium),
                        ),
                      ),
                      if (_tab == 1) DataCell(l.isPending ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isTL && l.tlStatus == 'pending')
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              TextButton(onPressed: () => _tlAction(l, 'approve'), child: Text('Approve', style: TextStyle(fontSize: 11, color: Colors.green[600]))),
                              TextButton(onPressed: () => _tlAction(l, 'reject'), child: Text('Reject', style: TextStyle(fontSize: 11, color: Colors.red[400]))),
                            ]),
                          if (isAdmin && l.hrStatus == 'pending')
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              TextButton(onPressed: () => _hrAction(l, 'approve'), child: Text('Approve', style: TextStyle(fontSize: 11, color: Colors.green[600]))),
                              TextButton(onPressed: () => _hrAction(l, 'reject'), child: Text('Reject', style: TextStyle(fontSize: 11, color: Colors.red[400]))),
                            ]),
                        ],
                      ) : const Text('')),
                    ]);
                  }).toList(),
                ),
              ),
        ),
      ],
    );
  }

  Widget _statusBadge(LeaveRequest l) {
    Color c;
    String label = l.statusLabel;
    if (l.finalStatus == 'approved') c = Colors.green;
    else if (l.finalStatus == 'rejected' || l.tlStatus == 'rejected' || l.hrStatus == 'rejected') c = Colors.red;
    else if (l.tlStatus == 'approved') c = Colors.blue;
    else c = Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(fontSize: 11, color: c, fontWeight: FontWeight.w500)),
    );
  }
}
