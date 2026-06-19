class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? designation;
  final String? departmentId;
  final String? department;
  final String? defaultRoomId;
  final String? hireDate;
  final bool isActive;
  final bool mustChangePassword;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.designation,
    this.departmentId,
    this.department,
    this.defaultRoomId,
    this.hireDate,
    this.isActive = true,
    this.mustChangePassword = false,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    email: json['email'] ?? '',
    role: json['role'] ?? 'employee',
    designation: json['designation'],
    departmentId: json['departmentId'],
    department: json['department'],
    defaultRoomId: json['defaultRoomId'],
    hireDate: json['hireDate'],
    isActive: json['isActive'] ?? true,
    mustChangePassword: json['mustChangePassword'] ?? false,
  );

  bool get isAdmin => role == 'super_admin' || role == 'hr';
  bool get isTeamLead => role == 'team_lead';
  bool get isEmployee => role == 'employee';
  bool get canManageUsers => role == 'super_admin' || role == 'hr';
  bool get canManageSalary => role == 'super_admin' || role == 'hr';
}
