import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:workplace_manager/models/user.dart';
import 'package:workplace_manager/models/meeting.dart';
import 'package:workplace_manager/models/leave_request.dart';
import 'package:workplace_manager/models/attendance_record.dart';
import 'package:workplace_manager/models/salary_record.dart';
import 'package:workplace_manager/models/chat_message.dart';
import 'package:workplace_manager/models/department.dart';
import 'package:workplace_manager/models/breakout_room.dart';
import 'package:workplace_manager/models/participant.dart';
import 'package:workplace_manager/api/client.dart';

class MockHttpClient extends http.BaseClient {
  final Map<String, http.Response> responses = {};

  void expect(String url, int statusCode, dynamic body) {
    responses[url] = http.Response(jsonEncode(body), statusCode);
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    final response = responses[request.url.toString()] ??
        http.Response(jsonEncode({'error': 'Not found'}), 404);
    return Future.value(http.StreamedResponse(
      http.ByteStream.fromBytes(utf8.encode(response.body)),
      response.statusCode,
      contentLength: response.body.length,
    ));
  }
}

void main() {
  group('Models', () {
    test('User.fromJson parses correctly', () {
      final user = User.fromJson({
        'id': '1',
        'name': 'John Doe',
        'email': 'john@example.com',
        'role': 'employee',
        'designation': 'Developer',
        'department': 'Engineering',
      });
      expect(user.id, '1');
      expect(user.name, 'John Doe');
      expect(user.email, 'john@example.com');
      expect(user.role, 'employee');
      expect(user.designation, 'Developer');
      expect(user.department, 'Engineering');
      expect(user.isAdmin, false);
      expect(user.isTeamLead, false);
      expect(user.isEmployee, true);
    });

    test('User.isAdmin returns true for super_admin', () {
      final user = User.fromJson({'id': '2', 'name': 'Admin', 'email': 'admin@x.com', 'role': 'super_admin'});
      expect(user.isAdmin, true);
      expect(user.canManageUsers, true);
      expect(user.canManageSalary, true);
    });

    test('User.fromJson handles missing fields', () {
      final user = User.fromJson({});
      expect(user.id, '');
      expect(user.name, '');
      expect(user.role, 'employee');
      expect(user.isActive, true);
    });

    test('Meeting.fromJson parses correctly', () {
      final m = Meeting.fromJson({
        'id': 'm1',
        'title': 'Team Standup',
        'roomName': 'standup-room',
        'type': 'temporary',
        'createdAt': '2024-01-01',
      });
      expect(m.id, 'm1');
      expect(m.title, 'Team Standup');
      expect(m.isPermanent, false);
    });

    test('Meeting.fromJson detects permanent type', () {
      final m = Meeting.fromJson({
        'id': 'm2',
        'title': 'Office',
        'roomName': 'office',
        'type': 'persistent',
        'createdAt': '2024-01-01',
      });
      expect(m.isPermanent, true);
    });

    test('LeaveRequest.statusLabel returns correct labels', () {
      final approved = LeaveRequest.fromJson({
        'id': '1', 'userId': 'u1', 'leaveType': 'sick',
        'startDate': '2024-01-01', 'endDate': '2024-01-02',
        'reason': 'Sick', 'finalStatus': 'approved', 'createdAt': '2024-01-01',
      });
      expect(approved.statusLabel, 'Approved');

      final pending = LeaveRequest.fromJson({
        'id': '2', 'userId': 'u1', 'leaveType': 'casual',
        'startDate': '2024-01-01', 'endDate': '2024-01-02',
        'reason': 'Casual', 'createdAt': '2024-01-01',
      });
      expect(pending.statusLabel, 'Pending');
      expect(pending.isPending, true);
    });

    test('AttendanceRecord.fromJson parses correctly', () {
      final r = AttendanceRecord.fromJson({
        'id': '1', 'userId': 'u1', 'date': '2024-01-01',
        'firstJoinAt': '2024-01-01T09:00:00Z',
        'lastLeaveAt': '2024-01-01T17:00:00Z',
        'totalWorkMinutes': 480, 'breakMinutes': 60,
        'status': 'present',
      });
      expect(r.status, 'present');
      expect(r.totalWorkMinutes, 480);
      expect(r.date, '2024-01-01');
    });

    test('SalaryRecord.fromJson parses correctly', () {
      final r = SalaryRecord.fromJson({
        'id': '1', 'userId': 'u1', 'employeeName': 'John',
        'month': 1, 'year': 2024,
        'monthlySalary': 5000, 'netSalary': 4500,
      });
      expect(r.employeeName, 'John');
      expect(r.monthlySalary, 5000);
      expect(r.netSalary, 4500);
      expect(r.period, '1/2024');
    });

    test('ChatMessage.fromJson parses correctly', () {
      final m = ChatMessage.fromJson({
        'id': 'msg1', 'user_id': 'u1',
        'user_name': 'John', 'message': 'Hello',
        'created_at': '2024-01-01T10:00:00Z',
      });
      expect(m.id, 'msg1');
      expect(m.userName, 'John');
      expect(m.message, 'Hello');
    });

    test('Department.fromJson parses correctly', () {
      final d = Department.fromJson({
        'id': 'dept1', 'name': 'Engineering',
        'headName': 'Alice', 'memberCount': 10,
      });
      expect(d.name, 'Engineering');
      expect(d.memberCount, 10);
    });

    test('Participant.fromJson parses correctly', () {
      final p = Participant.fromJson({
        'id': 'p1', 'name': 'John', 'isHost': false,
      });
      expect(p.name, 'John');
      expect(p.isHost, false);
    });

    test('BreakoutRoom.fromJson parses correctly', () {
      final r = BreakoutRoom.fromJson({
        'id': 'br1', 'name': 'Room 1',
        'participants': [{'id': 'p1', 'name': 'John'}],
      });
      expect(r.name, 'Room 1');
      expect(r.participants.length, 1);
      expect(r.participants.first.name, 'John');
    });
  });

  group('API Client', () {
    test('ApiException message is accessible', () {
      final e = ApiException(401, 'Unauthorized');
      expect(e.statusCode, 401);
      expect(e.toString(), 'Unauthorized');
    });
  });
}
