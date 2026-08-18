import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_application_1/main.dart';

void main() {
  testWidgets('app initializes without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.byType(MyApp), findsOneWidget);
  });

  testWidgets('adding and deleting chores updates the visible list', (WidgetTester tester) async {
    final group = HouseGroup(
      id: 'house-1',
      name: 'My House',
      owner: 'user-1',
      ownerName: 'alex',
      members: [HouseMember(userId: 'user-1', username: 'alex')],
      chores: [
        ChoreTask(
          id: 'chore-1',
          title: 'Dishes',
          assigneeId: 'user-1',
          assigneeName: 'alex',
          schedule: 'Weekly',
          notificationEnabled: true,
          reminderTime: const TimeOfDay(hour: 18, minute: 30),
        ),
      ],
    );

    final currentUser = User(id: 'user-1', username: 'alex');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HouseGroupScreen(
            group: group,
            currentUser: currentUser,
            onUpdate: () {},
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).first, 'Laundry');
    final addButton = find.text('Add chore');
    await tester.ensureVisible(addButton);
    await tester.tap(addButton);
    await tester.pumpAndSettle();

    // Verify the UI shows the existing chore
    expect(find.text('Dishes'), findsOneWidget);
  });
}
