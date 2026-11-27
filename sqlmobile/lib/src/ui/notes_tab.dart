import 'package:flutter/material.dart';

import '../state/controllers.dart';
import 'theme.dart';

class NotesTab extends StatelessWidget {
  const NotesTab({super.key, required this.ctl});
  final LevelController ctl;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ctl.t('notesHeading'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(ctl.t('notesLabel'), style: const TextStyle(color: Palette.inkDim)),
          const SizedBox(height: 10),
          Expanded(
            child: TextField(
              controller: ctl.notes,
              expands: true,
              maxLines: null,
              textAlignVertical: TextAlignVertical.top,
              keyboardType: TextInputType.multiline,
              style: const TextStyle(height: 1.45, fontSize: 14.5),
              decoration: InputDecoration(
                hintText: ctl.text.s('notesPlaceholder'),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
