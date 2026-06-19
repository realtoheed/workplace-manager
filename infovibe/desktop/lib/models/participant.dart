class Participant {
  final String id;
  final String name;
  final bool isClient;
  final String? roomId;
  final bool speaking;
  final bool muted;
  final bool screenShare;

  Participant({required this.id, required this.name, this.isClient = false, this.roomId, this.speaking = false, this.muted = false, this.screenShare = false});

  factory Participant.fromJson(Map<String, dynamic> json) => Participant(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    isClient: json['is_client'] ?? false,
    roomId: json['room_id'],
    muted: json['muted'] ?? false,
    screenShare: json['screen_share'] ?? false,
  );
}
