import 'package:flutter/material.dart';

class BreakoutOverlay extends StatelessWidget {
  final VoidCallback onClose;
  final Function(String roomId) onJoinRoom;
  final List<Map<String, dynamic>> rooms;

  const BreakoutOverlay({
    super.key,
    required this.onClose,
    required this.onJoinRoom,
    this.rooms = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GestureDetector(onTap: onClose, child: Container(color: Colors.black54)),
        Center(
          child: Container(
            width: 520,
            height: 420,
            margin: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: Theme.of(context).dividerTheme.color!)),
                  ),
                  child: Row(
                    children: [
                      Text('Breakout Rooms', style: Theme.of(context).textTheme.titleMedium),
                      const Spacer(),
                      Text('${rooms.length} rooms', style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(width: 8),
                      IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onClose),
                    ],
                  ),
                ),
                Expanded(
                  child: rooms.isEmpty
                    ? Center(child: Text('No breakout rooms', style: Theme.of(context).textTheme.bodyLarge))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: rooms.length,
                        itemBuilder: (_, i) {
                          final room = rooms[i];
                          final name = room['name'] ?? 'Room ${i + 1}';
                          final participants = room['participants'] as List? ?? [];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              border: Border.all(color: Theme.of(context).dividerTheme.color!),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: ExpansionTile(
                              title: Row(
                                children: [
                                  Icon(Icons.meeting_room, size: 16, color: Colors.orange[600]),
                                  const SizedBox(width: 8),
                                  Text(name, style: Theme.of(context).textTheme.bodyMedium),
                                  const Spacer(),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.grey.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text('${participants.length}', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    height: 28,
                                    child: ElevatedButton(
                                      onPressed: () => onJoinRoom(room['id'] ?? ''),
                                      style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12)),
                                      child: const Text('Join', style: TextStyle(fontSize: 12)),
                                    ),
                                  ),
                                ],
                              ),
                              children: participants.map((p) => ListTile(
                                dense: true,
                                leading: CircleAvatar(radius: 12, backgroundColor: Theme.of(context).primaryColor, child: Text((p['name']?[0] ?? '?').toString(), style: const TextStyle(fontSize: 11, color: Colors.white))),
                                title: Text(p['name'] ?? '', style: Theme.of(context).textTheme.bodyMedium),
                                trailing: p['isHost'] == true ? Icon(Icons.star, size: 14, color: Colors.amber[600]) : null,
                              )).toList(),
                            ),
                          );
                        },
                      ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
