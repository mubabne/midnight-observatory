import 'package:flutter/material.dart';

import '../engine/session.dart';
import '../state/controllers.dart';
import 'theme.dart';
import 'widgets.dart';

/// The table reference, read from the live schema.
class TablesTab extends StatelessWidget {
  const TablesTab({super.key, required this.ctl});
  final LevelController ctl;

  @override
  Widget build(BuildContext context) {
    final schema = ctl.schema;
    if (schema == null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 12),
          Text(ctl.t('tablesLoading'), style: const TextStyle(color: Palette.inkDim)),
        ]),
      );
    }
    final notes = ctl.text.tableNotes;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 24),
      children: [
        Text(ctl.t('tablesHeading'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(ctl.t('tablesLegend'), style: const TextStyle(color: Palette.inkFaint, fontSize: 12.5)),
        const SizedBox(height: 12),
        for (final table in schema) ...[
          _TableCard(ctl: ctl, table: table, note: notes[table.name]),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _TableCard extends StatelessWidget {
  const _TableCard({required this.ctl, required this.table, this.note});
  final LevelController ctl;
  final TableInfo table;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final example = 'SELECT *\nFROM ${table.name}\nLIMIT 10;';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: true,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
          iconColor: Palette.inkDim,
          collapsedIconColor: Palette.inkDim,
          title: Row(children: [
            Flexible(
              child: Text(table.name,
                  style: const TextStyle(fontFamily: mono, color: Palette.amberStrong, fontWeight: FontWeight.w700)),
            ),
            if (table.isView) ...[
              const SizedBox(width: 8),
              Text(ctl.t('viewKind'), style: const TextStyle(color: Palette.inkFaint, fontSize: 12)),
            ],
          ]),
          subtitle: table.rowCount == null
              ? null
              : Text(ctl.t('rowsCount', [table.rowCount]), style: const TextStyle(color: Palette.inkFaint, fontSize: 12)),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (note != null && note!.isNotEmpty) ...[
              Rich(note!, style: const TextStyle(color: Palette.inkDim, fontSize: 13.5, height: 1.4)),
              const SizedBox(height: 8),
            ],
            for (final c in table.columns)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  children: [
                    Text(c.name, style: const TextStyle(fontFamily: mono, color: Palette.ink, fontSize: 13.5)),
                    Text(c.type, style: const TextStyle(fontFamily: mono, color: Palette.inkFaint, fontSize: 12)),
                    if (c.primaryKey)
                      const Text('PK', style: TextStyle(color: Palette.amber, fontSize: 11.5, fontWeight: FontWeight.w700)),
                    if (c.references != null)
                      Text('→ ${c.references}', style: const TextStyle(color: Palette.ok, fontSize: 12, fontFamily: mono)),
                  ],
                ),
              ),
            const SizedBox(height: 6),
            Row(children: [
              OutlinedButton.icon(
                onPressed: () => ctl.loadIntoEditor(example),
                icon: const Icon(Icons.input, size: 18),
                label: Text(ctl.t('insertSelect')),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () => copyToClipboard(context, example, ctl.t('copied')),
                child: Text(ctl.t('copy')),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}
