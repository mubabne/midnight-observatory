import 'package:flutter/material.dart';

import '../levels/catalog.dart';
import '../state/controllers.dart';
import 'level_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.app});
  final AppState app;

  void _open(BuildContext context, LevelDef level) {
    app.store.level = level.id;
    app.store.save();
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => LevelScreen(app: app, level: level)));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        return Scaffold(
          body: SafeArea(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 12, 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset('assets/icons/app-icon-512.png', width: 52, height: 52),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(app.t('appTitle'), style: Theme.of(context).textTheme.headlineSmall),
                              const SizedBox(height: 2),
                              Text(app.t('appTagline'), style: const TextStyle(color: Palette.inkDim)),
                            ],
                          ),
                        ),
                        _LangToggle(app: app),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(app.t('levelsTitle'), style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 6),
                        Text(app.t('levelsIntro'), style: const TextStyle(color: Palette.inkDim, height: 1.4)),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: app.catalog.levels.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final level = app.catalog.levels[i];
                      return _LevelCard(app: app, level: level, onTap: () => _open(context, level));
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _LangToggle extends StatelessWidget {
  const _LangToggle({required this.app});
  final AppState app;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      showSelectedIcon: false,
      style: SegmentedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        selectedBackgroundColor: Palette.amberWash,
        selectedForegroundColor: Palette.amber,
        foregroundColor: Palette.inkDim,
        side: const BorderSide(color: Palette.line),
      ),
      segments: const [
        ButtonSegment(value: 'en', label: Text('EN')),
        ButtonSegment(value: 'mn', label: Text('MN')),
      ],
      selected: {app.lang},
      onSelectionChanged: (s) => app.setLang(s.first),
    );
  }
}

class _LevelCard extends StatelessWidget {
  const _LevelCard({required this.app, required this.level, required this.onTap});
  final AppState app;
  final LevelDef level;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = level.content(app.lang);
    final fraction = app.fraction(level);
    final solved = !level.isLessons && app.progress(level).solved;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Eyebrow('${app.t('levelNumber', [level.number])} · ${c.difficulty}'),
                  const Spacer(),
                  if (solved)
                    Stamp(app.t('levelSolved'), color: Palette.ok)
                  else
                    Text(app.status(level), style: const TextStyle(color: Palette.inkFaint, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 8),
              Text(c.title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(c.summary, style: const TextStyle(color: Palette.inkDim, height: 1.4)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final s in c.skills)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Palette.codeBg,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Palette.line),
                      ),
                      child: Text(s, style: const TextStyle(fontFamily: mono, fontSize: 11.5, color: Palette.amberStrong)),
                    ),
                ],
              ),
              if (app.lang != 'en' && !level.hasLanguage(app.lang)) ...[
                const SizedBox(height: 10),
                Text(app.t('levelEnglishOnly'), style: const TextStyle(color: Palette.inkFaint, fontSize: 12)),
              ],
              if (level.isLessons && fraction > 0) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: fraction,
                    minHeight: 5,
                    backgroundColor: Palette.line,
                    color: fraction >= 1 ? Palette.ok : Palette.amber,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
