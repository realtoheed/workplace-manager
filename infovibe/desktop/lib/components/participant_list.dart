import 'package:flutter/material.dart';

class ParticipantList extends StatefulWidget {
  final List<Map<String, dynamic>> participants;
  const ParticipantList({super.key, this.participants = const []});

  @override
  State<ParticipantList> createState() => _ParticipantListState();
}

class _ParticipantListState extends State<ParticipantList> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final participants = widget.participants;
    return Container(
      width: 320,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        border: Border(left: BorderSide(color: Theme.of(context).dividerTheme.color!)),
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
                Text('Participants (${participants.length})', style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.person_add, size: 18),
                  onPressed: () {},
                  tooltip: 'Invite',
                ),
              ],
            ),
          ),
          Expanded(
            child: participants.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.people_outline, size: 40, color: Colors.grey[500]),
                      const SizedBox(height: 8),
                      Text('No participants', style: Theme.of(context).textTheme.bodyLarge),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: participants.length,
                  itemBuilder: (_, i) {
                    final p = participants[i];
                    final isHost = p['isHost'] == true;
                    final name = p['name'] ?? 'Unknown';
                    final isMuted = p['isMuted'] == true;
                    final isVideoOn = p['isVideoOn'] != false;
                    final isScreenSharing = p['isScreenSharing'] == true;
                    final isHandRaised = p['isHandRaised'] == true;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: isDark ? const Color(0xFF334155).withOpacity(0.3) : const Color(0xFFE2E8F0).withOpacity(0.3),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: Theme.of(context).primaryColor,
                            child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 13)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(name, style: Theme.of(context).textTheme.bodyMedium),
                                    if (isHost) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(color: Colors.amber.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                                        child: Text('Host', style: TextStyle(fontSize: 10, color: Colors.amber[700], fontWeight: FontWeight.w600)),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (isHandRaised) Icon(Icons.pan_tool, size: 16, color: Colors.amber[600]),
                          const SizedBox(width: 6),
                          Icon(isMuted ? Icons.mic_off : Icons.mic, size: 16, color: isMuted ? Colors.red[400] : Colors.grey[500]),
                          const SizedBox(width: 6),
                          Icon(isVideoOn ? Icons.videocam : Icons.videocam_off, size: 16, color: !isVideoOn ? Colors.red[400] : Colors.grey[500]),
                          if (isScreenSharing) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.screen_share, size: 16, color: Colors.green[500]),
                          ],
                        ],
                      ),
                    );
                  },
                ),
          ),
        ],
      ),
    );
  }
}
