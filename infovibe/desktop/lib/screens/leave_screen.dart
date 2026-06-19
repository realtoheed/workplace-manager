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
    } catch (_) {
      setState(() => _loading = false);
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
                TextField(controller: startCtrl, decoration: const InputDecoration(labelText: 'Start Date', hintText: 'YYYY-MM-DD')),
                const SizedBox(height: 12),
                TextField(controller: endCtrl, decoration: const InputDecoration(labelText: 'End Date', hintText: 'YYYY-MM-DD')),
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
      final ctrl = TextEditingController();
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Rejection Comment'),
          content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Comment'), maxLines: 3),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                await _api.patch('/leave/${l.id}/tl-action', body: {'action': 'reject', 'comment': ctrl.text});
                Navigator.pop(ctx);
                _load();
              },
              child: const Text('Reject'),
            ),
          ],
        ),
      );
    } else {
      await _api.patch('/leave/${l.id}/tl-action', body: {'action': action});
      _load();
    }
  }

  void _hrAction(LeaveRequest l, String action) async {
    if (action == 'reject') {
      final ctrl = TextEditingController();
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Rejection Comment'),
          content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Comment'), maxLines: 3),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                await _api.patch('/leave/${l.id}/hr-action', body: {'action': 'reject', 'comment': ctrl.text});
                Navigator.pop(ctx);
                _load();
              },
              child: const Text('Reject'),
            ),
          ],
        ),
      );
    } else {
      await _api.patch('/leave/${l.id}/hr-action', body: {'action': action});
      _load();
    }
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
    final displayLeaves = _tab == 1 ? pendingLeaves : myLeaves;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Leave', style: Theme.of(context).textTheme.titleLarge)),
            if (canSubmit) ElevatedButton.icon(onPressed: _submitLeave, icon: const Icon(Icons.add, size: 18), label: const Text('Submit Leave')),
          ],
        ),
        const SizedBox(height: 12),
        if (showAll)
          Row(
            children: List.generate(2, (i) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(label: Text(i == 0 ? 'My Requests' : 'Pending'), selected: _tab == i, onSelected: (v) => setState(() => _tab = i)),
            )),
          ),
        const SizedBox(height: 12),
        Expanded(
          child: displayLeaves.isEmpty
            ? Center(child: Text('No leave requests', style: Theme.of(context).textTheme.bodyLarge))
            : SingleChildScrollView(
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
                      DataCell(Text(l.reason.length > 25 ? '${l.reason.substring(0, 25)}...' : l.reason, style: Theme.of(context).textTheme.bodyMedium)),
                      if (_tab == 1) DataCell(l.isPending ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isTL && l.tlStatus == 'pending')
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              TextButton(onPressed: () => _tlAction(l, 'recommend'), child: Text('Recommend', style: TextStyle(fontSize: 11, color: Colors.green[600]))),
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
