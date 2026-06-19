class AttendanceRecord {
  final String id;
  final String userId;
  final String? userName;
  final String? userEmail;
  final String date;
  final String? firstJoinAt;
  final String? lastLeaveAt;
  final int totalWorkMinutes;
  final int breakMinutes;
  final int screenshareMinutes;
  final int lateMinutes;
  final String status;

  AttendanceRecord({
    required this.id,
    required this.userId,
    this.userName,
    this.userEmail,
    required this.date,
    this.firstJoinAt,
    this.lastLeaveAt,
    this.totalWorkMinutes = 0,
    this.breakMinutes = 0,
    this.screenshareMinutes = 0,
    this.lateMinutes = 0,
    required this.status,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) => AttendanceRecord(
    id: json['id'] ?? '',
    userId: json['userId'] ?? '',
    userName: json['userName'],
    userEmail: json['userEmail'],
    date: json['date'] ?? '',
    firstJoinAt: json['firstJoinAt'],
    lastLeaveAt: json['lastLeaveAt'],
    totalWorkMinutes: json['totalWorkMinutes'] ?? 0,
    breakMinutes: json['breakMinutes'] ?? 0,
    screenshareMinutes: json['screenshareMinutes'] ?? 0,
    lateMinutes: json['lateMinutes'] ?? 0,
    status: json['status'] ?? 'absent',
  );
}
