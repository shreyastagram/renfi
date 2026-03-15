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

# ── Keep native module names for React Native bridge ──
-keepnames class * extends com.facebook.react.bridge.ReactContextBaseJavaModule

# ── Keep enums ──
-keepclassmembers enum * { *; }

# ── Suppress warnings for optional dependencies ──
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.**
