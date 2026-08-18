import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

ThemeData _buildAppTheme(ColorScheme colorScheme) {
  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    brightness: colorScheme.brightness,
    scaffoldBackgroundColor: colorScheme.surface,
    canvasColor: colorScheme.surface,
    cardColor: colorScheme.surfaceContainer,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      backgroundColor: colorScheme.primary,
      foregroundColor: colorScheme.onPrimary,
      elevation: 0,
      scrolledUnderElevation: 2,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colorScheme.surfaceContainerHighest,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: colorScheme.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      elevation: 2,
      indicatorColor: colorScheme.secondaryContainer,
      labelTextStyle: WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w700, color: colorScheme.onSurface)),
    ),
    cardTheme: CardThemeData(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Roomie Rhythm',
      theme: _buildAppTheme(ColorScheme.fromSeed(seedColor: const Color(0xFF6BAF9D))),
      home: const AuthWrapper(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  User? _currentUser;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');

      if (token != null) {
        ApiService.setToken(token);
        final response = await ApiService.getProfile();

        if (response['success'] == true && response['user'] != null) {
          final userData = response['user'];
          setState(() {
            _currentUser = User(
              id: userData['id'] ?? '',
              username: userData['username'] ?? '',
              displayName: userData['displayName'] ?? userData['username'] ?? '',
            );
            _isLoading = false;
          });
        } else {
          // Token invalid, clear it
          prefs.remove('auth_token');
          ApiService.setToken(null);
          setState(() => _isLoading = false);
        }
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAuth(String username, String password, {required bool isSignUp}) async {
    try {
      final response = isSignUp
          ? await ApiService.signup(username, password)
          : await ApiService.login(username, password);

      if (response['success'] == true && response['user'] != null && response['token'] != null) {
        final userData = response['user'];
        final token = response['token'];

        // Save token to persistent storage
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', token);

        // Set token in API service
        ApiService.setToken(token);

        setState(() {
          _currentUser = User(
            id: userData['id'] ?? '',
            username: userData['username'] ?? '',
            displayName: userData['displayName'] ?? userData['username'] ?? '',
          );
        });

        if (isSignUp && mounted) {
          // Show house setup prompt after signup
          _showHouseSetupDialog();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Authentication failed')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  void _showHouseSetupDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Welcome!'),
        content: const Text('Would you like to create a house or join an existing one?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    try {
      await ApiService.logout();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('auth_token');
      ApiService.setToken(null);

      setState(() => _currentUser = null);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Logout error: $e')),
        );
      }
    }
  }

  Future<void> _handleProfileUpdated(User oldUser, User newUser) async {
    setState(() => _currentUser = newUser);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_currentUser == null) {
      return LoginScreen(
        onSubmit: _handleAuth,
      );
    }

    return ChorePlannerApp(
      user: _currentUser!,
      onLogout: _handleLogout,
      onProfileUpdated: _handleProfileUpdated,
    );
  }
}

class User {
  final String id;
  final String username;
  final String displayName;

  User({required this.id, required this.username, String? displayName})
      : displayName = displayName ?? username;

  Map<String, dynamic> toMap() => {'id': id, 'username': username, 'displayName': displayName};

  factory User.fromMap(Map<String, dynamic> map) {
    return User(
      id: map['id'] ?? '',
      username: map['username'] ?? '',
      displayName: map['displayName'] ?? map['username'] ?? '',
    );
  }
}

class HouseMember {
  final String userId;
  final String username;
  final String? joinedAt;

  HouseMember({
    required this.userId,
    required this.username,
    this.joinedAt,
  });

  Map<String, dynamic> toMap() => {
        'userId': userId,
        'username': username,
        'joinedAt': joinedAt,
      };

  factory HouseMember.fromMap(Map<String, dynamic> map) {
    return HouseMember(
      userId: map['userId'] ?? '',
      username: map['username'] ?? '',
      joinedAt: map['joinedAt'],
    );
  }
}

class ChoreTask {
  final String id;
  final String title;
  final String assigneeId;
  final String assigneeName;
  final String schedule;
  final TimeOfDay reminderTime;
  final List<TimeOfDay> reminderTimes;
  final bool notificationEnabled;
  final DateTime? dueDate;
  final String room;
  final int repeatInterval;
  final String repeatUnit;
  final bool randomizeAssignee;
  final List<String> randomizeAssigneeIds;
  final bool isCompleted;

  ChoreTask({
    required this.id,
    required this.title,
    required this.assigneeId,
    required this.assigneeName,
    required this.schedule,
    required this.reminderTime,
    required this.notificationEnabled,
    List<TimeOfDay>? reminderTimes,
    this.dueDate,
    this.room = 'Other',
    this.repeatInterval = 1,
    this.repeatUnit = 'weeks',
    this.randomizeAssignee = false,
    this.randomizeAssigneeIds = const [],
    this.isCompleted = false,
  }) : reminderTimes = reminderTimes ?? [reminderTime];

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'assigneeId': assigneeId,
        'assigneeName': assigneeName,
        'schedule': schedule,
        'reminderTime': '${reminderTime.hour}:${reminderTime.minute}',
        'reminderTimes': reminderTimes.map((time) => '${time.hour}:${time.minute}').toList(),
        'notificationEnabled': notificationEnabled,
        'dueDate': dueDate?.toIso8601String(),
        'room': room,
        'repeatInterval': repeatInterval,
        'repeatUnit': repeatUnit,
        'randomizeAssignee': randomizeAssignee,
        'randomizeAssigneeIds': randomizeAssigneeIds,
        'isCompleted': isCompleted,
      };

  factory ChoreTask.fromMap(Map<String, dynamic> map) {
    final timeParts = (map['reminderTime'] ?? '18:30').split(':');
    final fallbackTime = TimeOfDay(
      hour: int.tryParse(timeParts[0]) ?? 18,
      minute: int.tryParse(timeParts[1]) ?? 30,
    );
    final reminderTimes = (map['reminderTimes'] as List?)
            ?.map((value) {
              final parts = value.toString().split(':');
              return TimeOfDay(
                hour: int.tryParse(parts[0]) ?? fallbackTime.hour,
                minute: int.tryParse(parts.length > 1 ? parts[1] : '') ?? fallbackTime.minute,
              );
            })
            .toList() ??
        [fallbackTime];
    return ChoreTask(
      id: map['id'] ?? '',
      title: map['title'] ?? '',
      assigneeId: map['assigneeId'] ?? '',
      assigneeName: map['assigneeName'] ?? '',
      schedule: map['schedule'] ?? 'Weekly',
      reminderTime: fallbackTime,
      reminderTimes: reminderTimes,
      notificationEnabled: map['notificationEnabled'] ?? true,
      dueDate: map['dueDate'] == null ? null : DateTime.tryParse(map['dueDate']),
      room: map['room'] ?? map['category'] ?? 'Other',
      repeatInterval: map['repeatInterval'] ?? 1,
      repeatUnit: map['repeatUnit'] ?? 'weeks',
      randomizeAssignee: map['randomizeAssignee'] ?? false,
      randomizeAssigneeIds: (map['randomizeAssigneeIds'] as List?)?.map((id) => id.toString()).toList() ?? const [],
      isCompleted: map['isCompleted'] ?? false,
    );
  }
}

class HouseGroup {
  final String id;
  final String name;
  final String owner;
  final String ownerName;
  final List<HouseMember> members;
  final List<ChoreTask> chores;
  String? inviteCode;
  int accentColor;

  HouseGroup({
    required this.id,
    required this.name,
    required this.owner,
    required this.ownerName,
    required this.members,
    required this.chores,
    this.inviteCode,
    this.accentColor = 0xFF6BAF9D,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'owner': owner,
        'ownerName': ownerName,
        'members': members.map((m) => m.toMap()).toList(),
        'chores': chores.map((c) => c.toMap()).toList(),
        'inviteCode': inviteCode,
        'accentColor': accentColor,
      };

  factory HouseGroup.fromMap(Map<String, dynamic> map) {
    return HouseGroup(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      owner: map['owner'] ?? '',
      ownerName: map['ownerName'] ?? '',
      members: (map['members'] as List?)
              ?.map((m) => HouseMember.fromMap(m as Map<String, dynamic>))
              .toList() ??
          [],
      chores: (map['chores'] as List?)
              ?.map((c) => ChoreTask.fromMap(c as Map<String, dynamic>))
              .toList() ??
          [],
      inviteCode: map['inviteCode'],
      accentColor: map['accentColor'] ?? 0xFF6BAF9D,
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onSubmit,
  });

  final Future<void> Function(String username, String password, {required bool isSignUp})
      onSubmit;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isSignUpMode = false;
  bool _isLoading = false;

  Future<void> _submitAuth() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all fields')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await widget.onSubmit(username, password, isSignUp: _isSignUpMode);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFBFC),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                const Text(
                  'Roomie Rhythm',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1C1B1F),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _isSignUpMode ? 'Create your account' : 'Welcome back',
                  style: const TextStyle(
                    fontSize: 16,
                    color: Color(0xFF697684),
                  ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _usernameController,
                  enabled: !_isLoading,
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(16)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  enabled: !_isLoading,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    helperText: _isSignUpMode ? '8+ chars, 1 upper, 1 lower, 1 number' : '',
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    border: const OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(16)),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isLoading ? null : _submitAuth,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF6BAF9D),
                      disabledBackgroundColor: const Color(0xFFCCC2CB),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : Text(_isSignUpMode ? 'Create account' : 'Log in'),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _isLoading
                        ? null
                        : () => setState(() => _isSignUpMode = !_isSignUpMode),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      _isSignUpMode ? 'I already have an account' : 'Create a new account',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ChorePlannerApp extends StatefulWidget {
  const ChorePlannerApp({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onProfileUpdated,
  });

  final User user;
  final VoidCallback onLogout;
  final Future<void> Function(User oldUser, User newUser) onProfileUpdated;

  @override
  State<ChorePlannerApp> createState() => _ChorePlannerAppState();
}

class _ChorePlannerAppState extends State<ChorePlannerApp> {
  late List<HouseGroup> _houseGroups;
  bool _isLoading = true;
  String? _errorMessage;
  int _selectedNavigationIndex = 0;
  Color _accentColor = const Color(0xFF6BAF9D);
  bool _isDarkMode = false;

  @override
  void initState() {
    super.initState();
    _loadAccentColor();
    _loadDarkMode();
    _loadHouseGroups();
  }

  Future<void> _loadAccentColor() async {
    final prefs = await SharedPreferences.getInstance();
    final savedColor = prefs.getInt('accent_color');
    if (savedColor != null && mounted) {
      setState(() => _accentColor = Color(savedColor));
    }
  }

  Future<void> _setAccentColor(Color color) async {
    setState(() => _accentColor = color);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('accent_color', color.toARGB32());
  }

  Future<void> _loadDarkMode() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _isDarkMode = prefs.getBool('dark_mode') ?? false);
  }

  Future<void> _setDarkMode(bool enabled) async {
    setState(() => _isDarkMode = enabled);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('dark_mode', enabled);
  }

  Future<void> _loadHouseGroups() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await ApiService.getHouses();

      if (response['success'] == true && response['houses'] != null) {
        final houses = (response['houses'] as List)
            .map((h) => HouseGroup.fromMap(h as Map<String, dynamic>))
            .toList();

        setState(() {
          _houseGroups = houses;
          _isLoading = false;
        });
      } else {
        setState(() {
          _houseGroups = [];
          _isLoading = false;
          _errorMessage = response['error'] ?? 'Failed to load houses';
        });
      }
    } catch (e) {
      setState(() {
        _houseGroups = [];
        _isLoading = false;
        _errorMessage = 'Error: $e';
      });
    }
  }

  Future<void> _refreshHouses() async {
    await _loadHouseGroups();
  }

  Future<void> _openHouse(HouseGroup group) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => HouseGroupScreen(
          group: group,
          currentUser: widget.user,
          onUpdate: _refreshHouses,
        ),
      ),
    );
    await _refreshHouses();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: _accentColor,
      brightness: _isDarkMode ? Brightness.dark : Brightness.light,
    );
    return Theme(
      data: _buildAppTheme(colorScheme),
      child: Scaffold(
        backgroundColor: colorScheme.surface,
        appBar: AppBar(
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Flexible(child: Text('Roomie Rhythm', overflow: TextOverflow.ellipsis)),
              if (_houseGroups.isNotEmpty) ...[
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  tooltip: 'Choose house',
                  icon: const Icon(Icons.home_work_outlined),
                  onSelected: (houseId) {
                    final house = _houseGroups.firstWhere((group) => group.id == houseId);
                    _openHouse(house);
                  },
                  itemBuilder: (context) => _houseGroups
                      .map((group) => PopupMenuItem<String>(value: group.id, child: Text(group.name)))
                      .toList(),
                ),
              ],
            ],
          ),
          elevation: 0,
          backgroundColor: _accentColor,
          foregroundColor: colorScheme.onPrimary,
          actions: [
          IconButton(
            tooltip: _isDarkMode ? 'Use light mode' : 'Use dark mode',
            onPressed: () => _setDarkMode(!_isDarkMode),
            icon: Icon(_isDarkMode ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          ),
          PopupMenuButton(
            onSelected: (value) async {
              if (value == 'profile') {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProfileScreen(
                      currentUser: widget.user,
                      onProfileUpdated: widget.onProfileUpdated,
                    ),
                  ),
                );
                await _refreshHouses();
              } else if (value == 'logout') {
                widget.onLogout();
              }
            },
            itemBuilder: (BuildContext context) => [
              const PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    Icon(Icons.person_outline_rounded),
                    SizedBox(width: 10),
                    Text('Profile'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded),
                    SizedBox(width: 10),
                    Text('Log out'),
                  ],
                ),
              ),
            ],
          ),
        ],
        ),
        body: _buildCurrentScreen(),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedNavigationIndex,
          onDestinationSelected: (index) => setState(() => _selectedNavigationIndex = index),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Calendar'),
            NavigationDestination(icon: Icon(Icons.checklist_outlined), selectedIcon: Icon(Icons.checklist), label: 'My chores'),
            NavigationDestination(icon: Icon(Icons.tune_outlined), selectedIcon: Icon(Icons.tune), label: 'Settings'),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentScreen() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_errorMessage!),
            const SizedBox(height: 16),
            FilledButton(onPressed: _refreshHouses, child: const Text('Retry')),
          ],
        ),
      );
    }
    switch (_selectedNavigationIndex) {
      case 1:
        return CalendarScreen(groups: _houseGroups, currentUser: widget.user);
      case 2:
        return MyChoresScreen(
          groups: _houseGroups,
          currentUser: widget.user,
          onUpdated: _refreshHouses,
        );
      case 3:
        return SettingsScreen(
          currentColor: _accentColor,
          onColorChanged: _setAccentColor,
          isDarkMode: _isDarkMode,
          onDarkModeChanged: _setDarkMode,
          onManageHouses: _openHouseManagement,
        );
      default:
        return _houseGroups.isEmpty ? _buildEmptyState() : _buildTabsView();
    }
  }

  Future<void> _openHouseManagement() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => HouseManagementScreen(
          groups: _houseGroups,
          currentUser: widget.user,
          onUpdated: _refreshHouses,
        ),
      ),
    );
    await _refreshHouses();
  }

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Manage Houses',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 24),
            _buildHouseForm(),
          ],
        ),
      ),
    );
  }

  Widget _buildTabsView() {
    return DefaultTabController(
      length: _houseGroups.length + 1,
      child: Column(
        children: [
          Builder(
            builder: (context) => Material(
              color: Theme.of(context).colorScheme.surface,
              child: TabBar(
                tabs: [
                  ...List.generate(
                    _houseGroups.length,
                    (index) => Tab(text: _houseGroups[index].name),
                  ),
                  const Tab(icon: Icon(Icons.add_rounded), text: 'New House'),
                ],
              ),
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                ...List.generate(
                  _houseGroups.length,
                  (index) => HouseGroupScreen(
                    group: _houseGroups[index],
                    currentUser: widget.user,
                    onUpdate: _refreshHouses,
                  ),
                ),
                SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: _buildHouseForm(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHouseForm() {
    return CreateHouseGroupScreen(
      currentUser: widget.user,
      onGroupCreated: (group) {
        _refreshHouses();
      },
    );
  }
}

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key, required this.groups, required this.currentUser});

  final List<HouseGroup> groups;
  final User currentUser;

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late DateTime _weekStart;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _weekStart = DateTime(today.year, today.month, today.day - today.weekday % 7);
  }

  bool _occursOnDate(ChoreTask chore, DateTime date) {
    final anchor = chore.dueDate ?? DateTime.now();
    final anchorDate = DateTime(anchor.year, anchor.month, anchor.day);
    final currentDate = DateTime(date.year, date.month, date.day);
    final dayDifference = currentDate.difference(anchorDate).inDays;
    if (dayDifference < 0) return false;
    switch (chore.schedule) {
      case 'Daily':
        return true;
      case 'No repeat':
        return dayDifference == 0;
      case 'Weekly':
        return date.weekday == anchorDate.weekday;
      case 'Bi-weekly':
        return date.weekday == anchorDate.weekday && dayDifference % 14 == 0;
      case 'Custom':
        final interval = chore.repeatUnit == 'weeks' ? chore.repeatInterval * 7 : chore.repeatInterval;
        return interval > 0 && dayDifference % interval == 0;
      default:
        return dayDifference % 3 == 0;
    }
  }

  String _assigneeForDate(HouseGroup group, ChoreTask chore, DateTime date) {
    if (!chore.randomizeAssignee || group.members.isEmpty) return chore.assigneeName;
    final rotationMembers = chore.randomizeAssigneeIds.isEmpty
        ? group.members
        : group.members.where((member) => chore.randomizeAssigneeIds.contains(member.userId)).toList();
    if (rotationMembers.isEmpty) return chore.assigneeName;
    final weekNumber = date.difference(DateTime(2024, 1, 7)).inDays ~/ 7;
    final member = rotationMembers[weekNumber.abs() % rotationMembers.length];
    return member.username;
  }

  List<Map<String, dynamic>> _choresForDate(DateTime date) {
    final chores = <Map<String, dynamic>>[];
    for (final group in widget.groups) {
      for (final chore in group.chores) {
        if (_occursOnDate(chore, date)) {
          chores.add({'chore': chore, 'house': group.name, 'assignee': _assigneeForDate(group, chore, date)});
        }
      }
    }
    return chores;
  }

  @override
  Widget build(BuildContext context) {
    final weekEnd = _weekStart.add(const Duration(days: 6));
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Calendar', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Sunday through Saturday', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 20),
          Row(
            children: [
              IconButton(
                tooltip: 'Previous week',
                onPressed: () => setState(() => _weekStart = _weekStart.subtract(const Duration(days: 7))),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Center(
                  child: Text(
                    '${_weekStart.month}/${_weekStart.day} - ${weekEnd.month}/${weekEnd.day}/${weekEnd.year}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Next week',
                onPressed: () => setState(() => _weekStart = _weekStart.add(const Duration(days: 7))),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(context: context, initialDate: _weekStart, firstDate: DateTime(2020), lastDate: DateTime(2035));
              if (picked != null && mounted) {
                setState(() => _weekStart = DateTime(picked.year, picked.month, picked.day - picked.weekday % 7));
              }
            },
            icon: const Icon(Icons.event_outlined),
            label: const Text('Jump to week'),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 900;
              final columnWidth = compact ? 142.0 : (constraints.maxWidth - 60) / 7;
              return SingleChildScrollView(
                scrollDirection: compact ? Axis.horizontal : Axis.vertical,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: List.generate(7, (index) {
                final day = _weekStart.add(Duration(days: index));
                final chores = _choresForDate(day);
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return Container(
                  width: columnWidth,
                  margin: const EdgeInsets.only(right: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primaryContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Text(dayNames[index], style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text('${day.month}/${day.day}', style: TextStyle(color: Theme.of(context).colorScheme.onPrimaryContainer)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (chores.isEmpty)
                        Padding(padding: const EdgeInsets.all(8), child: Text('None', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)))
                      else
                        ...chores.map((item) {
                          final chore = item['chore'] as ChoreTask;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(chore.title, style: TextStyle(fontWeight: FontWeight.w700, decoration: chore.isCompleted ? TextDecoration.lineThrough : null)),
                                  const SizedBox(height: 4),
                                  Text(item['assignee'] as String, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                  Text(chore.room, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                                  const SizedBox(height: 4),
                                  Text(chore.reminderTimes.map((time) => time.format(context)).join(', '), style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.primary)),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                );
                  }),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class MyChoresScreen extends StatefulWidget {
  const MyChoresScreen({super.key, required this.groups, required this.currentUser, required this.onUpdated});

  final List<HouseGroup> groups;
  final User currentUser;
  final Future<void> Function() onUpdated;

  @override
  State<MyChoresScreen> createState() => _MyChoresScreenState();
}

class _MyChoresScreenState extends State<MyChoresScreen> {
  bool _isLoading = false;

  Future<void> _toggleChore(String houseId, ChoreTask chore) async {
    setState(() => _isLoading = true);
    final response = await ApiService.toggleChore(houseId, chore.id, !chore.isCompleted);
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (response['success'] == true) {
      await widget.onUpdated();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response['error'] ?? 'Unable to update chore')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final chores = <Map<String, dynamic>>[];
    for (final group in widget.groups) {
      for (final chore in group.chores) {
        if (chore.assigneeId == widget.currentUser.id) chores.add({'chore': chore, 'house': group.name, 'houseId': group.id});
      }
    }
    final completedCount = chores.where((item) => (item['chore'] as ChoreTask).isCompleted).length;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Hi, ${widget.currentUser.displayName}', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Your chores at a glance', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 24),
          if (chores.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    SizedBox(
                      width: 58,
                      height: 58,
                      child: CircularProgressIndicator(
                        value: completedCount / chores.length,
                        strokeWidth: 7,
                        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('$completedCount of ${chores.length} complete', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text('Tap a chore to update it', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: widget.groups.isEmpty ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => CompletionTrackerScreen(groups: widget.groups))),
            icon: const Icon(Icons.insights_outlined),
            label: const Text('View house completion tracker'),
          ),
          const SizedBox(height: 16),
          if (chores.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: Text('You have no assigned chores yet.')))
          else
            ...chores.map((item) {
              final chore = item['chore'] as ChoreTask;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  enabled: !_isLoading,
                  onTap: () => _toggleChore(item['houseId'] as String, chore),
                  leading: Checkbox(
                    value: chore.isCompleted,
                    onChanged: _isLoading ? null : (_) => _toggleChore(item['houseId'] as String, chore),
                  ),
                  title: Text(chore.title, style: TextStyle(fontWeight: FontWeight.w700, decoration: chore.isCompleted ? TextDecoration.lineThrough : null)),
                  subtitle: Text('${item['house']}  |  ${chore.room}  |  ${chore.schedule}'),
                  trailing: Text(chore.reminderTime.format(context)),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class CompletionTrackerScreen extends StatelessWidget {
  const CompletionTrackerScreen({super.key, required this.groups});

  final List<HouseGroup> groups;

  @override
  Widget build(BuildContext context) {
    final chores = <Map<String, dynamic>>[];
    for (final group in groups) {
      for (final chore in group.chores) {
        chores.add({'house': group.name, 'chore': chore});
      }
    }
    final completed = chores.where((item) => (item['chore'] as ChoreTask).isCompleted).length;
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('Completion tracker'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('House progress', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('$completed of ${chores.length} chores completed', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 24),
          if (chores.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Add chores to start tracking progress.')))
          else
            ...chores.map((item) {
              final chore = item['chore'] as ChoreTask;
              final isComplete = chore.isCompleted;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isComplete ? Colors.green.shade100 : Colors.orange.shade100,
                    child: Icon(isComplete ? Icons.check : Icons.schedule, color: isComplete ? Colors.green.shade800 : Colors.orange.shade800),
                  ),
                  title: Text(chore.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${chore.assigneeName}  |  ${item['house']}  |  ${chore.room}'),
                  trailing: Text(isComplete ? 'Done' : 'Open', style: TextStyle(fontWeight: FontWeight.w700, color: isComplete ? Colors.green.shade700 : Colors.orange.shade700)),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class HouseManagementScreen extends StatefulWidget {
  const HouseManagementScreen({super.key, required this.groups, required this.currentUser, required this.onUpdated});

  final List<HouseGroup> groups;
  final User currentUser;
  final VoidCallback onUpdated;

  @override
  State<HouseManagementScreen> createState() => _HouseManagementScreenState();
}

class _HouseManagementScreenState extends State<HouseManagementScreen> {
  late List<HouseGroup> _groups;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _groups = List.of(widget.groups);
  }

  void _replaceHouse(Map<String, dynamic> data) {
    final updated = HouseGroup.fromMap(data);
    setState(() {
      final index = _groups.indexWhere((group) => group.id == updated.id);
      if (index >= 0) _groups[index] = updated;
    });
    widget.onUpdated();
  }

  Future<void> _renameHouse(HouseGroup group) async {
    final controller = TextEditingController(text: group.name);
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Rename house'),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'House name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty) return;
    setState(() => _isLoading = true);
    final response = await ApiService.renameHouse(group.id, name);
    if (mounted) {
      setState(() => _isLoading = false);
      if (response['success'] == true) {
        _replaceHouse(response['house'] as Map<String, dynamic>);
      } else {
        _showError(response['error']);
      }
    }
  }

  Future<void> _removeMember(HouseGroup group, HouseMember member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove member?'),
        content: Text('Remove ${member.username} from ${group.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _isLoading = true);
    final response = await ApiService.removeMember(group.id, member.userId);
    if (mounted) {
      setState(() => _isLoading = false);
      if (response['success'] == true) {
        _replaceHouse(response['house'] as Map<String, dynamic>);
      } else {
        _showError(response['error']);
      }
    }
  }

  Future<void> _changeColor(HouseGroup group) async {
    const colors = [0xFF6BAF9D, 0xFF5B7CFA, 0xFFD97941, 0xFFB05A87, 0xFF4F8A8B];
    final color = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('House accent'),
        content: Wrap(spacing: 12, children: colors.map((value) => InkWell(onTap: () => Navigator.pop(dialogContext, value), child: CircleAvatar(backgroundColor: Color(value), radius: 22))).toList()),
      ),
    );
    if (color == null) return;
    setState(() => _isLoading = true);
    final response = await ApiService.updateHouseColor(group.id, color);
    if (mounted) {
      setState(() => _isLoading = false);
      if (response['success'] == true) {
        _replaceHouse(response['house'] as Map<String, dynamic>);
      } else {
        _showError(response['error']);
      }
    }
  }

  Future<void> _invite(HouseGroup group) async {
    setState(() => _isLoading = true);
    final response = await ApiService.generateInvite(group.id);
    if (mounted) setState(() => _isLoading = false);
    if (!mounted) return;
    if (response['success'] == true) {
      showDialog(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Invite code'),
          content: SelectableText(response['data']['inviteCode'].toString()),
          actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Done'))],
        ),
      );
    } else {
      _showError(response['error']);
    }
  }

  void _showError(Object? error) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error?.toString() ?? 'Something went wrong')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        title: const Text('House management'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
      ),
      body: _groups.isEmpty
          ? const Center(child: Text('You are not in a house yet.'))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _groups.length,
              itemBuilder: (context, index) {
                final group = _groups[index];
                final isOwner = group.owner == widget.currentUser.id;
                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(backgroundColor: Color(group.accentColor), child: const Icon(Icons.home, color: Colors.white)),
                            const SizedBox(width: 12),
                            Expanded(child: Text(group.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
                            if (isOwner) IconButton(tooltip: 'Rename house', icon: const Icon(Icons.edit_outlined), onPressed: _isLoading ? null : () => _renameHouse(group)),
                            if (isOwner) IconButton(tooltip: 'House color', icon: const Icon(Icons.palette_outlined), onPressed: _isLoading ? null : () => _changeColor(group)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text('${group.members.length} member${group.members.length == 1 ? '' : 's'}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                        const Divider(height: 24),
                        ...group.members.map((member) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.person_outline),
                              title: Text(member.username),
                              subtitle: member.userId == group.owner ? const Text('Owner') : null,
                              trailing: isOwner && member.userId != group.owner
                                  ? IconButton(tooltip: 'Remove member', icon: const Icon(Icons.person_remove_outlined), onPressed: _isLoading ? null : () => _removeMember(group, member))
                                  : null,
                            )),
                        if (isOwner)
                          Align(
                            alignment: Alignment.centerRight,
                            child: OutlinedButton.icon(onPressed: _isLoading ? null : () => _invite(group), icon: const Icon(Icons.person_add_outlined), label: const Text('Create invite')),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.currentColor, required this.onColorChanged, required this.isDarkMode, required this.onDarkModeChanged, required this.onManageHouses});

  final Color currentColor;
  final ValueChanged<Color> onColorChanged;
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  final VoidCallback onManageHouses;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _remindersEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadReminderPreference();
  }

  Future<void> _loadReminderPreference() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _remindersEnabled = prefs.getBool('reminders_enabled') ?? true);
  }

  Future<void> _setReminderPreference(bool enabled) async {
    setState(() => _remindersEnabled = enabled);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('reminders_enabled', enabled);
  }

  @override
  Widget build(BuildContext context) {
    const colors = [Color(0xFF6BAF9D), Color(0xFF5B7CFA), Color(0xFFD97941), Color(0xFFB05A87)];
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Customize', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Make Roomie Rhythm feel like your home', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 28),
          Card(
            child: SwitchListTile(
              secondary: const Icon(Icons.dark_mode_outlined),
              title: const Text('Dark mode'),
              subtitle: const Text('Use a darker palette at night'),
              value: widget.isDarkMode,
              onChanged: widget.onDarkModeChanged,
            ),
          ),
          const SizedBox(height: 20),
          const Text('Accent color', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            children: colors.map((color) {
              final selected = widget.currentColor.toARGB32() == color.toARGB32();
              return InkWell(
                onTap: () => widget.onColorChanged(color),
                borderRadius: BorderRadius.circular(30),
                child: CircleAvatar(
                  radius: 25,
                  backgroundColor: color,
                  child: selected ? const Icon(Icons.check, color: Colors.white) : null,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          Card(
            child: ListTile(
              leading: const Icon(Icons.notifications_active_outlined),
              title: const Text('Chore reminders'),
              subtitle: const Text('Use reminders by default for new chores'),
              trailing: Switch(value: _remindersEnabled, onChanged: _setReminderPreference),
            ),
          ),
          Card(
            child: ListTile(
              onTap: widget.onManageHouses,
              leading: const Icon(Icons.home_work_outlined),
              title: const Text('House management'),
              subtitle: const Text('Invite members and manage assignments from Home'),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.currentUser,
    required this.onProfileUpdated,
  });

  final User currentUser;
  final Future<void> Function(User oldUser, User newUser) onProfileUpdated;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late User _displayedUser;

  @override
  void initState() {
    super.initState();
    _displayedUser = widget.currentUser;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Account', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 8),
                    Text(
                      _displayedUser.displayName,
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '@${_displayedUser.username}',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    final updatedUser = await Navigator.push<User>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditProfileScreen(
                          currentUser: _displayedUser,
                          onProfileUpdated: widget.onProfileUpdated,
                        ),
                      ),
                    );
                    if (updatedUser != null && mounted) {
                      setState(() => _displayedUser = updatedUser);
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Edit profile'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({
    super.key,
    required this.currentUser,
    required this.onProfileUpdated,
  });

  final User currentUser;
  final Future<void> Function(User oldUser, User newUser) onProfileUpdated;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _usernameController;
  late final TextEditingController _displayNameController;
  late final TextEditingController _passwordController;
  late final TextEditingController _confirmPasswordController;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _usernameController = TextEditingController(text: widget.currentUser.username);
    _displayNameController = TextEditingController(text: widget.currentUser.displayName);
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _displayNameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _saveChanges() async {
    final newUsername = _usernameController.text.trim();
    final newDisplayName = _displayNameController.text.trim();
    final newPassword = _passwordController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();

    if (newUsername.isEmpty || newDisplayName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Username and display name cannot be empty.')),
      );
      return;
    }

    if (newPassword.isNotEmpty) {
      if (newPassword != confirmPassword) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Passwords do not match.')),
        );
        return;
      }
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiService.updateProfile(
        newUsername,
        newPassword.isNotEmpty ? newPassword : null,
        newDisplayName: newDisplayName,
      );

      if (response['success'] == true && response['user'] != null) {
        final userData = response['user'];
        final updatedUser = User(
          id: userData['id'] ?? widget.currentUser.id,
          username: userData['username'] ?? newUsername,
          displayName: userData['displayName'] ?? newDisplayName,
        );

        await widget.onProfileUpdated(widget.currentUser, updatedUser);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile updated successfully')),
          );
          Navigator.pop(context, updatedUser);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to update profile')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit profile'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: SingleChildScrollView(
            child: Column(
              children: [
                TextField(
                  controller: _usernameController,
                  enabled: !_isLoading,
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _displayNameController,
                  enabled: !_isLoading,
                  decoration: const InputDecoration(
                    labelText: 'Display name',
                    helperText: 'This is the name roommates see',
                    border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  enabled: !_isLoading,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'New Password (leave empty to keep current)',
                    helperText: '8+ chars, 1 upper, 1 lower, 1 number',
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _confirmPasswordController,
                  enabled: !_isLoading,
                  obscureText: _obscureConfirmPassword,
                  decoration: InputDecoration(
                    labelText: 'Confirm password',
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirmPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                    ),
                    border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isLoading ? null : _saveChanges,
                    style: FilledButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      disabledBackgroundColor: const Color(0xFFCCC2CB),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : const Text('Save changes'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class HouseGroupScreen extends StatefulWidget {
  const HouseGroupScreen({
    super.key,
    required this.group,
    required this.currentUser,
    required this.onUpdate,
  });

  final HouseGroup group;
  final User currentUser;
  final VoidCallback onUpdate;

  @override
  State<HouseGroupScreen> createState() => _HouseGroupScreenState();
}

class _HouseGroupScreenState extends State<HouseGroupScreen> {
  late TextEditingController _choreNameController;
  String _selectedSchedule = 'Weekly';
  TimeOfDay _reminderTime = const TimeOfDay(hour: 18, minute: 30);
  List<TimeOfDay> _reminderTimes = const [TimeOfDay(hour: 18, minute: 30)];
  bool _notificationsEnabled = true;
  String? _selectedAssigneeId;
  String _selectedRoom = 'Other';
  int _repeatInterval = 1;
  String _repeatUnit = 'weeks';
  bool _randomizeAssignee = false;
  List<String> _randomizeAssigneeIds = [];
  DateTime? _dueDate;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _choreNameController = TextEditingController();
    _loadReminderPreference();
    if (widget.group.members.isNotEmpty) {
      _selectedAssigneeId = widget.group.members.first.userId;
    }
  }

  Future<void> _loadReminderPreference() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() => _notificationsEnabled = prefs.getBool('reminders_enabled') ?? true);
  }

  @override
  void dispose() {
    _choreNameController.dispose();
    super.dispose();
  }

  bool _isOwner() {
    return widget.currentUser.id == widget.group.owner;
  }

  bool _canDeleteChore(ChoreTask chore) {
    return _isOwner() || chore.assigneeId == widget.currentUser.id;
  }

  Future<void> _addChore(String title) async {
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a chore name')),
      );
      return;
    }

    if (_selectedAssigneeId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select an assignee')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiService.addChore(
        widget.group.id,
        title,
        _selectedAssigneeId!,
        _selectedSchedule,
        '${_reminderTime.hour}:${_reminderTime.minute}',
        _notificationsEnabled,
        dueDate: _dueDate,
        room: _selectedRoom,
        repeatInterval: _repeatInterval,
        repeatUnit: _repeatUnit,
        randomizeAssignee: _randomizeAssignee,
        randomizeAssigneeIds: _randomizeAssigneeIds,
        reminderTimes: _reminderTimes.map((time) => '${time.hour}:${time.minute}').toList(),
      );

      if (response['success'] == true) {
        _choreNameController.clear();
        widget.onUpdate();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Chore added successfully')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to add chore')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleChore(ChoreTask chore) async {
    setState(() => _isLoading = true);
    final response = await ApiService.toggleChore(widget.group.id, chore.id, !chore.isCompleted);
    if (response['success'] == true) {
      widget.onUpdate();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(response['error'] ?? 'Unable to update chore')));
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _pickHouseColor() async {
    const colors = [0xFF6BAF9D, 0xFF5B7CFA, 0xFFD97941, 0xFFB05A87, 0xFF4F8A8B];
    final selected = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('House accent'),
        content: Wrap(
          spacing: 12,
          children: colors.map((color) => InkWell(
            onTap: () => Navigator.pop(dialogContext, color),
            child: CircleAvatar(backgroundColor: Color(color), radius: 22),
          )).toList(),
        ),
      ),
    );
    if (selected == null || !mounted) return;
    final response = await ApiService.updateHouseColor(widget.group.id, selected);
    if (!mounted) return;
    if (response['success'] == true) {
      widget.onUpdate();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(response['error'] ?? 'Unable to update house color')));
    }
  }

  Future<void> _deleteChore(ChoreTask chore) async {
    setState(() => _isLoading = true);

    try {
      final response = await ApiService.deleteChore(widget.group.id, chore.id);

      if (response['success'] == true) {
        widget.onUpdate();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to delete chore')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _removeMember(HouseMember member) async {
    if (member.userId == widget.group.owner) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot remove the house owner')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiService.removeMember(widget.group.id, member.userId);

      if (response['success'] == true) {
        widget.onUpdate();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to remove member')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _generateInvite() async {
    setState(() => _isLoading = true);

    try {
      final response = await ApiService.generateInvite(widget.group.id);

      if (response['success'] == true && response['data'] != null) {
        final inviteCode = response['data']['inviteCode'];
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Share invite code'),
              content: Text('Invite code: $inviteCode'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Done'),
                ),
              ],
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to generate invite')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _addReminder() async {
    final picked = await showTimePicker(context: context, initialTime: _reminderTime);
    if (picked == null || !mounted) return;
    setState(() {
      _reminderTimes = [..._reminderTimes, picked];
      _reminderTime = _reminderTimes.first;
    });
  }

  Future<void> _chooseRandomAssignees() async {
    final selected = Set<String>.from(_randomizeAssigneeIds.isEmpty ? widget.group.members.map((member) => member.userId) : _randomizeAssigneeIds);
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Choose rotation members'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: widget.group.members.map((member) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(member.username),
                    value: selected.contains(member.userId),
                    onChanged: (value) {
                      setDialogState(() {
                        if (value == true) {
                          selected.add(member.userId);
                        } else {
                          selected.remove(member.userId);
                        }
                      });
                    },
                  )).toList(),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, selected), child: const Text('Use selected')),
          ],
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() => _randomizeAssigneeIds = result.toList());
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // House info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.group.name,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                            ),
                            Text(
                              'Owner: ${widget.group.ownerName}',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_isOwner())
                        Row(
                          children: [
                            IconButton(
                              tooltip: 'House color',
                              icon: Icon(Icons.palette_outlined, color: Color(widget.group.accentColor)),
                              onPressed: _isLoading ? null : _pickHouseColor,
                            ),
                            IconButton(
                              tooltip: 'Invite member',
                              icon: const Icon(Icons.person_add_rounded),
                              onPressed: _isLoading ? null : _generateInvite,
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Members section
            const Text(
              'Members',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            ...widget.group.members.map(
              (member) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_rounded),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            member.username,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          if (member.userId == widget.group.owner)
                            Text(
                              'Owner',
                              style: TextStyle(
                                fontSize: 12,
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (_isOwner() && member.userId != widget.group.owner)
                      IconButton(
                        icon: const Icon(Icons.delete_rounded),
                        onPressed: _isLoading ? null : () => _removeMember(member),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Add chore section
            const Text(
              'Add Chore',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _choreNameController,
                    enabled: !_isLoading,
                    decoration: const InputDecoration(
                      labelText: 'Chore title',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedRoom,
                    decoration: const InputDecoration(
                      labelText: 'Room',
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Kitchen', child: Text('Kitchen')),
                      DropdownMenuItem(value: 'Bathroom', child: Text('Bathroom')),
                      DropdownMenuItem(value: 'Bedroom', child: Text('Bedroom')),
                      DropdownMenuItem(value: 'Living room', child: Text('Living room')),
                      DropdownMenuItem(value: 'Outside', child: Text('Outside')),
                      DropdownMenuItem(value: 'Other', child: Text('Other')),
                    ],
                    onChanged: _isLoading ? null : (value) => setState(() => _selectedRoom = value ?? 'Other'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedSchedule,
                    decoration: const InputDecoration(
                      labelText: 'Repeat',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(12)),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Daily', child: Text('Daily')),
                      DropdownMenuItem(value: 'Weekly', child: Text('Weekly')),
                      DropdownMenuItem(value: 'Bi-weekly', child: Text('Every 2 weeks')),
                      DropdownMenuItem(value: 'Custom', child: Text('Custom interval')),
                      DropdownMenuItem(value: 'No repeat', child: Text('No repeat')),
                    ],
                    onChanged: _isLoading
                        ? null
                        : (value) {
                            if (value != null) {
                                setState(() {
                                  _selectedSchedule = value;
                                  if (value == 'Daily') {
                                    _repeatInterval = 1;
                                    _repeatUnit = 'days';
                                  } else if (value == 'Weekly') {
                                    _repeatInterval = 1;
                                    _repeatUnit = 'weeks';
                                  } else if (value == 'Bi-weekly') {
                                    _repeatInterval = 2;
                                    _repeatUnit = 'weeks';
                                  }
                                });
                            }
                          },
                  ),
                  Material(
                    color: Colors.transparent,
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      childrenPadding: const EdgeInsets.only(bottom: 8),
                      title: const Text('Schedule & reminders', style: TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        _dueDate == null ? 'Optional details' : 'Due ${_dueDate!.month}/${_dueDate!.day}',
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                      children: [
                  if (_selectedSchedule == 'Custom')
                    Row(
                      children: [
                        const Text('Repeat every'),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 70,
                          child: TextFormField(
                            initialValue: '$_repeatInterval',
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(isDense: true),
                            onChanged: (value) => _repeatInterval = int.tryParse(value) ?? 1,
                          ),
                        ),
                        const SizedBox(width: 8),
                        DropdownButton<String>(
                          value: _repeatUnit,
                          items: const [
                            DropdownMenuItem(value: 'days', child: Text('days')),
                            DropdownMenuItem(value: 'weeks', child: Text('weeks')),
                          ],
                          onChanged: (value) => setState(() => _repeatUnit = value ?? 'weeks'),
                        ),
                      ],
                    ),
                  if (_selectedSchedule == 'Custom') const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.event_outlined),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_dueDate == null ? 'No due date' : 'Due ${_dueDate!.month}/${_dueDate!.day}/${_dueDate!.year}')),
                      TextButton(
                        onPressed: _isLoading
                            ? null
                            : () async {
                                final picked = await showDatePicker(
                                  context: context,
                                  initialDate: _dueDate ?? DateTime.now(),
                                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                                  lastDate: DateTime.now().add(const Duration(days: 730)),
                                );
                                if (picked != null) setState(() => _dueDate = picked);
                              },
                        child: const Text('Set date'),
                      ),
                      ],
                    ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedAssigneeId,
                    decoration: const InputDecoration(
                      labelText: 'Assign to',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(12)),
                      ),
                    ),
                    items: widget.group.members
                        .map(
                          (member) => DropdownMenuItem(
                            value: member.userId,
                            child: Text(member.username),
                          ),
                        )
                        .toList(),
                    onChanged: _isLoading
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _selectedAssigneeId = value);
                            }
                          },
                  ),
                  const SizedBox(height: 12),
                  Material(
                    color: Colors.transparent,
                    child: SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Randomize assignee'),
                      subtitle: const Text('Rotate the person responsible each repeat'),
                      value: _randomizeAssignee,
                      onChanged: _isLoading ? null : (value) => setState(() => _randomizeAssignee = value),
                    ),
                  ),
                  if (_randomizeAssignee)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: _isLoading ? null : _chooseRandomAssignees,
                        icon: const Icon(Icons.group_outlined),
                        label: Text(_randomizeAssigneeIds.isEmpty ? 'Choose everyone' : '${_randomizeAssigneeIds.length} people in rotation'),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('Reminders'),
                      const Spacer(),
                      IconButton(
                        tooltip: 'Add reminder',
                        onPressed: _isLoading ? null : _addReminder,
                        icon: const Icon(Icons.add_alarm_outlined),
                      ),
                    ],
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Wrap(
                      spacing: 8,
                      children: _reminderTimes.asMap().entries.map((entry) => InputChip(
                            label: Text(entry.value.format(context)),
                            onDeleted: _reminderTimes.length == 1 ? null : () => setState(() => _reminderTimes = [..._reminderTimes]..removeAt(entry.key)),
                          )).toList(),
                    ),
                  ),
                  Row(
                    children: [
                      const Text('Notifications'),
                      const Spacer(),
                      Switch(
                        value: _notificationsEnabled,
                        onChanged: _isLoading
                            ? null
                            : (value) => setState(() => _notificationsEnabled = value),
                      ),
                    ],
                  ),
                    ],
                  ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _isLoading ? null : () => _addChore(_choreNameController.text.trim()),
                      style: FilledButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        disabledBackgroundColor: const Color(0xFFCCC2CB),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(Colors.white),
                              ),
                            )
                          : const Text('Add chore'),
                    ),
                        ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Chores list
            const Text(
              'Chores',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            if (widget.group.chores.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('No chores yet. Add one above.'),
              )
            else
              ...widget.group.chores.map(
                (chore) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Checkbox(
                        value: chore.isCompleted,
                        onChanged: _isLoading ? null : (_) => _toggleChore(chore),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              chore.title,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                decoration: chore.isCompleted ? TextDecoration.lineThrough : null,
                              ),
                            ),
                            Text(
                              '${chore.room} • ${chore.assigneeName} • ${chore.schedule} • ${chore.reminderTimes.map((time) => time.format(context)).join(', ')}${chore.dueDate == null ? '' : ' • due ${chore.dueDate!.month}/${chore.dueDate!.day}'}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_canDeleteChore(chore))
                        IconButton(
                          icon: const Icon(Icons.delete_rounded),
                          onPressed: _isLoading ? null : () => _deleteChore(chore),
                        ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

class CreateHouseGroupScreen extends StatefulWidget {
  const CreateHouseGroupScreen({
    super.key,
    required this.currentUser,
    required this.onGroupCreated,
  });

  final User currentUser;
  final Function(HouseGroup) onGroupCreated;

  @override
  State<CreateHouseGroupScreen> createState() => _CreateHouseGroupScreenState();
}

class _CreateHouseGroupScreenState extends State<CreateHouseGroupScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _inviteCodeController = TextEditingController();
  int _mode = 0; // 0 = create, 1 = join
  bool _isLoading = false;

  Future<void> _createHouseGroup() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a house name')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiService.createHouse(name);

      if (response['success'] == true && response['house'] != null) {
        _nameController.clear();
        widget.onGroupCreated(HouseGroup.fromMap(response['house'] as Map<String, dynamic>));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('House created successfully!')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to create house')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _joinHouseGroup() async {
    final code = _inviteCodeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an invite code')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await ApiService.joinHouse(code);

      if (response['success'] == true && response['house'] != null) {
        _inviteCodeController.clear();
        widget.onGroupCreated(HouseGroup.fromMap(response['house'] as Map<String, dynamic>));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Joined house successfully!')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error'] ?? 'Failed to join house')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Manage Houses',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 24),
            // Tabs
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _isLoading ? null : () => setState(() => _mode = 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: _mode == 0 ? Theme.of(context).colorScheme.primary : Colors.transparent,
                            width: 3,
                          ),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          'Create House',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: _mode == 0 ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: _isLoading ? null : () => setState(() => _mode = 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: _mode == 1 ? Theme.of(context).colorScheme.primary : Colors.transparent,
                            width: 3,
                          ),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          'Join House',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: _mode == 1 ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (_mode == 0)
              Column(
                children: [
                  TextField(
                    controller: _nameController,
                    enabled: !_isLoading,
                    decoration: const InputDecoration(
                      labelText: 'House name',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _isLoading ? null : _createHouseGroup,
                      style: FilledButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        disabledBackgroundColor: const Color(0xFFCCC2CB),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(Colors.white),
                              ),
                            )
                          : const Text('Create house'),
                    ),
                  ),
                ],
              )
            else
              Column(
                children: [
                  TextField(
                    controller: _inviteCodeController,
                    enabled: !_isLoading,
                    decoration: const InputDecoration(
                      labelText: 'Invite code',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _isLoading ? null : _joinHouseGroup,
                      style: FilledButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        disabledBackgroundColor: const Color(0xFFCCC2CB),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(Colors.white),
                              ),
                            )
                          : const Text('Join house'),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
