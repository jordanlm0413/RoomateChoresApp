import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Local-only API implementation for testing without Node.js.
class ApiService {
  static String? _token;
  static const _usersKey = 'local_mock_users';
  static const _housesKey = 'local_mock_houses';

  static String? get token => _token;

  static void setToken(String? newToken) => _token = newToken;

  static Future<List<Map<String, dynamic>>> _readList(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(key);
    if (value == null) return [];
    return (jsonDecode(value) as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  static Future<void> _writeList(String key, List<Map<String, dynamic>> values) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(values));
  }

  static String _newId() => DateTime.now().microsecondsSinceEpoch.toString();

  static Future<Map<String, dynamic>?> _currentUser() async {
    if (_token == null) return null;
    final users = await _readList(_usersKey);
    for (final user in users) {
      if (user['id'] == _token) return user;
    }
    return null;
  }

  static Future<Map<String, dynamic>> signup(String username, String password) async {
    final users = await _readList(_usersKey);
    if (users.any((user) => user['username'].toString().toLowerCase() == username.toLowerCase())) {
      return {'success': false, 'error': 'Username already exists'};
    }
    if (password.length < 8 || !RegExp(r'[A-Z]').hasMatch(password) ||
        !RegExp(r'[a-z]').hasMatch(password) || !RegExp(r'\d').hasMatch(password)) {
      return {'success': false, 'error': 'Password must be 8+ characters with upper, lower, and number'};
    }
    final user = {'id': _newId(), 'username': username, 'displayName': username, 'password': password};
    users.add(user);
    await _writeList(_usersKey, users);
    _token = user['id'] as String;
    return {'success': true, 'user': {'id': user['id'], 'username': username, 'displayName': username}, 'token': _token};
  }

  static Future<Map<String, dynamic>> login(String username, String password) async {
    final users = await _readList(_usersKey);
    for (final user in users) {
      if (user['username'].toString().toLowerCase() == username.toLowerCase() && user['password'] == password) {
        _token = user['id'] as String;
        return {'success': true, 'user': {'id': user['id'], 'username': user['username'], 'displayName': user['displayName'] ?? user['username']}, 'token': _token};
      }
    }
    return {'success': false, 'error': 'Invalid username or password'};
  }

  static Future<bool> logout() async {
    _token = null;
    return true;
  }

  static Future<Map<String, dynamic>> getProfile() async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    return {'success': true, 'user': {'id': user['id'], 'username': user['username'], 'displayName': user['displayName'] ?? user['username']}};
  }

  static Future<Map<String, dynamic>> updateProfile(String? newUsername, String? newPassword, {String? newDisplayName}) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final users = await _readList(_usersKey);
    if (newUsername != null && users.any((item) => item['id'] != user['id'] && item['username'].toString().toLowerCase() == newUsername.toLowerCase())) {
      return {'success': false, 'error': 'Username already exists'};
    }
    for (final item in users) {
      if (item['id'] == user['id']) {
        if (newUsername != null) item['username'] = newUsername;
        if (newDisplayName != null) item['displayName'] = newDisplayName;
        if (newPassword != null) item['password'] = newPassword;
      }
    }
    final displayName = newDisplayName ?? user['displayName'] ?? user['username'];
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['owner'] == user['id']) house['ownerName'] = displayName;
      for (final member in (house['members'] as List)) {
        if (member['userId'] == user['id']) member['username'] = displayName;
      }
      for (final chore in (house['chores'] as List)) {
        if (chore['assigneeId'] == user['id']) chore['assigneeName'] = displayName;
      }
    }
    await _writeList(_housesKey, houses);
    await _writeList(_usersKey, users);
    return {'success': true, 'user': {'id': user['id'], 'username': newUsername ?? user['username'], 'displayName': displayName}};
  }

  static Future<Map<String, dynamic>> getHouses() async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    return {
      'success': true,
      'houses': houses.where((house) => (house['members'] as List).any((member) => member['userId'] == user['id'])).toList(),
    };
  }

  static Future<Map<String, dynamic>> createHouse(String name) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    final house = {
      'id': _newId(),
      'name': name,
      'owner': user['id'],
      'ownerName': user['displayName'] ?? user['username'],
      'members': [{'userId': user['id'], 'username': user['displayName'] ?? user['username'], 'joinedAt': DateTime.now().toIso8601String()}],
      'chores': [],
      'inviteCode': null,
    };
    houses.add(house);
    await _writeList(_housesKey, houses);
    return {'success': true, 'house': house};
  }

  static Future<Map<String, dynamic>> generateInvite(String houseId) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId && house['owner'] == user['id']) {
        final code = DateTime.now().millisecondsSinceEpoch.toString().substring(7);
        house['inviteCode'] = code;
        await _writeList(_housesKey, houses);
        return {'success': true, 'data': {'inviteCode': code}};
      }
    }
    return {'success': false, 'error': 'House not found or not owner'};
  }

  static Future<Map<String, dynamic>> joinHouse(String inviteCode) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['inviteCode'] == inviteCode) {
        final members = (house['members'] as List).cast<Map<String, dynamic>>();
        if (!members.any((member) => member['userId'] == user['id'])) {
          members.add({'userId': user['id'], 'username': user['displayName'] ?? user['username'], 'joinedAt': DateTime.now().toIso8601String()});
          house['members'] = members;
          await _writeList(_housesKey, houses);
        }
        return {'success': true, 'house': house};
      }
    }
    return {'success': false, 'error': 'Invalid invite code'};
  }

  static Future<Map<String, dynamic>> addChore(String houseId, String title, String assigneeId, String schedule, String reminderTime, bool notificationEnabled, {DateTime? dueDate, String room = 'Other', int repeatInterval = 1, String repeatUnit = 'weeks', bool randomizeAssignee = false, List<String>? randomizeAssigneeIds, List<String>? reminderTimes}) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    final users = await _readList(_usersKey);
    for (final house in houses) {
      if (house['id'] == houseId && (house['members'] as List).any((member) => member['userId'] == user['id'])) {
        final assignee = users.firstWhere((item) => item['id'] == assigneeId, orElse: () => user);
        final chore = {'id': _newId(), 'title': title, 'assigneeId': assigneeId, 'assigneeName': assignee['displayName'] ?? assignee['username'], 'schedule': schedule, 'reminderTime': reminderTime, 'reminderTimes': reminderTimes ?? [reminderTime], 'notificationEnabled': notificationEnabled, 'dueDate': dueDate?.toIso8601String(), 'room': room, 'repeatInterval': repeatInterval, 'repeatUnit': repeatUnit, 'randomizeAssignee': randomizeAssignee, 'randomizeAssigneeIds': randomizeAssigneeIds ?? [], 'isCompleted': false};
        (house['chores'] as List).add(chore);
        await _writeList(_housesKey, houses);
        return {'success': true, 'chore': chore};
      }
    }
    return {'success': false, 'error': 'House not found'};
  }

  static Future<Map<String, dynamic>> toggleChore(String houseId, String choreId, bool isCompleted) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId) {
        for (final chore in (house['chores'] as List)) {
          if (chore['id'] == choreId && (house['owner'] == user['id'] || chore['assigneeId'] == user['id'])) {
            chore['isCompleted'] = isCompleted;
            await _writeList(_housesKey, houses);
            return {'success': true, 'chore': chore};
          }
        }
      }
    }
    return {'success': false, 'error': 'Chore not found or not permitted'};
  }

  static Future<Map<String, dynamic>> updateHouseColor(String houseId, int color) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId && house['owner'] == user['id']) {
        house['accentColor'] = color;
        await _writeList(_housesKey, houses);
        return {'success': true, 'house': house};
      }
    }
    return {'success': false, 'error': 'House not found or not owner'};
  }

  static Future<Map<String, dynamic>> renameHouse(String houseId, String name) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId && house['owner'] == user['id']) {
        house['name'] = name;
        await _writeList(_housesKey, houses);
        return {'success': true, 'house': house};
      }
    }
    return {'success': false, 'error': 'House not found or not owner'};
  }

  static Future<Map<String, dynamic>> deleteChore(String houseId, String choreId) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId) {
        final chores = (house['chores'] as List).cast<Map<String, dynamic>>();
        final chore = chores.cast<Map<String, dynamic>>().firstWhere((item) => item['id'] == choreId, orElse: () => {});
        if (chore.isNotEmpty && (house['owner'] == user['id'] || chore['assigneeId'] == user['id'])) {
          chores.removeWhere((item) => item['id'] == choreId);
          await _writeList(_housesKey, houses);
          return {'success': true};
        }
      }
    }
    return {'success': false, 'error': 'Chore not found or not permitted'};
  }

  static Future<Map<String, dynamic>> removeMember(String houseId, String memberId) async {
    final user = await _currentUser();
    if (user == null) return {'success': false, 'error': 'Unauthorized'};
    final houses = await _readList(_housesKey);
    for (final house in houses) {
      if (house['id'] == houseId && house['owner'] == user['id']) {
        (house['members'] as List).removeWhere((member) => member['userId'] == memberId);
        await _writeList(_housesKey, houses);
        return {'success': true, 'house': house};
      }
    }
    return {'success': false, 'error': 'House not found or not owner'};
  }
}
