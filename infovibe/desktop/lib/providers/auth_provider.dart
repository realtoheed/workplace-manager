import 'package:flutter/foundation.dart';
import '../api/client.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  User? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _currentUser != null;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    _init();
  }

  Future<void> _init() async {
    await _api.ensureCookiesLoaded();
    await _checkSession();
  }

  Future<void> _checkSession() async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await _api.get('/auth/me');
      if (data['user'] != null) {
        _currentUser = User.fromJson(data['user']);
      }
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final data = await _api.post('/auth/login', body: {'email': email, 'password': password});
      if (data['user'] != null) {
        _currentUser = User.fromJson(data['user']);
        _isLoading = false;
        notifyListeners();
        return true;
      }
      _errorMessage = 'Invalid credentials';
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {}
    await _api.clearCookies();
    _currentUser = null;
    notifyListeners();
  }
}
