import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/client.dart';
import '../models/meeting.dart';
import '../providers/auth_provider.dart';
import 'prejoin_screen.dart';
import 'meeting_window.dart';

class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({super.key});
  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  final _api = ApiClient();
  List<Meeting> _meetings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/meetings');
      setState(() {
        _meetings = (data['meetings'] as List?)?.map((e) => Meeting.fromJson(e)).toList() ?? [];
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
        Row(
          children: [
            Expanded(child: Text('Meetings', style: Theme.of(context).textTheme.titleLarge)),
            if (user?.isAdmin == true)
              ElevatedButton.icon(onPressed: _showJoinDialog, icon: const Icon(Icons.add, size: 18), label: const Text('Join Meeting')),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _meetings.isEmpty
            ? Center(child: Text('No meetings available', style: Theme.of(context).textTheme.bodyLarge))
            : ListView.separated(
                itemCount: _meetings.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final m = _meetings[i];
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
                          width: 48, height: 48,
                          decoration: BoxDecoration(
                            color: m.isPermanent ? Colors.green.withOpacity(0.1) : Colors.blue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(m.isPermanent ? Icons.meeting_room : Icons.videocam, color: m.isPermanent ? Colors.green : Colors.blue, size: 22),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.title, style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  _tag(m.isPermanent ? 'Permanent' : m.type, m.isPermanent ? Colors.green : Colors.blue),
                                  const SizedBox(width: 8),
                                  _tag('${m.participantCount} online', Colors.grey),
                                  if (m.breakoutRoomNames.isNotEmpty) ...[
                                    const SizedBox(width: 8),
                                    _tag('${m.breakoutRoomNames.length} rooms', Colors.orange),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                fullscreenDialog: true,
                                builder: (_) => PrejoinScreen(
                                  meetingId: m.id,
                                  roomId: m.roomName,
                                ),
                              ),
                            );
                          },
                          child: const Text('Join'),
                        ),
                      ],
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }

  Widget _tag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
    );
  }

  void _showJoinDialog() {
    final idCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Join Meeting'),
        content: TextField(controller: idCtrl, decoration: const InputDecoration(labelText: 'Meeting ID or Room Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              idCtrl.dispose();
            },
            child: const Text('Join'),
          ),
        ],
      ),
    );
  }
}
