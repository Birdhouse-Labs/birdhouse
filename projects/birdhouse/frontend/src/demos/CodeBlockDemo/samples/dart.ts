// ABOUTME: Dart code sample for syntax highlighting demo
// ABOUTME: Demonstrates Flutter widgets, async streams, null safety, and cascades

import type { CodeSample } from "./types";

export const dart: CodeSample = {
  id: "dart",
  name: "Dart",
  language: "dart",
  description: "A Flutter widget that manages developer motivation with streams and null safety",
  code: `// Flutter widget for tracking developer motivation levels
// Now with 100% more null safety (because Dart 3 doesn't trust you)

import 'dart:async';
import 'package:flutter/material.dart';

class MotivationLevel {
  final double energy; // 0.0 to 1.0 (realistically: 0.2 to 0.4)
  final String status;
  final DateTime? lastCoffeeTime; // Nullable because sometimes we forget
  final List<String> excuses;
  
  const MotivationLevel({
    required this.energy,
    required this.status,
    this.lastCoffeeTime,
    this.excuses = const [],
  });

  // Cascade operator: because one function call is never enough
  MotivationLevel copyWith({
    double? energy,
    String? status,
    DateTime? lastCoffeeTime,
  }) => MotivationLevel(
        energy: energy ?? this.energy,
        status: status ?? this.status,
        lastCoffeeTime: lastCoffeeTime ?? this.lastCoffeeTime,
        excuses: excuses,
      );
}

class DeveloperMotivationTracker extends StatefulWidget {
  final String developerName;
  
  const DeveloperMotivationTracker({
    super.key,
    required this.developerName,
  });

  @override
  State<DeveloperMotivationTracker> createState() => 
      _DeveloperMotivationTrackerState();
}

class _DeveloperMotivationTrackerState 
    extends State<DeveloperMotivationTracker> {
  final StreamController<MotivationLevel> _motivationStream = 
      StreamController<MotivationLevel>.broadcast();
  
  late Timer _decayTimer;
  double _currentEnergy = 0.8; // Optimistic starting value

  @override
  void initState() {
    super.initState();
    _startMotivationDecay();
  }

  void _startMotivationDecay() {
    // Motivation decays naturally every 30 minutes (it's a feature, not a bug)
    _decayTimer = Timer.periodic(
      const Duration(minutes: 30),
      (_) => _decreaseMotivation(),
    );
  }

  Future<void> _drinkCoffee() async {
    setState(() => _currentEnergy = (_currentEnergy + 0.3).clamp(0.0, 1.0));
    
    // Simulate coffee taking effect (optimistically fast)
    await Future.delayed(const Duration(seconds: 2));
    
    _motivationStream.add(MotivationLevel(
      energy: _currentEnergy,
      status: _getStatus(),
      lastCoffeeTime: DateTime.now(),
      excuses: _currentEnergy < 0.3 
          ? ['Need more coffee', 'Prod is down', 'Meetings']
          : [],
    ));
  }

  void _decreaseMotivation() {
    setState(() {
      _currentEnergy = (_currentEnergy - 0.15).clamp(0.0, 1.0);
      _motivationStream.add(MotivationLevel(
        energy: _currentEnergy,
        status: _getStatus(),
        excuses: ['Time has passed', 'Existence'],
      ));
    });
  }

  String _getStatus() {
    return switch (_currentEnergy) {
      >= 0.8 => '🚀 Ready to rewrite everything in Rust!',
      >= 0.5 => '💻 Can probably fix that bug',
      >= 0.3 => '😐 Copy-pasting from StackOverflow',
      _ => '☠️ Googling "how to quit programming"',
    };
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<MotivationLevel>(
      stream: _motivationStream.stream,
      builder: (context, snapshot) {
        final motivation = snapshot.data;
        
        return Column(
          children: [
            Text('\${widget.developerName}'s Motivation'),
            LinearProgressIndicator(value: _currentEnergy),
            Text(motivation?.status ?? 'Initializing...'),
            if (motivation?.excuses.isNotEmpty ?? false)
              ...motivation!.excuses.map((e) => Text('• $e')),
            ElevatedButton(
              onPressed: _drinkCoffee,
              child: const Text('☕ Emergency Coffee'),
            ),
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    _decayTimer.cancel();
    _motivationStream.close();
    super.dispose();
  }
}`,
};
