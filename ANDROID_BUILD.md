# CREDIT LOGGER — Android Build & Capacitor Guide

CREDIT LOGGER is built as an offline-first Progressive Web App (PWA) using React, TypeScript, Vite, Tailwind CSS, and IndexedDB, and is structured for native Android packaging via **Capacitor**.

## Prerequisites
- Node.js 20+
- Android Studio (with Android SDK Platform 34+ & Build Tools)
- Java JDK 17+

## 1. Install Capacitor & Native Plugins
Run the following in the project root:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/share @capacitor/filesystem @capacitor/local-notifications @capacitor-community/sqlite
```

## 2. Build the Web Bundle
```bash
npm run build
```

## 3. Add Android Platform & Sync
```bash
npx cap add android
npx cap sync android
```

## 4. Open in Android Studio & Build APK
```bash
npx cap open android
```
Inside Android Studio:
1. Wait for Gradle sync to complete.
2. For debug APK: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. For signed release APK/AAB: **Build > Generate Signed Bundle / APK...**.

## 5. Android SQLite & Native Bridges
The file `src/services/platform.ts` automatically detects `window.Capacitor?.isNativePlatform()`.
- On Web / PWA: Uses **IndexedDB**, **Web Share API**, **File Download**, and **Web Notifications**.
- On Capacitor Android: Bridges to `@capacitor/share`, `@capacitor/filesystem`, `@capacitor/local-notifications`, and `@capacitor-community/sqlite` when installed.

## 6. Permissions for `AndroidManifest.xml`
When using local notifications and file export on Android 13+:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```
