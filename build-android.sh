#!/bin/bash

# build-android.sh - Script to build the Stripe Terminal POS Ionic app for Android

# Exit on error
set -e

echo "===== Building Stripe Terminal POS for Android ====="

# Store current directory
PROJECT_ROOT=$(pwd)

# Set JAVA_HOME for Android build
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
echo "Using Java from: $JAVA_HOME"

# 1. Build web application
echo "Step 1: Building web application..."
ionic build

# 2. Check if Android platform exists, add if not
echo "Step 2: Checking if Android platform is added..."
if [ ! -d "android" ]; then
    echo "Android platform not found, adding it..."
    npx cap add android
else
    echo "Android platform already exists."
fi

# 3. Sync web build to Android platform
echo "Step 3: Syncing web build to Android platform..."
ionic cap sync android

# 4. Build Android APK
echo "Step 4: Building Android APK..."
cd android
./gradlew assembleDebug

# Check if build was successful
if [ -f app/build/outputs/apk/debug/app-debug.apk ]; then
    echo "===== Build successful! ====="
    echo "APK location: ${PROJECT_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
    
    # Get APK size
    APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | cut -f1)
    echo "APK size: $APK_SIZE"
    
    # Optional: Copy APK to project root for easier access
    cp app/build/outputs/apk/debug/app-debug.apk "${PROJECT_ROOT}/stripe-terminal-pos.apk"
    echo "APK also copied to: ${PROJECT_ROOT}/stripe-terminal-pos.apk"
else
    echo "===== Build failed! ====="
    echo "APK not found at expected location."
    exit 1
fi

# Return to original directory
cd "$PROJECT_ROOT"