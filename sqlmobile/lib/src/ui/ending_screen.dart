import 'package:flutter/material.dart';

import '../levels/catalog.dart';
import 'theme.dart';
import 'widgets.dart';

/// Shown after a correct accusation.
class EndingScreen extends StatelessWidget {
  const EndingScreen({super.key, required this.ending, required this.t});
  final Ending ending;
  final String Function(String key, [List<Object?> args]) t;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('endingStamp'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          Center(child: Stamp(t('endingStamp'), color: Palette.ok)),
          const SizedBox(height: 18),
          Text(ending.headline, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          Section(title: t('motive'), children: [Text(ending.motive, style: const TextStyle(height: 1.5))]),
          const SizedBox(height: 12),
          Section(
            title: t('howItFits'),
            children: [
              for (final (i, (label, text)) in ending.chain.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    CircleAvatar(
                      radius: 12,
                      backgroundColor: Palette.amberWash,
                      child: Text('${i + 1}', style: const TextStyle(fontSize: 12, color: Palette.amber)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text.rich(TextSpan(children: [
                        TextSpan(text: '$label. ', style: const TextStyle(fontWeight: FontWeight.w700)),
                        TextSpan(text: text),
                      ]), style: const TextStyle(height: 1.45)),
                    ),
                  ]),
                ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => Navigator.pop(context), child: Text(t('backToDesk'))),
        ],
      ),
    );
  }
}
