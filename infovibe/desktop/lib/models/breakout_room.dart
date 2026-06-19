class BreakoutRoom {
  final String id;
  final String name;
  final int participantCount;
  final List<dynamic> participants;

  BreakoutRoom({required this.id, required this.name, this.participantCount = 0, this.participants = const []});

  factory BreakoutRoom.fromJson(Map<String, dynamic> json) => BreakoutRoom(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    participantCount: json['participant_count'] ?? json['participants']?.length ?? 0,
    participants: json['participants'] ?? [],
  );
}
