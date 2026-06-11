import 'package:flutter_test/flutter_test.dart';

import 'package:kora_mobile/main.dart';

void main() {
  testWidgets('App boots without crashing', (tester) async {
    await tester.pumpWidget(const KoraApp());
    await tester.pump();
    // Smoke test: app widget tree builds without throwing.
    expect(find.byType(KoraApp), findsOneWidget);
  });
}
