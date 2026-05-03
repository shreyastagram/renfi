# ============================================
# Fixhomi ProGuard / R8 Rules
# ============================================
# These rules ensure native libraries work correctly
# when R8/ProGuard minification is enabled in release builds.

# ── React Native (Hermes) ──
# Hermes bytecode is already compiled — no JS minification needed.
# But keep the native bridge classes.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.hermes.**

# ── React Native core ──
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * { void set*(***); *** get*(); }
-dontwarn com.facebook.react.**

# ── Razorpay ──
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/*
-keepclasseswithmembers class * { public void onPayment*(...); }

# ── Firebase / Google Play Services ──
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Mapbox ──
-keep class com.mapbox.** { *; }
-dontwarn com.mapbox.**

# ── OkHttp (used by many native libs) ──
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Gson (used by some native libs) ──
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# ── React Native Screens ──
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# ── React Native Gesture Handler ──
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# ── React Native Reanimated (if used by dependencies) ──
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# ── Notifee ──
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# ── React Native Keychain ──
-keep class com.oblador.keychain.** { *; }
-dontwarn com.oblador.keychain.**

# ── Custom Fixhomi native modules ──
-keep class com.renfi.ExitAppModule { *; }
-keep class com.renfi.ExitAppPackage { *; }

# ── React Native Config ──
-keep class com.lugg.RNCConfig.** { *; }
-dontwarn com.lugg.RNCConfig.**

# ── React Native Device Info ──
-keep class com.learnium.RNDeviceInfo.** { *; }
-dontwarn com.learnium.RNDeviceInfo.**

# ── React Native Blob Util ──
-keep class com.ReactNativeBlobUtil.** { *; }
-dontwarn com.ReactNativeBlobUtil.**

# ── React Native Image Picker ──
-keep class com.imagepicker.** { *; }
-dontwarn com.imagepicker.**

# ── React Native Share ──
-keep class cl.json.** { *; }
-dontwarn cl.json.**

# ── React Native Maps ──
-keep class com.rnmaps.maps.** { *; }
-dontwarn com.rnmaps.maps.**

# ── React Native Permissions ──
-keep class com.zoontek.rnpermissions.** { *; }
-dontwarn com.zoontek.rnpermissions.**

# ── React Native SVG ──
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# ── React Native Background Timer ──
-keep class com.ocetnik.timer.** { *; }
-dontwarn com.ocetnik.timer.**

# ── TransistorSoft Background Geolocation ──
-keep class com.transistorsoft.** { *; }
-dontwarn com.transistorsoft.**
-keep class org.greenrobot.eventbus.** { *; }
-dontwarn org.greenrobot.eventbus.**

# ── Invertase Firebase (RNFB) ──
-keep class io.invertase.** { *; }
-dontwarn io.invertase.**

# ── Google Sign-In ──
-keep class com.google.android.gms.auth.** { *; }

# ── AndroidX / Fragments (prevent restoration crash) ──
-keep class androidx.fragment.** { *; }
-keep class androidx.lifecycle.** { *; }

# ── Keep native module names for React Native bridge ──
-keepnames class * extends com.facebook.react.bridge.ReactContextBaseJavaModule

# ── Keep all TurboModules (New Architecture) ──
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.turbomodule.core.interfaces.TurboModule { *; }

# ── Keep enums ──
-keepclassmembers enum * { *; }

# ── Suppress warnings for optional dependencies ──
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.**

# ============================================
# In-app calling (demo branch only — LiveKit + WebRTC + CallKeep)
# ============================================
# All three of these are JNI-heavy: registerGlobals() on the LiveKit RN
# side reaches into org.webrtc via reflection at module load, so any
# class R8 strips here surfaces as a crash on the very first JS module
# resolve — i.e. the app dies before App.tsx even mounts. Keep the
# packages whole, including native methods, and silence the optional
# transitive-API warnings so the build stays clean.

# WebRTC core (forked by LiveKit) — heavy JNI, must keep wholesale.
-keep class org.webrtc.** { *; }
-keep interface org.webrtc.** { *; }
-keepclasseswithmembers class org.webrtc.** {
    native <methods>;
}
-dontwarn org.webrtc.**

# React Native WebRTC bridge module (com.oney.WebRTCModule).
-keep class com.oney.WebRTCModule.** { *; }
-dontwarn com.oney.WebRTCModule.**

# LiveKit React Native bridge — registerGlobals + AudioSession entry points.
-keep class com.livekit.reactnative.** { *; }
-keep interface com.livekit.reactnative.** { *; }
-dontwarn com.livekit.reactnative.**

# CallKeep — VoiceConnectionService is wired in via Telecom reflection.
-keep class io.wazo.callkeep.** { *; }
-dontwarn io.wazo.callkeep.**

# LiveKit upstream protocol classes (referenced via reflection in some paths).
-keep class livekit.** { *; }
-dontwarn livekit.**
