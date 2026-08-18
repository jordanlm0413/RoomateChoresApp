# Roomie Rhythm

Roommate chore planning app built with Flutter.

## Codemagic iOS build

This repository includes `codemagic.yaml` for a signed iOS release build.

Before starting the workflow in Codemagic:

1. Connect this repository to Codemagic.
2. Create or select the App Store Connect API integration.
3. Add the iOS signing certificate and provisioning profile for `com.roomierhythm.app`.
4. Start the `ios-release` workflow.

The workflow builds an IPA and submits it to TestFlight. Apple Developer and App Store Connect access are still required.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
