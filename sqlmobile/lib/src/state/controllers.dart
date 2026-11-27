import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import '../engine/session.dart';
import '../engine/worker.dart' show queryTimeout;
import '../levels/catalog.dart';
import '../levels/solutions.dart';
import '../strings.dart';
import 'store.dart';

/// App-wide state: the level catalog, saved progress and the language.
class AppState extends ChangeNotifier {
  AppState._(this.catalog, this.store, this.scripts, this.baseDir);

  final Catalog catalog;
  final Store store;
  final Map<String, String> scripts;
  final String baseDir;

  static Future<AppState> load() async {
    final catalog = Catalog.fromJson(await rootBundle.loadString('assets/levels.json'));
    final scripts = <String, String>{};
    for (final level in catalog.levels) {
      for (final path in level.allScripts) {
        scripts[path] = await rootBundle.loadString('assets/levels/$path');
      }
    }
    final locale = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    final store = await Store.load(defaultLang: locale == 'mn' ? 'mn' : 'en');
    final dir = await getApplicationSupportDirectory();
    return AppState._(catalog, store, scripts, dir.path);
  }

  String get lang => store.lang;
  String t(String key, [List<Object?> args = const []]) => tr(lang, key, args);

  void setLang(String lang) {
    if (store.lang == lang) return;
    store.lang = lang;
    store.save();
    notifyListeners();
  }

  LevelProgress progress(LevelDef level) => store.progress(level.id, level.content(lang).startingQuery);

  /// Status line for a level card.
  String status(LevelDef level) {
    final p = progress(level);
    if (level.isLessons) {
      final total = level.content(lang).lessons.length;
      final done = p.lessonsDone.length.clamp(0, total);
      if (done == 0 && !p.started) return t('levelNotStarted');
      return t('levelProgress', [done, total]);
    }
    if (p.solved) return t('levelSolved');
    return p.started ? t('levelInProgress') : t('levelNotStarted');
  }

  double fraction(LevelDef level) {
    final p = progress(level);
    if (level.isLessons) {
      final total = level.content(lang).lessons.length;
      return total == 0 ? 0 : (p.lessonsDone.length / total).clamp(0, 1).toDouble();
    }
    return p.solved ? 1 : 0;
  }

  void touch() => notifyListeners();
}

class CheckBanner {
  const CheckBanner({required this.passed, required this.text, this.showNext = false});
  final bool passed;
  final String text;
  final bool showNext;
}

/// One open level: its database session, editor and progress.
class LevelController extends ChangeNotifier {
  LevelController(this.app, this.level) : progress = app.progress(level) {
    editor = TextEditingController(text: progress.draft);
    notes = TextEditingController(text: progress.notes);
    editor.addListener(_draftChanged);
    notes.addListener(_notesChanged);
  }

  final AppState app;
  final LevelDef level;
  final LevelProgress progress;
  late final TextEditingController editor;
  late final TextEditingController notes;

  LevelSession? session;
  String? loadError;
  List<TableInfo>? schema;
  bool running = false;
  RunResult? result;
  CheckBanner? banner;
  List<String> files = [];
  int tab = 0;
  String? notice;
  bool justSolved = false;
  Timer? _saveTimer;
  bool _disposed = false;

  String get lang => app.lang;
  LevelText get text => level.content(lang);
  String t(String key, [List<Object?> args = const []]) => app.t(key, args);
  bool get isLessons => level.isLessons;

  /// Tab indexes. Lesson levels: Lessons, Query, Tables, Notes.
  /// Case levels: Case, Query, Tables, Hints, Notes.
  int get queryTab => 1;

  Future<void> open() async {
    loadError = null;
    schema = null;
    _notify();
    try {
      final s = LevelSession(level: level, lang: lang, baseDir: app.baseDir, read: (p) => app.scripts[p]!);
      await s.open();
      session = s;
      if (s.snapshotRejected) notice = t('snapshotRejected');
      schema = await s.schema();
    } catch (e) {
      loadError = '$e';
    }
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _scheduleSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), () => app.store.save());
  }

  void _draftChanged() {
    if (progress.draft == editor.text) return;
    progress.draft = editor.text;
    _scheduleSave();
  }

  void _notesChanged() {
    if (progress.notes == notes.text) return;
    progress.notes = notes.text;
    _scheduleSave();
  }

  void setTab(int i) {
    tab = i;
    _notify();
  }

  void loadIntoEditor(String sql) {
    editor.value = TextEditingValue(text: sql, selection: TextSelection.collapsed(offset: sql.length));
    tab = queryTab;
    _notify();
  }

  /// Inserts text at the cursor (used by the SQL keyword bar).
  void insertAtCursor(String snippet) {
    final v = editor.value;
    final sel = v.selection.isValid ? v.selection : TextSelection.collapsed(offset: v.text.length);
    final before = v.text.substring(0, sel.start);
    final needsSpace = before.isNotEmpty && !RegExp(r'[\s(]$').hasMatch(before) && RegExp(r'^\w').hasMatch(snippet);
    final insert = '${needsSpace ? ' ' : ''}$snippet';
    final text = v.text.replaceRange(sel.start, sel.end, insert);
    editor.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: sel.start + insert.length));
  }

  // ---------- lessons ----------

  List<Lesson> get lessons => text.lessons;

  Lesson? get currentLesson {
    final list = lessons;
    if (list.isEmpty) return null;
    for (final l in list) {
      if (l.id == progress.lesson) return l;
    }
    for (final l in list) {
      if (!progress.lessonsDone.contains(l.id)) return l;
    }
    return list.first;
  }

  bool isDone(String id) => progress.lessonsDone.contains(id);

  Lesson? nextLessonAfter(Lesson? lesson) {
    final list = lessons;
    final i = lesson == null ? -1 : list.indexWhere((l) => l.id == lesson.id);
    return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  }

  void setLesson(String id) {
    progress.lesson = id;
    banner = null;
    tab = 0;
    app.store.save();
    _notify();
  }

  bool completeLesson(String id) {
    if (isDone(id)) return false;
    progress.lessonsDone = [...progress.lessonsDone, id];
    app.store.save();
    app.touch();
    _notify();
    return true;
  }

  // ---------- running ----------

  Future<void> run([String? sqlOverride]) async {
    final s = session;
    if (s == null || running) return;
    final sel = editor.selection;
    final sql = sqlOverride ??
        (sel.isValid && !sel.isCollapsed && sel.textInside(editor.text).trim().isNotEmpty
            ? sel.textInside(editor.text)
            : editor.text);
    running = true;
    banner = null;
    _notify();
    final lesson = isLessons ? currentLesson : null;
    final r = await s.run(sql, lesson: lesson);
    running = false;
    result = r;
    if (r.schema != null) schema = r.schema;
    for (final f in r.files) {
      if (!files.contains(f)) files.add(f);
    }
    progress.history = [
      HistoryEntry(
        sql: sql,
        ranAt: DateTime.now().toIso8601String(),
        status: r.timeout ? 'timeout' : (r.ok ? 'ok' : 'error'),
        summary: r.ok ? summary(r) : '',
      ),
      ...progress.history,
    ].take(historyLimit).toList();
    app.store.save();
    final check = r.check;
    if (check != null && lesson != null && check.lessonId == lesson.id) _handleCheck(check, lesson);
    _notify();
  }

  String summary(RunResult r) {
    final rows = r.truncated
        ? t('rowsSummaryMore', [r.rows.length])
        : (r.rows.length == 1 ? t('rowsSummary1') : t('rowsSummary', [r.rows.length]));
    final buf = StringBuffer(r.producedRows ? rows : t('statementRan'));
    if (r.statementCount > 1) buf.write(t('multiStatement', [r.statementCount]));
    if (r.changes > 0) buf.write(t('rowsChanged', [r.changes]));
    if (r.rolledBack) buf.write(t('rolledBackNote'));
    buf.write(' · ${r.elapsedMs} ms');
    return buf.toString();
  }

  String timeoutText() => t('errTimeout', [queryTimeout.inSeconds]);

  String checkReason(CheckVerdict c) {
    final d = c.detail;
    switch (c.reason) {
      case 'noResult':
        return t('checkNoResult');
      case 'rowCount':
        return t('checkRowCount', [d['expected'], d['got']]);
      case 'columnCount':
        return t('checkColumnCount', [d['expected'], d['got']]);
      case 'values':
        final col = d['column'];
        // Only name the column when it is a plain name, not an expression.
        return col is String && RegExp(r'^[A-Za-z_]\w*$').hasMatch(col) ? t('checkValuesCol', [col]) : t('checkValues');
      case 'order':
        return t('checkOrder');
      case 'columnName':
        return t('checkColumnName', [d['name']]);
      case 'value':
        return c.message ?? t('checkValue');
      case 'noFile':
        return t('checkNoFile');
      default:
        return c.message ?? t('checkCustom');
    }
  }

  void _handleCheck(CheckVerdict c, Lesson lesson) {
    // A statement with no result set (an UPDATE, a CREATE…) is usually the
    // player exploring or preparing, so it gets no "not yet" for row checks.
    if (!c.passed && c.reason == 'noResult') return;
    if (c.passed) {
      final fresh = completeLesson(lesson.id);
      banner = CheckBanner(
        passed: true,
        text: t(fresh ? 'lessonPassed' : 'lessonPassedAgain'),
        showNext: nextLessonAfter(lesson) != null,
      );
    } else {
      banner = CheckBanner(passed: false, text: '${t('notYet')} ${checkReason(c)}');
    }
  }

  void goToNextLesson() {
    final next = nextLessonAfter(currentLesson);
    if (next != null) setLesson(next.id);
  }

  /// Appends the visible result to the notebook as plain text.
  void pinResult() {
    final r = result;
    if (r == null || !r.ok || !r.producedRows) return;
    final lines = <String>[
      r.columns.join(' | '),
      for (final row in r.rows.take(20)) row.map(cellText).join(' | '),
      if (r.rows.length > 20) '… (${r.rows.length} rows)',
    ];
    final block = '-- ${progress.history.isNotEmpty ? progress.history.first.sql.trim().split('\n').first : ''}\n${lines.join('\n')}';
    notes.text = notes.text.isEmpty ? block : '${notes.text.trimRight()}\n\n$block';
  }

  static String cellText(Object? v) {
    if (v == null) return 'NULL';
    if (v is List<int>) return '<blob ${v.length} bytes>';
    return '$v';
  }

  void clearHistory() {
    progress.history = [];
    app.store.save();
    _notify();
  }

  // ---------- cases ----------

  void revealHint() {
    progress.hintsRevealed = (progress.hintsRevealed + 1).clamp(0, text.hints.length);
    app.store.save();
    _notify();
  }

  void revealBonus() {
    progress.bonusRevealed = true;
    app.store.save();
    _notify();
  }

  Future<Verdict> accuse(String raw) async {
    final name = normalizeName(raw);
    if (name.isEmpty) return judgeAccusation(level.id, '', false, lang);
    final exists = await (session?.findPerson(name) ?? Future.value(true));
    final v = judgeAccusation(level.id, raw, exists, lang);
    progress.guesses = [...progress.guesses, name].reversed.take(20).toList().reversed.toList();
    if (v.correct) {
      progress.solved = true;
      justSolved = true;
      app.touch();
    }
    app.store.save();
    _notify();
    return v;
  }

  // ---------- resets ----------

  Future<void> resetLevel() async {
    app.store.resetLevel(level.id, text.startingQuery);
    editor.text = progress.draft;
    notes.text = '';
    result = null;
    banner = null;
    files = [];
    session?.resetDatabase();
    app.touch();
    await open();
  }

  Future<void> resetDatabase() async {
    session?.resetDatabase();
    files = [];
    result = null;
    banner = null;
    schema = await session?.schema();
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _saveTimer?.cancel();
    app.store.save();
    editor.dispose();
    notes.dispose();
    super.dispose();
  }
}

bool fileExists(String path) => File(path).existsSync();
