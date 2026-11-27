import 'package:flutter/material.dart';

/// The web game's palette (src/styles.css).
class Palette {
  static const bg = Color(0xFF0A101D);
  static const bgRaise = Color(0xFF0F1728);
  static const panel = Color(0xFF131C2F);
  static const panel2 = Color(0xFF18233A);
  static const line = Color(0xFF27344F);
  static const lineStrong = Color(0xFF3A4A6B);
  static const ink = Color(0xFFEFE6D2);
  static const inkDim = Color(0xFFB7AE9B);
  static const inkFaint = Color(0xFF8B8471);
  static const amber = Color(0xFFE6AD4E);
  static const amberStrong = Color(0xFFF2BF63);
  static const amberInk = Color(0xFF1B1305);
  static const amberWash = Color(0x1FE6AD4E);
  static const ok = Color(0xFF93D3A2);
  static const okWash = Color(0x1F93D3A2);
  static const danger = Color(0xFFF39B8B);
  static const dangerWash = Color(0x1FF39B8B);
  static const codeBg = Color(0xFF0B1222);
}

const mono = 'monospace';
const serif = 'serif';

ThemeData buildTheme() {
  final scheme = const ColorScheme.dark(
    surface: Palette.bg,
    onSurface: Palette.ink,
    primary: Palette.amber,
    onPrimary: Palette.amberInk,
    secondary: Palette.amberStrong,
    onSecondary: Palette.amberInk,
    error: Palette.danger,
    onError: Palette.amberInk,
    surfaceContainerLowest: Palette.codeBg,
    surfaceContainerLow: Palette.bgRaise,
    surfaceContainer: Palette.panel,
    surfaceContainerHigh: Palette.panel2,
    surfaceContainerHighest: Palette.line,
    outline: Palette.lineStrong,
    outlineVariant: Palette.line,
    onSurfaceVariant: Palette.inkDim,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: Palette.bg);
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: Palette.ink, displayColor: Palette.ink).copyWith(
          headlineSmall: base.textTheme.headlineSmall?.copyWith(fontFamily: serif, color: Palette.ink),
          titleLarge: base.textTheme.titleLarge?.copyWith(fontFamily: serif, color: Palette.ink),
          titleMedium: base.textTheme.titleMedium?.copyWith(fontFamily: serif, color: Palette.ink),
        ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Palette.bgRaise,
      foregroundColor: Palette.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(fontFamily: serif, fontSize: 19, color: Palette.ink),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Palette.bgRaise,
      indicatorColor: Palette.amberWash,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 12,
          color: s.contains(WidgetState.selected) ? Palette.amber : Palette.inkDim,
          fontWeight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? Palette.amber : Palette.inkDim),
      ),
    ),
    cardTheme: const CardThemeData(
      color: Palette.panel,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(10)),
        side: BorderSide(color: Palette.line),
      ),
    ),
    dividerTheme: const DividerThemeData(color: Palette.line, space: 1),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Palette.codeBg,
      border: OutlineInputBorder(borderSide: BorderSide(color: Palette.line)),
      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Palette.line)),
      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Palette.amber, width: 1.5)),
      hintStyle: TextStyle(color: Palette.inkFaint),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Palette.amber,
        foregroundColor: Palette.amberInk,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Palette.ink,
        side: const BorderSide(color: Palette.lineStrong),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: Palette.amber)),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Palette.panel2,
      contentTextStyle: TextStyle(color: Palette.ink),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: const DialogThemeData(backgroundColor: Palette.panel),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Palette.panel),
    chipTheme: const ChipThemeData(
      backgroundColor: Palette.panel2,
      side: BorderSide(color: Palette.line),
      labelStyle: TextStyle(color: Palette.inkDim, fontSize: 12),
    ),
  );
}
