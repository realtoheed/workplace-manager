import 'package:flutter/material.dart';
import '../screens/prejoin_screen.dart';

class PermanentMeetingButton extends StatelessWidget {
  const PermanentMeetingButton({super.key});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: 24,
      bottom: 24,
      child: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              fullscreenDialog: true,
              builder: (_) => const PrejoinScreen(
                  meetingId: 'company-office',
                  roomId: 'company-office',
                ),
            ),
          );
        },
        backgroundColor: Colors.green,
        child: const Icon(Icons.meeting_room, color: Colors.white),
      ),
    );
  }
}
