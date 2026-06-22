import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api/client.dart';

class CompanyMeetingSettings extends StatefulWidget {
  const CompanyMeetingSettings({super.key});
  @override
  State<CompanyMeetingSettings> createState() => _CompanyMeetingSettingsState();
}

class _CompanyMeetingSettingsState extends State<CompanyMeetingSettings> {
  final _api = ApiClient();
  bool _loading = true;
  Map<String, dynamic>? _meeting;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/meetings/persistent');
      setState(() {
        _meeting = data['meeting'];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[CompanyMeeting] Failed to load: $e');
      setState(() => _loading = false);
    }
  }

  Future<void> _save(List<String> names) async {
    try {
      await _api.post('/meetings/persistent', body: {
        'breakoutRoomNames': names,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Settings saved')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _toggleActive(bool active) async {
    try {
      await _api.post('/meetings/persistent', body: {
        'isActive': active,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(active ? 'Meeting activated' : 'Meeting deactivated')));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _editBreakoutRooms() {
    final rooms = _meeting?['breakoutRooms'] as List?;
    final names = List<String>.from(rooms?.map((r) => r['name'] as String) ?? []);
    if (names.isEmpty) {
      names.addAll(List.generate(5, (i) => '${i + 1}'));
    }
    final ctrls = names.map((n) => TextEditingController(text: n)).toList();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Breakout Rooms'),
          content: SizedBox(
            width: 400,
            height: 400,
            child: ListView.builder(
              itemCount: ctrls.length + 1,
              itemBuilder: (_, i) {
                if (i == ctrls.length) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: TextButton.icon(
                      onPressed: () {
                        ctrls.add(TextEditingController(text: '${ctrls.length + 1}'));
                        setDialogState(() {});
                      },
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Add Room'),
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      SizedBox(width: 24, child: Text('${i + 1}', style: Theme.of(context).textTheme.bodySmall)),
                      const SizedBox(width: 8),
                      Expanded(child: SizedBox(height: 36, child: TextField(controller: ctrls[i], decoration: InputDecoration(isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8), border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)))))),
                      IconButton(icon: const Icon(Icons.close, size: 16), onPressed: ctrls.length > 1 ? () { ctrls.removeAt(i).dispose(); setDialogState(() {}); } : null),
                    ],
                  ),
                );
              },
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                await _save(ctrls.map((c) => c.text).toList());
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final rooms = _meeting?['breakoutRooms'] as List?;
    final roomCount = rooms?.length ?? 0;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Company Meeting Settings', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Text('Configure the permanent company meeting lobby.', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).dividerTheme.color!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Meeting Info', style: Theme.of(context).textTheme.titleMedium)),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Switch(
                          value: _meeting?['isActive'] == true,
                          onChanged: _toggleActive,
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: (_meeting?['isActive'] == true ? Colors.green : Colors.red).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(_meeting?['isActive'] == true ? 'Active' : 'Inactive', style: TextStyle(fontSize: 12, color: _meeting?['isActive'] == true ? Colors.green : Colors.red)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text('Room: ${_meeting?['roomName'] ?? 'company-office'}', style: Theme.of(context).textTheme.bodyMedium),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 16),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _meeting?['roomName'] ?? 'company-office'));
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Room name copied'), duration: Duration(seconds: 1)));
                      },
                    ),
                  ],
                ),
                Text('Title: ${_meeting?['title'] ?? 'Company Office'}', style: Theme.of(context).textTheme.bodyMedium),
                Text('Participants: ${_meeting?['participantCount'] ?? 0}', style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).dividerTheme.color!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Breakout Rooms', style: Theme.of(context).textTheme.titleMedium)),
                    TextButton.icon(
                      onPressed: _editBreakoutRooms,
                      icon: const Icon(Icons.edit, size: 16),
                      label: Text('$roomCount rooms'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...(rooms?.take(10).map((r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Icon(Icons.meeting_room, size: 14, color: Colors.grey[500]),
                      const SizedBox(width: 8),
                      Text(r['name'] ?? '', style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
                )) ?? [Text('No breakout rooms configured', style: Theme.of(context).textTheme.bodySmall)]),
                if (roomCount > 10) Text('... and ${roomCount - 10} more', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
