import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../state/controllers.dart';
import '../state/store.dart';
import 'results_view.dart';
import 'theme.dart';
import 'widgets.dart';

class QueryTab extends StatefulWidget {
  const QueryTab({super.key, required this.ctl});
  final LevelController ctl;

  @override
  State<QueryTab> createState() => _QueryTabState();
}

class _QueryTabState extends State<QueryTab> {
  final _scroll = ScrollController();
  final _resultsKey = GlobalKey();
  final _focus = FocusNode();

  LevelController get ctl => widget.ctl;

  Future<void> _run([String? sql]) async {
    _focus.unfocus();
    await ctl.run(sql);
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _resultsKey.currentContext;
      if (c != null && c.mounted) {
        Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 250), alignment: 0.0);
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _focus.dispose();
    super.dispose();
  }

  List<(String label, String insert, int back)> _keywords() {
    final words = <(String, String, int)>[
      ('SELECT', 'SELECT ', 0),
      ('*', '* ', 0),
      ('FROM', 'FROM ', 0),
      ('WHERE', 'WHERE ', 0),
      ('=', ' = ', 0),
      ("' '", "''", 1),
      (',', ', ', 0),
      (';', ';\n', 0),
      ('( )', '()', 1),
      ('AND', 'AND ', 0),
      ('OR', 'OR ', 0),
      ('LIKE', 'LIKE ', 0),
      ('%', '%', 0),
      ('IN', 'IN ', 0),
      ('IS NULL', 'IS NULL ', 0),
      ('>', ' > ', 0),
      ('<', ' < ', 0),
      ('<>', ' <> ', 0),
      ('ORDER BY', 'ORDER BY ', 0),
      ('DESC', 'DESC ', 0),
      ('LIMIT', 'LIMIT ', 0),
      ('DISTINCT', 'DISTINCT ', 0),
      ('COUNT(*)', 'COUNT(*) ', 0),
      ('AS', 'AS ', 0),
      ('JOIN', 'JOIN ', 0),
      ('ON', 'ON ', 0),
      ('BETWEEN', 'BETWEEN ', 0),
      ('GROUP BY', 'GROUP BY ', 0),
      ('HAVING', 'HAVING ', 0),
      ('LEFT JOIN', 'LEFT JOIN ', 0),
      ('WITH', 'WITH ', 0),
      if (ctl.level.writable) ...[
        ('BEGIN', 'BEGIN;\n', 0),
        ('COMMIT', 'COMMIT;\n', 0),
        ('ROLLBACK', 'ROLLBACK;\n', 0),
        ('INSERT INTO', 'INSERT INTO ', 0),
        ('UPDATE', 'UPDATE ', 0),
        ('SET', 'SET ', 0),
        ('DELETE FROM', 'DELETE FROM ', 0),
        ('CREATE', 'CREATE ', 0),
        ('EXCEPT', 'EXCEPT ', 0),
      ],
    ];
    for (final table in ctl.schema ?? const []) {
      words.add((table.name, '${table.name} ', 0));
    }
    return words;
  }

  void _insert(String text, int back) {
    ctl.insertAtCursor(text);
    if (back > 0) {
      final v = ctl.editor.value;
      final at = v.selection.baseOffset - back;
      ctl.editor.selection = TextSelection.collapsed(offset: at);
    }
    HapticFeedback.selectionClick();
  }

  void _showHistory() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.92,
        builder: (context, scroll) => ListenableBuilder(
          listenable: ctl,
          builder: (context, _) => _HistoryList(
            ctl: ctl,
            scroll: scroll,
            onLoad: (sql) {
              Navigator.pop(sheet);
              ctl.loadIntoEditor(sql);
            },
            onRun: (sql) {
              Navigator.pop(sheet);
              ctl.loadIntoEditor(sql);
              _run(sql);
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lesson = ctl.isLessons ? ctl.currentLesson : null;
    final lessons = ctl.lessons;
    return ListView(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      children: [
        if (lesson != null) ...[
          Material(
            color: Palette.amberWash,
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => ctl.setTab(0),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Eyebrow(ctl.t('lessonOf', [lessons.indexWhere((l) => l.id == lesson.id) + 1, lessons.length])),
                      const Spacer(),
                      if (ctl.isDone(lesson.id)) const Icon(Icons.check_circle, color: Palette.ok, size: 18),
                    ]),
                    const SizedBox(height: 6),
                    Rich(lesson.task, style: const TextStyle(color: Palette.ink, fontSize: 14.5, height: 1.4)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        TextField(
          controller: ctl.editor,
          focusNode: _focus,
          minLines: 6,
          maxLines: 12,
          keyboardType: TextInputType.multiline,
          autocorrect: false,
          enableSuggestions: false,
          smartQuotesType: SmartQuotesType.disabled,
          smartDashesType: SmartDashesType.disabled,
          textCapitalization: TextCapitalization.none,
          style: const TextStyle(fontFamily: mono, fontSize: 14, height: 1.45, color: Palette.ink),
          decoration: InputDecoration(
            hintText: ctl.t('editorHint'),
            contentPadding: const EdgeInsets.all(12),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 38,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final (label, insert, back) in _keywords())
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    label: Text(label, style: const TextStyle(fontFamily: mono, fontSize: 12.5, color: Palette.amberStrong)),
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    visualDensity: VisualDensity.compact,
                    onPressed: () => _insert(insert, back),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: ctl.running || ctl.session == null ? null : () => _run(),
                icon: ctl.running
                    ? const SizedBox(
                        width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Palette.amberInk))
                    : const Icon(Icons.play_arrow_rounded),
                label: Text(ctl.running ? ctl.t('running') : ctl.t('run')),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 46)),
              ),
            ),
            const SizedBox(width: 6),
            IconButton.outlined(
              tooltip: ctl.t('tabHistory'),
              onPressed: _showHistory,
              icon: const Icon(Icons.history),
            ),
            IconButton.outlined(
              tooltip: ctl.t('starter'),
              onPressed: () => ctl.loadIntoEditor(ctl.text.startingQuery),
              icon: const Icon(Icons.restart_alt),
            ),
            IconButton.outlined(
              tooltip: ctl.t('clearEditor'),
              onPressed: () {
                ctl.editor.clear();
                _focus.requestFocus();
              },
              icon: const Icon(Icons.backspace_outlined),
            ),
          ],
        ),
        const SizedBox(height: 14),
        KeyedSubtree(key: _resultsKey, child: ResultsView(ctl: ctl)),
      ],
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.ctl, required this.scroll, required this.onLoad, required this.onRun});
  final LevelController ctl;
  final ScrollController scroll;
  final void Function(String) onLoad;
  final void Function(String) onRun;

  @override
  Widget build(BuildContext context) {
    final history = ctl.progress.history;
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Row(children: [
          Expanded(child: Text(ctl.t('historyHeading'), style: Theme.of(context).textTheme.titleLarge)),
          if (history.isNotEmpty) TextButton(onPressed: ctl.clearHistory, child: Text(ctl.t('clear'))),
        ]),
        Text(ctl.t('historyHelp'), style: const TextStyle(color: Palette.inkDim)),
        const SizedBox(height: 12),
        if (history.isEmpty) Text(ctl.t('noQueries'), style: const TextStyle(color: Palette.inkFaint)),
        for (final h in history) ...[
          _HistoryTile(ctl: ctl, entry: h, onLoad: onLoad, onRun: onRun),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.ctl, required this.entry, required this.onLoad, required this.onRun});
  final LevelController ctl;
  final HistoryEntry entry;
  final void Function(String) onLoad;
  final void Function(String) onRun;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (entry.status) {
      'error' => (Palette.danger, ctl.t('error')),
      'timeout' => (Palette.danger, ctl.t('timedOut')),
      _ => (Palette.ok, ctl.t('ok')),
    };
    final time = DateTime.tryParse(entry.ranAt);
    final when = time == null
        ? ''
        : '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    return Card(
      color: Palette.panel2,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => onLoad(entry.sql),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 4, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.circle, size: 9, color: color),
                const SizedBox(width: 6),
                Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    [when, entry.summary].where((s) => s.isNotEmpty).join(' · '),
                    style: const TextStyle(color: Palette.inkFaint, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  tooltip: ctl.t('runAgain'),
                  visualDensity: VisualDensity.compact,
                  onPressed: () => onRun(entry.sql),
                  icon: const Icon(Icons.play_arrow_rounded, color: Palette.amber),
                ),
              ]),
              Text(
                entry.sql.trim(),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontFamily: mono, fontSize: 12.5, color: Palette.ink, height: 1.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
