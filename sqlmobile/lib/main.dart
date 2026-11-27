import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'src/state/controllers.dart';
import 'src/ui/home_screen.dart';
import 'src/ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Palette.bgRaise,
    systemNavigationBarColor: Palette.bgRaise,
  ));
  runApp(const SqlDetectiveApp());
}

class SqlDetectiveApp extends StatefulWidget {
  const SqlDetectiveApp({super.key});

  @override
  State<SqlDetectiveApp> createState() => _SqlDetectiveAppState();
}

class _SqlDetectiveAppState extends State<SqlDetectiveApp> {
  late Future<AppState> _app = AppState.load();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SQL Detective',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: FutureBuilder<AppState>(
        future: _app,
        builder: (context, snap) {
          if (snap.hasData) return HomeScreen(app: snap.data!);
          if (snap.hasError) {
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.error_outline, color: Palette.danger, size: 40),
                    const SizedBox(height: 12),
                    Text('${snap.error}', textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => setState(() => _app = AppState.load()),
                      child: const Text('Try again'),
                    ),
                  ]),
                ),
              ),
            );
          }
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        },
      ),
    );
  }
}
