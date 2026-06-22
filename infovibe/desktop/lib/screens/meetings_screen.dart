import 'dart:async';
import 'package:flutter/foundation.dart';
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
  String _searchQuery = '';
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/meetings');
      setState(() {
        _meetings = (data['meetings'] as List?)?.map((e) => Meeting.fromJson(e)).toList() ?? [];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Meetings] Failed to load: $e');
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final isAdmin = user?.isAdmin == true;
    if (_loading) return const Center(child: CircularProgressIndicator());
    final filtered = _searchQuery.isEmpty
        ? _meetings
        : _meetings.where((m) =>
            m.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            m.roomName.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Meetings', style: Theme.of(context).textTheme.titleLarge)),
            SizedBox(
              width: 200,
              child: TextField(
                decoration: const InputDecoration(labelText: 'Search', hintText: 'Meeting title or room', prefixIcon: Icon(Icons.search, size: 18), isDense: true),
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(onPressed: _showJoinDialog, icon: const Icon(Icons.add, size: 18), label: const Text('Join Meeting')),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: filtered.isEmpty
            ? Center(child: Text(_searchQuery.isEmpty ? 'No meetings available' : 'No meetings match your search', style: Theme.of(context).textTheme.bodyLarge))
            : ListView.separated(
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final m = filtered[i];
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
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
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
                            if (isAdmin) ...[
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.stop_circle_outlined, size: 20, color: Colors.red),
                                tooltip: 'End meeting',
                                onPressed: () {
                                  showDialog(
                                    context: context,
                                    builder: (ctx) => AlertDialog(
                                      title: const Text('End Meeting'),
                                      content: Text('End "${m.title}" for all participants?'),
                                      actions: [
                                        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                                        ElevatedButton(
                                          onPressed: () async {
                                            try {
                                              await _api.post('/meetings/${m.id}/end');
                                              Navigator.pop(ctx);
                                              _load();
                                            } catch (e) {
                                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                                            }
                                          },
                                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                          child: const Text('End'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ],
                          ],
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
        content: TextField(
          controller: idCtrl,
          decoration: const InputDecoration(labelText: 'Meeting ID or Room Name'),
          autofocus: true,
          onSubmitted: (_) {
            final id = idCtrl.text.trim();
            if (id.isEmpty) return;
            Navigator.pop(ctx);
            Navigator.of(context).push(
              MaterialPageRoute(
                fullscreenDialog: true,
                builder: (_) => PrejoinScreen(meetingId: id, roomId: id),
              ),
            );
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final id = idCtrl.text.trim();
              if (id.isEmpty) return;
              Navigator.pop(ctx);
              Navigator.of(context).push(
                MaterialPageRoute(
                  fullscreenDialog: true,
                  builder: (_) => PrejoinScreen(meetingId: id, roomId: id),
                ),
              );
            },
            child: const Text('Join'),
          ),
        ],
      ),
    );
  }
}
