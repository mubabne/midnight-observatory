// The level ladder, read from assets/levels.json (exported from the web
// game's src/levels by tool/dump-levels.mjs, so both versions share the text).
import 'dart:convert';

class LevelDef {
  LevelDef(this.json);

  final Map<String, dynamic> json;

  String get id => json['id'] as String;
  int get number => json['number'] as int;
  bool get isLessons => json['kind'] == 'lessons';
  bool get writable => json['writable'] == true;
  Map<String, dynamic> get database => Map<String, dynamic>.from(json['database'] as Map);
  String? get personLookup => json['personLookup'] as String?;

  bool hasLanguage(String lang) => (json['content'] as Map).containsKey(lang);

  /// The level's text in a language, falling back to English.
  LevelText content(String lang) {
    final all = json['content'] as Map;
    return LevelText(Map<String, dynamic>.from((all[lang] ?? all['en']) as Map));
  }

  Ending? ending(String lang) {
    final all = json['endings'] as Map?;
    if (all == null || all.isEmpty) return null;
    return Ending(Map<String, dynamic>.from((all[lang] ?? all['en']) as Map));
  }

  /// The language whose database this level uses (only some levels have
  /// translated data).
  String dbLang(String lang) {
    final overlays = database['overlays'] as Map?;
    return (overlays != null && overlays.containsKey(lang)) ? lang : 'en';
  }

  /// Every SQL asset (relative to assets/levels/) needed to build the level in [lang].
  List<String> scriptsFor(String lang) {
    final db = database;
    final overlays = (db['overlays'] as Map?)?[dbLang(lang)] as List? ?? const [];
    return [
      db['seed'] as String,
      ...overlays.cast<String>(),
      ...((db['extra'] as List?) ?? const []).cast<String>(),
    ].map((f) => '$id/$f').toList();
  }

  List<String> get allScripts {
    final db = database;
    return {
      db['seed'] as String,
      ...((db['overlays'] as Map?)?.values.expand((v) => (v as List).cast<String>()) ?? const <String>[]),
      ...((db['extra'] as List?) ?? const []).cast<String>(),
    }.map((f) => '$id/$f').toList();
  }
}

class LevelText {
  LevelText(this.m);
  final Map<String, dynamic> m;

  String s(String key) => (m[key] as String?) ?? '';
  String get title => s('title');
  String get difficulty => s('difficulty');
  String get eyebrow => s('eyebrow');
  String get stamp => s('stamp');
  String get summary => s('summary');
  String get intro => s('intro');
  String get startingQuery => s('startingQuery');
  List<String> get skills => ((m['skills'] as List?) ?? const []).cast<String>();
  Map<String, String> get tableNotes => Map<String, String>.from((m['tableNotes'] as Map?) ?? const {});

  List<Lesson> get lessons =>
      ((m['lessons'] as List?) ?? const []).map((l) => Lesson(Map<String, dynamic>.from(l as Map))).toList();
  Map<String, dynamic>? get finale => (m['finale'] as Map?)?.cast<String, dynamic>();

  // Case levels.
  Map<String, dynamic> get briefing => Map<String, dynamic>.from((m['briefing'] as Map?) ?? const {});
  List<Map<String, dynamic>> get hints =>
      ((m['hints'] as List?) ?? const []).map((h) => Map<String, dynamic>.from(h as Map)).toList();
  Map<String, dynamic> get bonusLead => Map<String, dynamic>.from((m['bonusLead'] as Map?) ?? const {});
}

class Lesson {
  Lesson(this.m);
  final Map<String, dynamic> m;

  String get id => m['id'] as String;
  String get title => (m['title'] as String?) ?? '';
  List<dynamic> get body => (m['body'] as List?) ?? const [];
  String get task => (m['task'] as String?) ?? '';
  String? get hint => m['hint'] as String?;
  String? get answer => m['answer'] as String?;
  Map<String, dynamic>? get check => (m['check'] as Map?)?.cast<String, dynamic>();
  bool get isReading => check?['type'] == 'read';
}

class Ending {
  Ending(this.m);
  final Map<String, dynamic> m;
  String get headline => (m['headline'] as String?) ?? '';
  String get motive => (m['motive'] as String?) ?? '';
  List<(String, String)> get chain =>
      ((m['chain'] as List?) ?? const []).map((c) => ((c as List)[0] as String, c[1] as String)).toList();
}

class Catalog {
  Catalog(this.levels);

  factory Catalog.fromJson(String text) {
    final data = jsonDecode(text) as Map<String, dynamic>;
    final levels = (data['levels'] as List).map((l) => LevelDef(Map<String, dynamic>.from(l as Map))).toList()
      ..sort((a, b) => a.number.compareTo(b.number));
    return Catalog(levels);
  }

  final List<LevelDef> levels;
  static const defaultLevel = 'academy';

  LevelDef byId(String id) =>
      levels.firstWhere((l) => l.id == id, orElse: () => levels.firstWhere((l) => l.id == defaultLevel));

  LevelDef? after(LevelDef level) {
    for (final l in levels) {
      if (l.number == level.number + 1) return l;
    }
    return null;
  }
}
