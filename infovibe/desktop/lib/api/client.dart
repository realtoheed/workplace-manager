import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._();
  factory ApiClient() => _instance;
  ApiClient._() {
    _loadCookies();
  }

  static const Duration _timeout = Duration(seconds: 15);

  final http.Client _client = http.Client();

  String baseUrl = 'http://localhost:3000/api';
  final Map<String, String> _cookies = {};
  bool _loaded = false;
  Future<void>? _cookiesLoading;
  Map<String, String>? _cachedHeaders;

  static const String _cookiesPrefKey = 'auth_cookies';
  AuthExpiredCallback? onAuthExpired;

  Future<void> ensureCookiesLoaded() => _loadCookies();

  Future<void> _loadCookies() async {
    if (_loaded) return;
    _cookiesLoading ??= _doLoadCookies();
    await _cookiesLoading;
  }

  Future<void> _doLoadCookies() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_cookiesPrefKey);
    if (saved != null) {
      final decoded = jsonDecode(saved) as Map<String, dynamic>;
      decoded.forEach((k, v) => _cookies[k] = v.toString());
    }
    _loaded = true;
  }

  Future<void> _persistCookies() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cookiesPrefKey, jsonEncode(_cookies));
  }

  Future<void> clearCookies() async {
    _cookies.clear();
    _cachedHeaders = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cookiesPrefKey);
  }

  void setBaseUrl(String url) {
    baseUrl = url.endsWith('/api') ? url : '$url/api';
  }

  void dispose() {
    _client.close();
  }

  Future<Map<String, dynamic>> _request(
    Future<http.Response> Function() requestFn,
  ) async {
    final response = await requestFn().timeout(_timeout);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    if (response.statusCode == 401) {
      await clearCookies();
      onAuthExpired?.call();
    }
    final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, body['error']?.toString() ?? 'Request failed');
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    return _request(() => _client.get(uri, headers: _headers));
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    return _request(() => _client.post(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null));
  }

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    return _request(() => _client.put(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null));
  }

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    return _request(() => _client.patch(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null));
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    return _request(() => _client.delete(uri, headers: _headers));
  }

  Map<String, String> get _headers {
    if (_cachedHeaders != null) return _cachedHeaders!;
    final h = <String, String>{'Accept': 'application/json'};
    if (_cookies.isNotEmpty) {
      h['Cookie'] = _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
    }
    _cachedHeaders = h;
    return h;
  }

  void _saveCookies(http.Response response) {
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null) {
      for (final part in setCookie.split(',')) {
        final semicolonIdx = part.indexOf(';');
        final cookiePart = semicolonIdx > 0 ? part.substring(0, semicolonIdx) : part;
        final eq = cookiePart.indexOf('=');
        if (eq > 0) {
          _cookies[cookiePart.substring(0, eq).trim()] = cookiePart.substring(eq + 1).trim();
        }
      }
      _cachedHeaders = null;
      _persistCookies();
    }
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

typedef AuthExpiredCallback = void Function();
