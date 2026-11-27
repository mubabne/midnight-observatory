import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

/// Renders `code` and **bold** inside level text, like the web's richText().
class Rich extends StatelessWidget {
  const Rich(this.text, {super.key, this.style});
  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final base = style ?? const TextStyle(color: Palette.ink, fontSize: 15, height: 1.45);
    final spans = <InlineSpan>[];
    final re = RegExp(r'(`[^`]+`|\*\*[^*]+\*\*)');
    var last = 0;
    for (final m in re.allMatches(text)) {
      if (m.start > last) spans.add(TextSpan(text: text.substring(last, m.start)));
      final part = m.group(0)!;
      if (part.startsWith('`')) {
        spans.add(TextSpan(
          text: part.substring(1, part.length - 1),
          style: const TextStyle(
            fontFamily: mono,
            color: Palette.amberStrong,
            backgroundColor: Palette.codeBg,
            fontSize: 13.5,
          ),
        ));
      } else {
        spans.add(TextSpan(text: part.substring(2, part.length - 2), style: const TextStyle(fontWeight: FontWeight.w700)));
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return Text.rich(TextSpan(style: base, children: spans));
  }
}

/// A block of SQL with optional Load and Copy actions.
class SqlBlock extends StatelessWidget {
  const SqlBlock(this.sql, {super.key, this.onLoad, this.loadLabel});
  final String sql;
  final VoidCallback? onLoad;
  final String? loadLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Palette.codeBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Palette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: SelectableText(
              sql.trimRight(),
              style: const TextStyle(fontFamily: mono, fontSize: 13, color: Palette.ink, height: 1.4),
            ),
          ),
          if (onLoad != null)
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
                child: TextButton.icon(
                  onPressed: onLoad,
                  icon: const Icon(Icons.input, size: 18),
                  label: Text(loadLabel ?? 'Load'),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Small uppercase label, like the web's stamps and eyebrows.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color = Palette.amber});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: TextStyle(color: color, fontSize: 11.5, letterSpacing: 1.2, fontWeight: FontWeight.w600),
      );
}

class Stamp extends StatelessWidget {
  const Stamp(this.text, {super.key, this.color = Palette.danger});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          border: Border.all(color: color, width: 1.5),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          text.toUpperCase(),
          style: TextStyle(color: color, fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w700),
        ),
      );
}

/// A titled panel.
class Section extends StatelessWidget {
  const Section({super.key, this.title, required this.children, this.padding = const EdgeInsets.all(16)});
  final String? title;
  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (title != null) ...[
                Text(title!, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
              ],
              ...children,
            ],
          ),
        ),
      );
}

Future<void> copyToClipboard(BuildContext context, String text, String done) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(done), duration: const Duration(seconds: 2)));
  }
}

void showNote(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String body,
  required String keep,
  required String proceed,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: const TextStyle(fontFamily: serif)),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(keep)),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Palette.danger),
          onPressed: () => Navigator.pop(c, true),
          child: Text(proceed),
        ),
      ],
    ),
  );
  return ok == true;
}
