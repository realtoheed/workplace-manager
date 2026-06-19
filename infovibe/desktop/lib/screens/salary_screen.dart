import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../models/salary_record.dart';
import '../providers/auth_provider.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});
  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  final _api = ApiClient();
  List<SalaryRecord> _records = [];
  bool _loading = true;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = context.read<AuthProvider>().currentUser;
      if (user?.canManageSalary == true) {
        final data = await _api.get('/salary');
        setState(() {
          _records = (data['records'] as List?)?.map((e) => SalaryRecord.fromJson(e)).toList() ?? [];
          _loading = false;
        });
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _addRecord() async {
    final amtCtrl = TextEditingController();
    final monthCtrl = TextEditingController(text: '${DateTime.now().month}');
    final yearCtrl = TextEditingController(text: '${DateTime.now().year}');
    String? userId;
    List users = [];

    try {
      final u = await _api.get('/users');
      users = u['users'] as List? ?? [];
    } catch (_) {}

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Salary Record'),
        content: SizedBox(
          width: 380,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Employee'),
                  items: users.map<DropdownMenuItem<String>>((u) => DropdownMenuItem<String>(value: u['id'] as String?, child: Text(u['name'] as String? ?? ''))).toList(),
                  onChanged: (v) => userId = v,
                ),
                const SizedBox(height: 12),
                TextField(controller: monthCtrl, decoration: const InputDecoration(labelText: 'Month'), keyboardType: TextInputType.number),
                const SizedBox(height: 12),
                TextField(controller: yearCtrl, decoration: const InputDecoration(labelText: 'Year'), keyboardType: TextInputType.number),
                const SizedBox(height: 12),
                TextField(controller: amtCtrl, decoration: const InputDecoration(labelText: 'Monthly Salary'), keyboardType: TextInputType.number),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await _api.post('/salary', body: {
                  'userId': userId, 'month': int.parse(monthCtrl.text), 'year': int.parse(yearCtrl.text), 'monthlySalary': double.parse(amtCtrl.text),
                });
                Navigator.pop(ctx);
                _load();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final canManage = user?.canManageSalary == true;
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (!canManage) {
      return Center(child: Text('Salary information is managed by HR.', style: Theme.of(context).textTheme.bodyLarge));
    }

    final pageData = _records.skip(_page * 10).take(10).toList();
    final totalPages = (_records.length / 10).ceil();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Salary Records', style: Theme.of(context).textTheme.titleLarge)),
            ElevatedButton.icon(onPressed: _addRecord, icon: const Icon(Icons.add, size: 18), label: const Text('Add Record')),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: _records.isEmpty
            ? Center(child: Text('No salary records', style: Theme.of(context).textTheme.bodyLarge))
            : SingleChildScrollView(
                child: DataTable(
                  columnSpacing: 16,
                  columns: const [
                    DataColumn(label: Text('Employee')), DataColumn(label: Text('Period')),
                    DataColumn(label: Text('Salary')), DataColumn(label: Text('Absent')),
                    DataColumn(label: Text('Deductions')), DataColumn(label: Text('Net')),
                    DataColumn(label: Text('Status')),
                  ],
                  rows: pageData.map((r) => DataRow(cells: [
                    DataCell(Text(r.employeeName, style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('${r.month}/${r.year}', style: Theme.of(context).textTheme.bodySmall)),
                    DataCell(Text('\$${r.monthlySalary.toStringAsFixed(0)}', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('${r.absentDays}', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('\$${r.deductions.toStringAsFixed(0)}', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text('\$${r.netSalary.toStringAsFixed(0)}', style: TextStyle(color: Colors.green[600], fontWeight: FontWeight.w600, fontSize: 14))),
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

  Widget _statusBadge(String status) {
    Color c = status == 'paid' ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(status, style: TextStyle(fontSize: 12, color: c, fontWeight: FontWeight.w500)),
    );
  }
}
