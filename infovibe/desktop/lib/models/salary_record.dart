class SalaryRecord {
  final String id;
  final String userId;
  final String employeeName;
  final String employeeEmail;
  final String designation;
  final int month;
  final int year;
  final double monthlySalary;
  final int absentDays;
  final double deductions;
  final double netSalary;
  final String status;

  SalaryRecord({
    required this.id,
    required this.userId,
    required this.employeeName,
    this.employeeEmail = '',
    this.designation = '',
    required this.month,
    required this.year,
    required this.monthlySalary,
    this.absentDays = 0,
    this.deductions = 0,
    required this.netSalary,
    this.status = 'pending',
  });

  factory SalaryRecord.fromJson(Map<String, dynamic> json) => SalaryRecord(
    id: json['id'] ?? '',
    userId: json['userId'] ?? '',
    employeeName: json['employeeName'] ?? 'Unknown',
    employeeEmail: json['employeeEmail'] ?? '',
    designation: json['designation'] ?? '',
    month: json['month'] ?? 1,
    year: json['year'] ?? DateTime.now().year,
    monthlySalary: (json['monthlySalary'] ?? 0).toDouble(),
    absentDays: json['absentDays'] ?? 0,
    deductions: (json['deductions'] ?? 0).toDouble(),
    netSalary: (json['netSalary'] ?? 0).toDouble(),
    status: json['status'] ?? 'pending',
  );

  String get period => '$month/$year';
}
