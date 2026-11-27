import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:share_plus/share_plus.dart';

import '../levels/catalog.dart';
import '../state/controllers.dart';
import 'level_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class LessonsTab extends StatefulWidget {
  const LessonsTab({super.key, required this.ctl});
  final LevelController ctl;

  @override
  State<LessonsTab> createState() => _LessonsTabState();
}

class _LessonsTabState extends State<LessonsTab> {
  final _scroll = ScrollController();
  String? _shownFor;
  bool _hint = false;
  bool _answer = false;

  LevelController get ctl => widget.ctl;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _goTo(Lesson l) {
    ctl.setLesson(l.id);
    if (_scroll.hasClients) {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    }
  }

  Future<void> _resetDb() async {
    final ok = await confirm(
      context,
      title: ctl.t('resetDbTitle'),
      body: ctl.t('resetDbBody'),
      keep: ctl.t('cancel'),
      proceed: ctl.t('resetDb'),
    );
    if (!ok) return;
    await ctl.resetDatabase();
    if (mounted) showNote(context, ctl.t('resetDbDone'));
  }

  @override
  Widget build(BuildContext context) {
    final c = ctl.text;
    final list = ctl.lessons;
    final lesson = ctl.currentLesson;
    if (lesson == null) return const SizedBox.shrink();
    if (_shownFor != lesson.id) {
      _shownFor = lesson.id;
      _hint = false;
      _answer = false;
    }
    final done = list.where((l) => ctl.isDone(l.id)).length;
    final index = list.indexWhere((l) => l.id == lesson.id);
    final finale = c.finale;
    final next = ctl.app.catalog.after(ctl.level);

    return ListView(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 28),
      children: [
        Stamp(c.stamp, color: Palette.amber),
        const SizedBox(height: 10),
        Text(c.eyebrow, style: const TextStyle(color: Palette.inkFaint, fontSize: 12.5)),
        const SizedBox(height: 4),
        if (c.intro.isNotEmpty) ...[
          Rich(c.intro, style: const TextStyle(color: Palette.inkDim, height: 1.45)),
          const SizedBox(height: 12),
        ],
        Row(children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: list.isEmpty ? 0 : done / list.length,
                minHeight: 6,
                backgroundColor: Palette.line,
                color: done == list.length ? Palette.ok : Palette.amber,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(ctl.t('levelProgress', [done, list.length]), style: const TextStyle(color: Palette.inkDim, fontSize: 12.5)),
        ]),
        const SizedBox(height: 14),
        if (done == list.length && finale != null) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Palette.okWash,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Palette.ok.withValues(alpha: 0.6)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${finale['title']}.', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Palette.ok)),
              const SizedBox(height: 6),
              Text('${finale['body']}', style: const TextStyle(height: 1.45)),
              if (next != null) ...[
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => LevelScreen(app: ctl.app, level: next)),
                  ),
                  child: Text(ctl.t('finaleNext', [next.content(ctl.lang).title])),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 14),
        ],
        _lessonCard(context, lesson, index, list.length),
        if (ctl.level.writable) ...[
          const SizedBox(height: 14),
          _dbTools(context),
        ],
        const SizedBox(height: 18),
        Text(ctl.t('lessonsHeading'), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Card(
          child: Column(children: [
            for (final (i, l) in list.indexed)
              ListTile(
                dense: true,
                selected: l.id == lesson.id,
                selectedTileColor: Palette.amberWash,
                leading: CircleAvatar(
                  radius: 13,
                  backgroundColor: ctl.isDone(l.id) ? Palette.okWash : Palette.panel2,
                  child: Text('${i + 1}',
                      style: TextStyle(fontSize: 12, color: ctl.isDone(l.id) ? Palette.ok : Palette.inkDim)),
                ),
                title: Text(l.title, style: TextStyle(color: l.id == lesson.id ? Palette.amber : Palette.ink)),
                trailing: ctl.isDone(l.id) ? const Icon(Icons.check, color: Palette.ok, size: 18) : null,
                onTap: () => _goTo(l),
              ),
          ]),
        ),
      ],
    );
  }

  Widget _lessonCard(BuildContext context, Lesson lesson, int index, int total) {
    final isDone = ctl.isDone(lesson.id);
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: isDone ? Palette.ok.withValues(alpha: 0.5) : Palette.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Eyebrow(ctl.t('lessonOf', [index + 1, total])),
              const Spacer(),
              if (isDone)
                Row(children: [
                  const Icon(Icons.check_circle, color: Palette.ok, size: 16),
                  const SizedBox(width: 4),
                  Text(ctl.t('lessonDoneBadge'), style: const TextStyle(color: Palette.ok, fontSize: 12.5)),
                ]),
            ]),
            const SizedBox(height: 6),
            Text(lesson.title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 10),
            for (final block in lesson.body) ...[
              _block(block),
              const SizedBox(height: 10),
            ],
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Palette.amberWash,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Palette.amber.withValues(alpha: 0.5)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Eyebrow(ctl.t('yourTask')),
                const SizedBox(height: 6),
                Rich(lesson.task),
              ]),
            ),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 4, children: [
              if (!lesson.isReading)
                FilledButton.icon(
                  onPressed: () => ctl.setTab(ctl.queryTab),
                  icon: const Icon(Icons.terminal, size: 18),
                  label: Text(ctl.t('tabQuery')),
                ),
              if (lesson.hint != null)
                OutlinedButton(onPressed: () => setState(() => _hint = true), child: Text(ctl.t('showHint'))),
              if (lesson.answer != null)
                OutlinedButton(onPressed: () => setState(() => _answer = true), child: Text(ctl.t('showAnswer'))),
              if (lesson.isReading && !isDone)
                FilledButton(onPressed: () => ctl.completeLesson(lesson.id), child: Text(ctl.t('markRead'))),
            ]),
            if (_hint && lesson.hint != null) ...[
              const SizedBox(height: 10),
              Rich(lesson.hint!, style: const TextStyle(color: Palette.inkDim, height: 1.45)),
            ],
            if (_answer && lesson.answer != null) ...[
              const SizedBox(height: 10),
              SqlBlock(lesson.answer!, onLoad: () => ctl.loadIntoEditor(lesson.answer!), loadLabel: ctl.t('loadIntoEditor')),
            ],
            const Divider(height: 28),
            Row(children: [
              TextButton.icon(
                onPressed: index == 0 ? null : () => _goTo(ctl.lessons[index - 1]),
                icon: const Icon(Icons.chevron_left),
                label: Text(ctl.t('prevLesson')),
              ),
              const Spacer(),
              if (index < total - 1)
                TextButton.icon(
                  onPressed: () => _goTo(ctl.lessons[index + 1]),
                  icon: const Icon(Icons.chevron_right),
                  label: Text(ctl.t('nextLesson')),
                  iconAlignment: IconAlignment.end,
                ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _block(Object? block) {
    if (block is String) return Rich(block);
    if (block is Map) {
      if (block['sql'] is String) {
        final sql = block['sql'] as String;
        return SqlBlock(sql, onLoad: () => ctl.loadIntoEditor(sql), loadLabel: ctl.t('loadIntoEditor'));
      }
      if (block['list'] is List) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final item in block['list'] as List)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2, right: 8),
                    child: Text('•', style: TextStyle(color: Palette.amber)),
                  ),
                  Expanded(child: Rich('$item')),
                ]),
              ),
          ],
        );
      }
      if (block['note'] is String) {
        final note = block['note'] as String;
        final quote = note.startsWith('"');
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Palette.panel2,
            borderRadius: BorderRadius.circular(8),
            border: const Border(left: BorderSide(color: Palette.amber, width: 3)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!quote) ...[Eyebrow(ctl.t('onServer'), color: Palette.inkFaint), const SizedBox(height: 4)],
            Rich(
              quote ? note : note.replaceFirst(RegExp(r'^On a server:\s*'), ''),
              style: TextStyle(color: Palette.inkDim, height: 1.45, fontStyle: quote ? FontStyle.italic : null),
            ),
          ]),
        );
      }
    }
    return const SizedBox.shrink();
  }

  Widget _dbTools(BuildContext context) {
    return Section(
      title: ctl.t('dbToolsHeading'),
      children: [
        Text(ctl.t('dbToolsHelp'), style: const TextStyle(color: Palette.inkDim)),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: Palette.danger),
          onPressed: _resetDb,
          icon: const Icon(Icons.restore),
          label: Text(ctl.t('resetDb')),
        ),
        if (ctl.files.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(ctl.t('savedFiles'), style: const TextStyle(color: Palette.inkFaint, fontSize: 12.5)),
          for (final f in ctl.files.where(fileExists))
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.storage, color: Palette.amber),
              title: Text(p.basename(f), style: const TextStyle(fontFamily: mono)),
              trailing: TextButton.icon(
                onPressed: () => SharePlus.instance.share(ShareParams(files: [XFile(f)], title: p.basename(f))),
                icon: const Icon(Icons.ios_share, size: 18),
                label: Text(ctl.t('shareFile')),
              ),
            ),
        ],
      ],
    );
  }
}
