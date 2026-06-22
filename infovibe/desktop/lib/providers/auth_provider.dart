import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import '../api/client.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
  User? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;
  bool _mounted = true;

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _currentUser != null;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    _api.onAuthExpired = () {
      _currentUser = null;
      if (_mounted) notifyListeners();
    };
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    await _api.ensureCookiesLoaded();
    await _checkSession();
  }

  Future<void> _checkSession() async {
    _isLoading = true;
    if (_mounted) notifyListeners();
    try {
      final data = await _api.get('/auth/me');
      if (data['user'] != null) {
        _currentUser = User.fromJson(data['user']);
      }
    } catch (e) {
      debugPrint('[Auth] Session check failed: $e');
    }
    _isLoading = false;
    if (_mounted) notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    if (_mounted) notifyListeners();
    try {
      final data = await _api.post('/auth/login', body: {'email': email, 'password': password});
      if (data['user'] != null) {
        _currentUser = User.fromJson(data['user']);
        _isLoading = false;
        if (_mounted) notifyListeners();
        return true;
      }
      _errorMessage = 'Invalid credentials';
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    }
    _isLoading = false;
    if (_mounted) notifyListeners();
    return false;
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (e) {
      debugPrint('[Auth] Logout error: $e');
    }
    await _api.clearCookies();
    _currentUser = null;
    if (_mounted) notifyListeners();
  }

  @override
  void dispose() {
    _mounted = false;
    super.dispose();
  }
}
