class LeaveRequest {
  final String id;
  final String userId;
  final String leaveType;
  final String startDate;
  final String endDate;
  final String reason;
  final String tlStatus;
  final String? tlComment;
  final String? tlActedAt;
  final String hrStatus;
  final String? hrComment;
  final String? hrActedAt;
  final String finalStatus;
  final String createdAt;
  final Map<String, dynamic>? user;

  LeaveRequest({
    required this.id,
    required this.userId,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.reason,
    this.tlStatus = 'pending',
    this.tlComment,
    this.tlActedAt,
    this.hrStatus = 'pending',
    this.hrComment,
    this.hrActedAt,
    this.finalStatus = 'pending',
    required this.createdAt,
    this.user,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) => LeaveRequest(
    id: json['id'] ?? '',
    userId: json['userId'] ?? '',
    leaveType: json['leaveType'] ?? '',
    startDate: json['startDate'] ?? '',
    endDate: json['endDate'] ?? '',
    reason: json['reason'] ?? '',
    tlStatus: json['tlStatus'] ?? 'pending',
    tlComment: json['tlComment'],
    tlActedAt: json['tlActedAt'],
    hrStatus: json['hrStatus'] ?? 'pending',
    hrComment: json['hrComment'],
    hrActedAt: json['hrActedAt'],
    finalStatus: json['finalStatus'] ?? 'pending',
    createdAt: json['createdAt'] ?? '',
    user: json['user'],
  );

  String get statusLabel {
    if (finalStatus == 'approved') return 'Approved';
    if (finalStatus == 'rejected') return 'Rejected';
    if (tlStatus == 'rejected') return 'TL Rejected';
    if (hrStatus == 'rejected') return 'HR Rejected';
    if (tlStatus == 'approved' && hrStatus == 'pending') return 'TL Approved';
    return 'Pending';
  }

  bool get isPending => finalStatus == 'pending' && tlStatus != 'rejected' && hrStatus != 'rejected';
}
