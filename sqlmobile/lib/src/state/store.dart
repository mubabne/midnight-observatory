// Saves progress with shared_preferences, in the same shape as the web
// game's localStorage record (minus the database snapshot, which lives in a
// file). Every field is validated when it loads.
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const historyLimit = 50;

class HistoryEntry {
  HistoryEntry({required this.sql, required this.ranAt, required this.status, this.summary = ''});
  final String sql;
  final String ranAt;

  /// 'ok', 'error' or 'timeout'.
  final String status;
  final String summary;

  Map<String, Object?> toJson() => {'sql': sql, 'ranAt': ranAt, 'status': status, 'summary': summary};

  static HistoryEntry? fromJson(Object? raw) {
    if (raw is! Map || raw['sql'] is! String || raw['ranAt'] is! String) return null;
    final status = raw['status'];
    return HistoryEntry(
      sql: raw['sql'] as String,
      ranAt: raw['ranAt'] as String,
      status: status == 'error' || status == 'timeout' ? status as String : 'ok',
      summary: raw['summary'] is String ? raw['summary'] as String : '',
    );
  }
}

class LevelProgress {
  LevelProgress({this.draft = ''});

  String draft;
  List<HistoryEntry> history = [];
  String notes = '';
  int hintsRevealed = 0;
  bool bonusRevealed = false;
  bool solved = false;
  List<String> guesses = [];
  List<String> lessonsDone = [];
  String? lesson;

  bool get started => history.isNotEmpty || notes.isNotEmpty || lessonsDone.isNotEmpty || solved;

  Map<String, Object?> toJson() => {
        'draft': draft,
        'history': history.map((h) => h.toJson()).toList(),
        'notes': notes,
        'hintsRevealed': hintsRevealed,
        'bonusRevealed': bonusRevealed,
        'solved': solved,
        'guesses': guesses,
        'lessonsDone': lessonsDone,
        'lesson': lesson,
      };

  static LevelProgress fromJson(Object? raw, String startingQuery) {
    final p = LevelProgress(draft: startingQuery);
    if (raw is! Map) return p;
    if (raw['draft'] is String) p.draft = raw['draft'] as String;
    if (raw['notes'] is String) p.notes = raw['notes'] as String;
    final h = raw['hintsRevealed'];
    if (h is int && h >= 0) p.hintsRevealed = h.clamp(0, 10);
    p.bonusRevealed = raw['bonusRevealed'] == true;
    p.solved = raw['solved'] == true;
    if (raw['history'] is List) {
      p.history = (raw['history'] as List).map(HistoryEntry.fromJson).whereType<HistoryEntry>().take(historyLimit).toList();
    }
    if (raw['guesses'] is List) p.guesses = (raw['guesses'] as List).whereType<String>().take(20).toList();
    if (raw['lessonsDone'] is List) p.lessonsDone = (raw['lessonsDone'] as List).whereType<String>().toSet().toList();
    if (raw['lesson'] is String) p.lesson = raw['lesson'] as String;
    return p;
  }
}

class Store {
  Store._(this._prefs, this.lang, this.level, this._raw, this.warning);

  static const key = 'sql-detective/v1';

  final SharedPreferences? _prefs;
  String lang;
  String? level;
  final Map<String, Object?> _raw; // levelId -> saved json
  final Map<String, LevelProgress> _levels = {};

  /// Set when saved data could not be read: 'damaged' or 'blocked'.
  final String? warning;

  static Future<Store> load({required String defaultLang}) async {
    SharedPreferences? prefs;
    try {
      prefs = await SharedPreferences.getInstance();
    } catch (_) {
      return Store._(null, defaultLang, null, {}, 'blocked');
    }
    final text = prefs.getString(key);
    if (text == null) return Store._(prefs, defaultLang, null, {}, null);
    try {
      final data = jsonDecode(text) as Map<String, dynamic>;
      final lang = data['lang'] == 'mn' ? 'mn' : (data['lang'] == 'en' ? 'en' : defaultLang);
      final level = data['level'] is String ? data['level'] as String : null;
      final levels = data['levels'] is Map ? Map<String, Object?>.from(data['levels'] as Map) : <String, Object?>{};
      return Store._(prefs, lang, level, levels, null);
    } catch (_) {
      return Store._(prefs, defaultLang, null, {}, 'damaged');
    }
  }

  LevelProgress progress(String levelId, String startingQuery) =>
      _levels.putIfAbsent(levelId, () => LevelProgress.fromJson(_raw[levelId], startingQuery));

  /// Clears one level in place, so screens holding its progress see the change.
  void resetLevel(String levelId, String startingQuery) {
    progress(levelId, startingQuery)
      ..draft = startingQuery
      ..history = []
      ..notes = ''
      ..hintsRevealed = 0
      ..bonusRevealed = false
      ..solved = false
      ..guesses = []
      ..lessonsDone = []
      ..lesson = null;
    save();
  }

  Future<void> save() async {
    final prefs = _prefs;
    if (prefs == null) return;
    final levels = <String, Object?>{..._raw};
    _levels.forEach((id, p) => levels[id] = p.toJson());
    try {
      await prefs.setString(key, jsonEncode({'version': 2, 'lang': lang, 'level': level, 'levels': levels}));
    } catch (_) {
      // storage full or unavailable: keep playing in memory
    }
  }
}
