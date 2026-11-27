import 'package:flutter/material.dart';

import '../levels/solutions.dart';
import '../state/controllers.dart';
import 'theme.dart';
import 'widgets.dart';

/// The briefing and the accusation form of a case level.
class CaseTab extends StatefulWidget {
  const CaseTab({super.key, required this.ctl, required this.onEnding});
  final LevelController ctl;
  final VoidCallback onEnding;

  @override
  State<CaseTab> createState() => _CaseTabState();
}

class _CaseTabState extends State<CaseTab> {
  final _name = TextEditingController();
  Verdict? _verdict;
  bool _busy = false;

  LevelController get ctl => widget.ctl;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _accuse() async {
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final v = await ctl.accuse(_name.text);
    if (mounted) setState(() => (_verdict = v, _busy = false));
  }

  @override
  Widget build(BuildContext context) {
    final c = ctl.text;
    final b = c.briefing;
    final facts = ((b['facts'] as List?) ?? const []).map((f) => (f as List).cast<String>()).toList();
    final conventions = ((b['conventions'] as List?) ?? const []).cast<String>();
    final solved = ctl.progress.solved;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 28),
      children: [
        Row(children: [Stamp(c.stamp), const Spacer()]),
        const SizedBox(height: 10),
        Text(c.eyebrow, style: const TextStyle(color: Palette.inkFaint, fontSize: 12.5)),
        const SizedBox(height: 12),
        if (solved) ...[
          Container(
            padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
            decoration: BoxDecoration(
              color: Palette.okWash,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Palette.ok.withValues(alpha: 0.6)),
            ),
            child: Row(children: [
              const Icon(Icons.verified, color: Palette.ok),
              const SizedBox(width: 10),
              Expanded(child: Text(c.s('solvedText'), style: const TextStyle(color: Palette.ok))),
              TextButton(onPressed: widget.onEnding, child: Text(ctl.t('reopenEnding'), style: const TextStyle(color: Palette.ok))),
            ]),
          ),
          const SizedBox(height: 12),
        ],
        Section(
          title: ctl.t('briefingHeading'),
          children: [
            Text('${b['premise'] ?? ''}', style: const TextStyle(height: 1.5)),
            const SizedBox(height: 12),
            Eyebrow(ctl.t('yourJob')),
            const SizedBox(height: 4),
            Text('${b['objective'] ?? ''}', style: const TextStyle(height: 1.5, fontWeight: FontWeight.w600)),
            if (facts.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final f in facts)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(width: 72, child: Text(f[0], style: const TextStyle(color: Palette.inkFaint))),
                    Expanded(child: Text(f[1])),
                  ]),
                ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Section(
          title: ctl.t('recordsHeading'),
          children: [
            for (final x in conventions)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1, right: 8),
                    child: Text('•', style: TextStyle(color: Palette.amber)),
                  ),
                  Expanded(child: Rich(x, style: const TextStyle(color: Palette.inkDim, height: 1.45))),
                ]),
              ),
            const SizedBox(height: 4),
            FilledButton.icon(
              onPressed: () => ctl.loadIntoEditor(c.startingQuery),
              icon: const Icon(Icons.play_arrow_rounded),
              label: Text(ctl.t('starter')),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Section(
          title: c.s('accuseHeading'),
          children: [
            Rich(c.s('accuseHelp'), style: const TextStyle(color: Palette.inkDim, height: 1.4)),
            const SizedBox(height: 10),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              autocorrect: false,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _accuse(),
              decoration: InputDecoration(labelText: ctl.t('accuseLabel')),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Palette.danger, minimumSize: const Size.fromHeight(46)),
              onPressed: _busy ? null : _accuse,
              icon: const Icon(Icons.gavel),
              label: Text(ctl.t('accuseButton')),
            ),
            if (_verdict != null) ...[
              const SizedBox(height: 10),
              Text(
                _verdict!.message,
                style: TextStyle(
                  color: _verdict!.correct ? Palette.ok : (_verdict!.kind == 'wrong' ? Palette.danger : Palette.amber),
                  height: 1.4,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class HintsTab extends StatelessWidget {
  const HintsTab({super.key, required this.ctl});
  final LevelController ctl;

  @override
  Widget build(BuildContext context) {
    final c = ctl.text;
    final hints = c.hints;
    final n = ctl.progress.hintsRevealed.clamp(0, hints.length);
    final bonus = c.bonusLead;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 28),
      children: [
        Text(ctl.t('hintsHeading'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(ctl.t('hintsHelp'), style: const TextStyle(color: Palette.inkDim)),
        const SizedBox(height: 12),
        for (final (i, hint) in hints.take(n).indexed) ...[
          Section(
            title: '${i + 1}. ${hint['title']}',
            children: [
              Text('${hint['body']}', style: const TextStyle(height: 1.45)),
              if (hint['sql'] is String) ...[
                const SizedBox(height: 10),
                SqlBlock(hint['sql'] as String,
                    onLoad: () => ctl.loadIntoEditor(hint['sql'] as String), loadLabel: ctl.t('loadIntoEditor')),
              ],
            ],
          ),
          const SizedBox(height: 10),
        ],
        if (n < hints.length)
          FilledButton.icon(
            onPressed: ctl.revealHint,
            icon: const Icon(Icons.lightbulb_outline),
            label: Text(ctl.t('revealHint', [n + 1, hints.length])),
          ),
        const SizedBox(height: 16),
        if (ctl.progress.bonusRevealed)
          Section(
            title: '${bonus['title'] ?? ''}',
            children: [Text('${bonus['body'] ?? ''}', style: const TextStyle(height: 1.45))],
          )
        else
          OutlinedButton.icon(
            onPressed: ctl.revealBonus,
            icon: const Icon(Icons.star_outline),
            label: Text(c.s('bonusButton')),
          ),
      ],
    );
  }
}
