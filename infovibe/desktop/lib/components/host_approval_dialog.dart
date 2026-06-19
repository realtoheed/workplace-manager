import 'package:flutter/material.dart';

class HostApprovalDialog extends StatelessWidget {
  final String type; // 'recording' or 'remote-control'
  final String requesterName;
  final VoidCallback onApprove;
  final VoidCallback onDeny;

  const HostApprovalDialog({
    super.key,
    required this.type,
    required this.requesterName,
    required this.onApprove,
    required this.onDeny,
  });

  @override
  Widget build(BuildContext context) {
    final isRecording = type == 'recording';
    return AlertDialog(
      title: Row(
        children: [
          Icon(isRecording ? Icons.fiber_manual_record : Icons.mouse, color: isRecording ? Colors.red : Colors.blue, size: 22),
          const SizedBox(width: 8),
          Text(isRecording ? 'Recording Request' : 'Remote Control Request'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$requesterName wants to ${isRecording ? 'record this meeting' : 'control your screen'}.'),
          const SizedBox(height: 8),
          if (!isRecording)
            Text('They will be able to see and control your screen.', style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      actions: [
        TextButton(onPressed: onDeny, child: const Text('Deny')),
        ElevatedButton(
          onPressed: onApprove,
          style: ElevatedButton.styleFrom(
            backgroundColor: isRecording ? Colors.red : Colors.blue,
          ),
          child: Text(isRecording ? 'Allow Recording' : 'Allow Control'),
        ),
      ],
    );
  }
}
