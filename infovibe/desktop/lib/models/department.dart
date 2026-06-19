class Department {
  final String id;
  final String name;
  final String? headId;
  final Map<String, dynamic>? head;
  final int memberCount;

  Department({
    required this.id,
    required this.name,
    this.headId,
    this.head,
    this.memberCount = 0,
  });

  factory Department.fromJson(Map<String, dynamic> json) => Department(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    headId: json['headId'],
    head: json['head'],
    memberCount: json['memberCount'] ?? 0,
  );
}
