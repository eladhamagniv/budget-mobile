# ─── React Native ─────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ─── Expo ─────────────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# ─── Firebase ─────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── OkHttp / Retrofit ────────────────────────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ─── Root detection module ────────────────────────────────────────────────────
-keep class il.idf.budget.RootDetectionModule { *; }
-keep class il.idf.budget.RootDetectionPackage { *; }

# ─── Keep our app package ─────────────────────────────────────────────────────
-keep class il.idf.budget.** { *; }

# ─── Crypto / Security ────────────────────────────────────────────────────────
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }

# ─── General ──────────────────────────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-dontwarn java.lang.invoke.**
-dontwarn **$$Lambda$*
