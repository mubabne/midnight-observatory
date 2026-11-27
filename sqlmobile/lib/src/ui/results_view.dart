import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../state/controllers.dart';
import 'theme.dart';
import 'widgets.dart';

/// The lesson check banner and the result of the last run.
class ResultsView extends StatelessWidget {
  const ResultsView({super.key, required this.ctl});
  final LevelController ctl;

  @override
  Widget build(BuildContext context) {
    final banner = ctl.banner;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (banner != null) ...[
          _CheckBanner(ctl: ctl, banner: banner),
          const SizedBox(height: 10),
        ],
        _body(context),
      ],
    );
  }

  Widget _body(BuildContext context) {
    final r = ctl.result;
    if (ctl.running) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (r == null) {
      final returning = ctl.progress.history.isNotEmpty;
      return _Placeholder(
        icon: Icons.manage_search,
        text: ctl.isLessons ? ctl.t('idleLesson') : (returning ? ctl.t('idle') : ctl.t('idle')),
      );
    }
    if (r.timeout) {
      return _ErrorCard(title: ctl.t('errTimeoutTitle'), message: ctl.timeoutText());
    }
    if (!r.ok) {
      return _ErrorCard(
        title: ctl.t('errQueryTitle'),
        message: r.message ?? '',
        detail: r.detail != null && r.detail != r.message ? '${ctl.t('sqliteSaid')}: ${r.detail}' : null,
      );
    }
    final summary = Text(ctl.summary(r), style: const TextStyle(color: Palette.inkFaint, fontSize: 12.5));
    if (!r.producedRows) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        summary,
        const SizedBox(height: 8),
        _Placeholder(icon: Icons.check, text: ctl.t('noColumns')),
      ]);
    }
    if (r.rows.isEmpty) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        summary,
        const SizedBox(height: 8),
        Section(children: [
          Text(ctl.t('noRowsTitle'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(ctl.t('noRowsHelp'), style: const TextStyle(color: Palette.inkDim, height: 1.4)),
          const SizedBox(height: 8),
          Text(r.columns.join(', '), style: const TextStyle(fontFamily: mono, color: Palette.inkFaint, fontSize: 12)),
        ]),
      ]);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          Expanded(child: summary),
          TextButton.icon(
            onPressed: () {
              ctl.pinResult();
              showNote(context, ctl.t('pinned'));
            },
            icon: const Icon(Icons.push_pin_outlined, size: 18),
            label: Text(ctl.t('pin'), style: const TextStyle(fontSize: 12.5)),
          ),
        ]),
        if (r.truncated) ...[
          Text(ctl.t('truncated', [r.rows.length]), style: const TextStyle(color: Palette.amber, fontSize: 12.5)),
          const SizedBox(height: 6),
        ],
        ResultTable(columns: r.columns, rows: r.rows),
      ],
    );
  }
}

class _CheckBanner extends StatelessWidget {
  const _CheckBanner({required this.ctl, required this.banner});
  final LevelController ctl;
  final CheckBanner banner;

  @override
  Widget build(BuildContext context) {
    final color = banner.passed ? Palette.ok : Palette.danger;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: banner.passed ? Palette.okWash : Palette.dangerWash,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(banner.passed ? Icons.check_circle : Icons.info_outline, color: color),
          const SizedBox(width: 10),
          Expanded(child: Text(banner.text, style: TextStyle(color: color, height: 1.35))),
          if (banner.showNext)
            TextButton(
              onPressed: ctl.goToNextLesson,
              child: Text(ctl.t('nextLesson'), style: const TextStyle(color: Palette.ok)),
            ),
        ],
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Palette.line),
        ),
        child: Column(children: [
          Icon(icon, color: Palette.inkFaint, size: 30),
          const SizedBox(height: 8),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Palette.inkDim, height: 1.4)),
        ]),
      );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.title, required this.message, this.detail});
  final String title;
  final String message;
  final String? detail;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Palette.dangerWash,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Palette.danger.withValues(alpha: 0.6)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.error_outline, color: Palette.danger, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title,
                    style: const TextStyle(color: Palette.danger, fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ]),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(color: Palette.ink, height: 1.4)),
            if (detail != null) ...[
              const SizedBox(height: 8),
              Text(detail!, style: const TextStyle(fontFamily: mono, color: Palette.inkFaint, fontSize: 12)),
            ],
          ],
        ),
      );
}

/// A scrollable results grid. Text only, so data can never run as code.
class ResultTable extends StatelessWidget {
  const ResultTable({super.key, required this.columns, required this.rows});
  final List<String> columns;
  final List<List<Object?>> rows;

  @override
  Widget build(BuildContext context) {
    const cellPad = EdgeInsets.symmetric(horizontal: 10, vertical: 8);
    Widget cell(Object? v) {
      if (v == null) {
        return const Padding(
          padding: cellPad,
          child: Text('NULL', style: TextStyle(fontFamily: mono, fontSize: 12.5, color: Palette.inkFaint, fontStyle: FontStyle.italic)),
        );
      }
      final text = v is Uint8List ? '<blob ${v.length} bytes>' : '$v';
      return Padding(
        padding: cellPad,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 260),
          child: Text(
            text,
            style: TextStyle(fontFamily: mono, fontSize: 12.5, color: v is num ? Palette.amberStrong : Palette.ink, height: 1.3),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Palette.codeBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Palette.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Table(
          defaultColumnWidth: const IntrinsicColumnWidth(),
          border: const TableBorder(
            horizontalInside: BorderSide(color: Palette.line, width: 0.6),
            verticalInside: BorderSide(color: Palette.line, width: 0.6),
          ),
          children: [
            TableRow(
              decoration: const BoxDecoration(color: Palette.panel2),
              children: [
                for (final c in columns)
                  Padding(
                    padding: cellPad,
                    child: Text(c,
                        style: const TextStyle(
                            fontFamily: mono, fontSize: 12.5, color: Palette.amber, fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
            for (final (i, row) in rows.indexed)
              TableRow(
                decoration: BoxDecoration(color: i.isOdd ? Palette.bgRaise : null),
                children: [for (final v in row) cell(v)],
              ),
          ],
        ),
      ),
    );
  }
}
