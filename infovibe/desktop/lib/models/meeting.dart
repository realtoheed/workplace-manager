class Meeting {
  final String id;
  final String title;
  final String meetingName;
  final String meetingId;
  final String roomName;
  final String type;
  final bool isActive;
  final bool isPermanent;
  final List<String> breakoutRooms;
  final List<String> breakoutRoomNames;
  final String? createdByName;
  final String createdAt;
  final int participantCount;

  Meeting({
    required this.id,
    required this.title,
    required this.meetingName,
    required this.meetingId,
    required this.roomName,
    required this.type,
    required this.isActive,
    this.isPermanent = false,
    this.breakoutRooms = const [],
    this.breakoutRoomNames = const [],
    this.createdByName,
    required this.createdAt,
    this.participantCount = 0,
  });

  factory Meeting.fromJson(Map<String, dynamic> json) => Meeting(
    id: json['id'] ?? '',
    title: json['title'] ?? '',
    meetingName: json['meetingName'] ?? json['title'] ?? '',
    meetingId: json['meetingId'] ?? json['roomName'] ?? '',
    roomName: json['roomName'] ?? '',
    type: json['type'] ?? 'temporary',
    isActive: json['isActive'] ?? true,
    isPermanent: json['isPermanent'] ?? json['type'] == 'persistent',
    breakoutRooms: (json['breakoutRooms'] as List?)?.map((e) => e.toString()).toList() ?? [],
    breakoutRoomNames: (json['breakoutRoomNames'] as List?)?.map((e) => e.toString()).toList() ?? [],
    createdByName: json['createdByName'],
    createdAt: json['createdAt'] ?? '',
    participantCount: json['participantCount'] ?? 0,
  );
}
