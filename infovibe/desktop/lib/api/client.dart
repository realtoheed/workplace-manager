import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._();
  factory ApiClient() => _instance;
  ApiClient._() {
    _loadCookies();
  }

  String baseUrl = 'http://localhost:3000/api';
  final Map<String, String> _cookies = {};
  bool _loaded = false;

  static const String _cookiesPrefKey = 'auth_cookies';

  Future<void> ensureCookiesLoaded() => _loadCookies();

  Future<void> _loadCookies() async {
    if (_loaded) return;
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cookiesPrefKey);
  }

  void setBaseUrl(String url) {
    baseUrl = url.endsWith('/api') ? url : '$url/api';
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final response = await http.get(uri, headers: _headers);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, body['error']?.toString() ?? 'Request failed');
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.post(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    final b = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, b['error']?.toString() ?? 'Request failed');
  }

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.put(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    final b = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, b['error']?.toString() ?? 'Request failed');
  }

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.patch(uri, headers: {..._headers, 'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    final b = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, b['error']?.toString() ?? 'Request failed');
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.delete(uri, headers: _headers);
    _saveCookies(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty ? jsonDecode(response.body) : {};
    }
    final b = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    throw ApiException(response.statusCode, b['error']?.toString() ?? 'Request failed');
  }

  Map<String, String> get _headers {
    final h = <String, String>{'Accept': 'application/json'};
    if (_cookies.isNotEmpty) {
      h['Cookie'] = _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');
    }
    return h;
  }

  void _saveCookies(http.Response response) {
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null) {
      for (final part in setCookie.split(';')) {
        final eq = part.indexOf('=');
        if (eq > 0) {
          _cookies[part.substring(0, eq).trim()] = part.substring(eq + 1).trim();
        }
      }
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
