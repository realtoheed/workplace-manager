import 'package:flutter_test/flutter_test.dart';
import 'package:workplace_manager/main.dart';

void main() {
  testWidgets('App loads login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const WorkplaceManagerApp());
    await tester.pump();
    expect(find.text('Workplace Manager'), findsOneWidget);
  });
}
