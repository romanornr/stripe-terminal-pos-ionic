# Building the Ionic App for Android

This document outlines the steps needed to build the Stripe Terminal POS Ionic app for Android.

## Prerequisites

- Installed Android Studio
- JDK 21 or newer (OpenJDK recommended)
- Proper `JAVA_HOME` configuration

## Build Steps

1. First, build the web application:
   ```bash
   ionic build
   ```

2. Sync the web build to the Android platform:
   ```bash
   ionic cap sync android
   ```

3. Build the Android APK:
   ```bash
   # Set JAVA_HOME if needed
   export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
   
   # Navigate to Android directory
   cd android
   
   # Build the debug APK
   ./gradlew assembleDebug
   ```

4. The built APK will be available at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

## Using Android Studio

Alternatively, you can open the project in Android Studio and build from there:

```bash
ionic cap open android
```

## Troubleshooting

### JAVA_HOME Issues

If you encounter JAVA_HOME errors, you can create an alias in your `.zshrc` or `.bashrc`:

```bash
echo 'alias android-dev="export JAVA_HOME=/usr/lib/jvm/java-21-openjdk"' >> ~/.zshrc
source ~/.zshrc
```

Then use `android-dev` before building:

```bash
android-dev
cd android && ./gradlew assembleDebug
```

This keeps your system's default Java configuration intact for other applications.