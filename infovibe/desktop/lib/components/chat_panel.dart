import 'package:flutter/material.dart';

class ChatPanel extends StatefulWidget {
  const ChatPanel({super.key});
  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> {
  final _msgCtrl = TextEditingController();
  final _messages = <Map<String, dynamic>>[];
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _messages.addAll([
      {'sender': 'System', 'text': 'Meeting started', 'time': DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(), 'isSystem': true},
      {'sender': 'Alice', 'text': 'Hey everyone!', 'time': DateTime.now().subtract(const Duration(minutes: 3)).toIso8601String(), 'isSystem': false},
    ]);
  }

  void _send() {
    if (_msgCtrl.text.trim().isEmpty) return;
    setState(() {
      _messages.add({'sender': 'You', 'text': _msgCtrl.text.trim(), 'time': DateTime.now().toIso8601String(), 'isSystem': false, 'isMe': true});
      _msgCtrl.clear();
    });
    Future.delayed(const Duration(milliseconds: 100), () => _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
                Text('Chat', style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                Text('${_messages.length}', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (_, i) {
                final m = _messages[i];
                if (m['isSystem'] == true) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Center(child: Text(m['text'], style: TextStyle(fontSize: 11, color: Colors.grey[500], fontStyle: FontStyle.italic))),
                  );
                }
                final isMe = m['isMe'] == true;
                final time = m['time']?.toString().substring(11, 16) ?? '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                      if (!isMe) Text(m['sender'] ?? '', style: TextStyle(fontSize: 11, color: Colors.grey[500], fontWeight: FontWeight.w500)),
                      const SizedBox(height: 2),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isMe ? Theme.of(context).primaryColor.withOpacity(0.15) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                          borderRadius: BorderRadius.circular(12).copyWith(
                            bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(12),
                            bottomLeft: !isMe ? const Radius.circular(4) : const Radius.circular(12),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                          children: [
                            Text(m['text'] ?? '', style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 2),
                            Text(time, style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: Theme.of(context).dividerTheme.color!)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 36,
                    child: TextField(
                      controller: _msgCtrl,
                      decoration: InputDecoration(
                        hintText: 'Type a message...',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: Icon(Icons.send, size: 18, color: Theme.of(context).primaryColor),
                  onPressed: _send,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
