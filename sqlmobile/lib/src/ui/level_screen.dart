import 'package:flutter/material.dart';

import '../levels/catalog.dart';
import '../state/controllers.dart';
import 'case_tab.dart';
import 'ending_screen.dart';
import 'lessons_tab.dart';
import 'notes_tab.dart';
import 'query_tab.dart';
import 'tables_tab.dart';
import 'theme.dart';
import 'widgets.dart';

class LevelScreen extends StatefulWidget {
  const LevelScreen({super.key, required this.app, required this.level});
  final AppState app;
  final LevelDef level;

  @override
  State<LevelScreen> createState() => _LevelScreenState();
}

class _LevelScreenState extends State<LevelScreen> {
  late final LevelController ctl = LevelController(widget.app, widget.level);

  @override
  void initState() {
    super.initState();
    ctl.addListener(_onChange);
    ctl.open();
  }

  void _onChange() {
    final notice = ctl.notice;
    if (notice != null) {
      ctl.notice = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showNote(context, notice);
      });
    }
    if (ctl.justSolved) {
      ctl.justSolved = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _openEnding());
    }
  }

  void _openEnding() {
    final ending = widget.level.ending(ctl.lang);
    if (ending == null || !mounted) return;
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => EndingScreen(ending: ending, t: ctl.t),
    ));
  }

  @override
  void dispose() {
    ctl.removeListener(_onChange);
    ctl.dispose();
    super.dispose();
  }

  Future<void> _startOver() async {
    final ok = await confirm(
      context,
      title: ctl.t('resetTitle'),
      body: ctl.t('resetBody'),
      keep: ctl.t('resetKeep'),
      proceed: ctl.t('resetConfirm'),
    );
    if (!ok) return;
    await ctl.resetLevel();
    if (mounted) showNote(context, ctl.t('resetDone'));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ctl,
      builder: (context, _) {
        final c = ctl.text;
        final tabs = <(IconData, IconData, String, Widget)>[
          if (ctl.isLessons)
            (Icons.school_outlined, Icons.school, ctl.t('tabLessons'), LessonsTab(ctl: ctl))
          else
            (Icons.folder_open_outlined, Icons.folder_open, ctl.t('tabCase'), CaseTab(ctl: ctl, onEnding: _openEnding)),
          (Icons.terminal_outlined, Icons.terminal, ctl.t('tabQuery'), QueryTab(ctl: ctl)),
          (Icons.table_chart_outlined, Icons.table_chart, ctl.t('tabTables'), TablesTab(ctl: ctl)),
          if (!ctl.isLessons) (Icons.lightbulb_outline, Icons.lightbulb, ctl.t('tabHints'), HintsTab(ctl: ctl)),
          (Icons.edit_note_outlined, Icons.edit_note, ctl.t('tabNotes'), NotesTab(ctl: ctl)),
        ];
        final index = ctl.tab.clamp(0, tabs.length - 1);
        final solved = !ctl.isLessons && ctl.progress.solved;
        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.title, overflow: TextOverflow.ellipsis),
                Text(
                  ctl.t('levelNumber', [widget.level.number]) + (solved ? ' · ${ctl.t('solvedBanner')}' : ''),
                  style: TextStyle(fontSize: 12, color: solved ? Palette.ok : Palette.inkFaint, fontFamily: null),
                ),
              ],
            ),
            actions: [
              PopupMenuButton<String>(
                onSelected: (v) {
                  if (v == 'reset') _startOver();
                  if (v == 'ending') _openEnding();
                },
                itemBuilder: (_) => [
                  if (solved) PopupMenuItem(value: 'ending', child: Text(ctl.t('reopenEnding'))),
                  PopupMenuItem(value: 'reset', child: Text(ctl.t('startOver'))),
                ],
              ),
            ],
          ),
          body: _body(tabs, index),
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            onDestinationSelected: (i) {
              FocusScope.of(context).unfocus();
              ctl.setTab(i);
            },
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            height: 66,
            destinations: [
              for (final (icon, selected, label, _) in tabs)
                NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: label),
            ],
          ),
        );
      },
    );
  }

  Widget _body(List<(IconData, IconData, String, Widget)> tabs, int index) {
    if (ctl.loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: Palette.danger, size: 40),
            const SizedBox(height: 10),
            Text(ctl.t('engineFailedTitle'), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(ctl.loadError!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.inkDim)),
            const SizedBox(height: 14),
            FilledButton(onPressed: ctl.open, child: Text(ctl.t('tryAgain'))),
          ]),
        ),
      );
    }
    return IndexedStack(index: index, children: [for (final t in tabs) t.$4]);
  }
}
