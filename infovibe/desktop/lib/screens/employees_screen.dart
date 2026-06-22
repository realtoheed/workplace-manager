import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../models/user.dart';
import '../models/department.dart';
import '../providers/auth_provider.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});
  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  final _api = ApiClient();
  List<User> _users = [];
  List<Department> _departments = [];
  bool _loading = true;
  bool _saving = false;
  int _page = 0;
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final userData = await _api.get('/users');
      final deptData = await _api.get('/departments');
      setState(() {
        _users = (userData['users'] as List?)?.map((e) => User.fromJson(e)).toList() ?? [];
        _departments = (deptData['departments'] as List?)?.map((e) => Department.fromJson(e)).toList() ?? [];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Employees] Failed to load: $e');
      setState(() => _loading = false);
    }
  }

  void _showUserModal({User? existing}) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final emailCtrl = TextEditingController(text: existing?.email ?? '');
    final passCtrl = TextEditingController();
    final auth = context.read<AuthProvider>();
    String role = existing?.role ?? 'employee';
    String? deptId = existing?.departmentId;

    final allowedRoles = <String>['employee', 'team_lead'];
    if (auth.currentUser?.role == 'super_admin') {
      allowedRoles.addAll(['hr', 'super_admin']);
    } else if (auth.currentUser?.role == 'hr') {
      allowedRoles.add('hr');
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(existing != null ? 'Edit Employee' : 'Add Employee'),
          content: SizedBox(
            width: 400,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name', errorText: nameCtrl.text.isEmpty ? null : null)),
                  const SizedBox(height: 12),
                  TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email'), enabled: existing == null),
                  const SizedBox(height: 12),
                  if (existing == null) TextField(controller: passCtrl, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: allowedRoles.contains(role) ? role : allowedRoles.first,
                    decoration: const InputDecoration(labelText: 'Role'),
                    items: allowedRoles.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                    onChanged: (v) => role = v ?? allowedRoles.first,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String?>(
                    value: deptId,
                    decoration: const InputDecoration(labelText: 'Department'),
                    items: [const DropdownMenuItem(value: null, child: Text('None')), ..._departments.map((d) => DropdownMenuItem(value: d.id, child: Text(d.name)))],
                    onChanged: (v) => deptId = v,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: _saving ? null : () async {
                if (existing == null && nameCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name is required')));
                  return;
                }
                if (existing == null && emailCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Email is required')));
                  return;
                }
                setDialogState(() => _saving = true);
                try {
                  if (existing != null) {
                    await _api.patch('/users/${existing.id}', body: {'role': role, 'departmentId': deptId});
                  } else {
                    await _api.post('/users', body: {
                      'name': nameCtrl.text, 'email': emailCtrl.text, 'password': passCtrl.text,
                      'role': role, 'departmentId': deptId,
                    });
                  }
                  Navigator.pop(ctx);
                  _load();
                } catch (e) {
                  setDialogState(() => _saving = false);
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                  }
                }
              },
              child: _saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(existing != null ? 'Update' : 'Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(User user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deactivate Employee'),
        content: Text('Deactivate ${user.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await _api.delete('/users/${user.id}');
                Navigator.pop(ctx);
                _load();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (_loading) return const Center(child: CircularProgressIndicator());
    final query = _searchCtrl.text.toLowerCase();
    final filtered = _users.where((u) => query.isEmpty || u.name.toLowerCase().contains(query) || u.email.toLowerCase().contains(query)).toList();
    final pageData = filtered.skip(_page * 10).take(10).toList();
    final totalPages = (filtered.length / 10).ceil();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Employees', style: Theme.of(context).textTheme.titleLarge)),
            if (auth.currentUser?.canManageUsers == true)
              ElevatedButton.icon(onPressed: () => _showUserModal(), icon: const Icon(Icons.add, size: 18), label: const Text('Add Employee')),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: 280,
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(labelText: 'Search', hintText: 'Name or email', prefixIcon: Icon(Icons.search, size: 20)),
            onChanged: (_) {
              _searchDebounce?.cancel();
              _searchDebounce = Timer(const Duration(milliseconds: 300), () {
                if (mounted) setState(() => _page = 0);
              });
            },
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: pageData.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.people_outline, size: 48, color: Colors.grey[400]),
                    const SizedBox(height: 8),
                    Text(_searchCtrl.text.isEmpty ? 'No employees' : 'No employees match your search', style: Theme.of(context).textTheme.bodyLarge),
                    if (auth.currentUser?.canManageUsers == true) ...[
                      const SizedBox(height: 12),
                      ElevatedButton.icon(onPressed: () => _showUserModal(), icon: const Icon(Icons.add, size: 16), label: const Text('Add Employee')),
                    ],
                  ],
                ),
              )
            : SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columnSpacing: 16,
                  columns: const [
                    DataColumn(label: Text('Name')), DataColumn(label: Text('Email')),
                    DataColumn(label: Text('Role')), DataColumn(label: Text('Department')),
                    DataColumn(label: Text('Status')), DataColumn(label: Text('Actions')),
                  ],
                  rows: pageData.map((u) => DataRow(cells: [
                    DataCell(Text(u.name, style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text(u.email, style: Theme.of(context).textTheme.bodySmall)),
                    DataCell(_roleBadge(u.role)),
                    DataCell(Text(u.department ?? '-', style: Theme.of(context).textTheme.bodyMedium)),
                    DataCell(Text(u.isActive ? 'Active' : 'Inactive', style: TextStyle(color: u.isActive ? Colors.green : Colors.red, fontSize: 13))),
                    DataCell(Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(icon: const Icon(Icons.edit, size: 16), onPressed: auth.currentUser?.canManageUsers == true ? () => _showUserModal(existing: u) : null),
                        IconButton(icon: const Icon(Icons.delete, size: 16), onPressed: auth.currentUser?.canManageUsers == true ? () => _confirmDelete(u) : null),
                      ],
                    )),
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

  Widget _roleBadge(String role) {
    Color c;
    switch (role) {
      case 'super_admin': c = Colors.red; break;
      case 'hr': c = Colors.blue; break;
      case 'team_lead': c = Colors.orange; break;
      default: c = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(role.replaceAll('_', ' '), style: TextStyle(fontSize: 12, color: c, fontWeight: FontWeight.w500)),
    );
  }
}
