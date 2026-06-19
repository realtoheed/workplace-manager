class ChatMessage {
  final String id;
  final String userId;
  final String userName;
  final String message;
  final String? fileUrl;
  final String createdAt;

  ChatMessage({required this.id, required this.userId, required this.userName, required this.message, this.fileUrl, required this.createdAt});

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: (json['id'] ?? '').toString(),
    userId: json['user_id'] ?? '',
    userName: json['user_name'] ?? json['name'] ?? '',
    message: json['message'] ?? '',
    fileUrl: json['file_url'],
    createdAt: json['created_at'] ?? '',
  );
}
