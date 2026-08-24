# Roomie Rhythm

Roommate chore planning app built with Flutter.

## Cloud Web Deployment

This project is now streamlined for Flutter Web hosting.

### 1. Build the Flutter web app

From the project root:

```bash
flutter build web --release
```

### 2. Deploy the web app to Firebase Hosting

From the project root:

```bash
firebase login
firebase init hosting
firebase deploy --only hosting
```

`firebase.json` is included and configured to serve `build/web` with SPA rewrites.

### Current functionality behavior

The app continues to preserve current functionality as-is. Data handling in `lib/api_service.dart` remains local-first (via app storage), so behavior is unchanged after deploying to the cloud-hosted web page.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
