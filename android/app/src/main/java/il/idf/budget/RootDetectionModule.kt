package il.idf.budget

import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.BufferedReader
import java.io.File
import java.io.FileReader

class RootDetectionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "RootDetection"

    @ReactMethod
    fun isRooted(promise: Promise) {
        promise.resolve(checkRooted())
    }

    @ReactMethod
    fun isTampered(promise: Promise) {
        // Returns true if a dynamic instrumentation or hooking framework is detected
        promise.resolve(
            checkFridaFiles()
                || checkFridaMaps()
                || checkXposed()
                || checkHookingFrameworks()
                || checkDebuggerAttached()
        )
    }

    @ReactMethod
    fun isEmulator(promise: Promise) {
        promise.resolve(checkEmulator())
    }

    private fun checkRooted(): Boolean {
        return checkBuildTags()
            || checkSuBinaries()
            || checkRootApps()
            || checkDangerousProps()
            || checkWritableSystem()
    }

    // ─── Root checks ────────────────────────────────────────────────────────────

    // Rooted ROMs are usually built with "test-keys" instead of "release-keys"
    private fun checkBuildTags(): Boolean {
        val tags = Build.TAGS ?: return false
        return tags.contains("test-keys")
    }

    // Common locations where su binary lives on rooted devices
    private fun checkSuBinaries(): Boolean {
        val paths = arrayOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/system/su", "/system/bin/.ext/.su", "/system/usr/we-need-root/su",
            "/system/app/Superuser.apk", "/system/app/SuperSU.apk",
            "/data/local/su", "/data/local/xbin/su", "/data/local/bin/su",
        )
        return paths.any { File(it).exists() }
    }

    // Known root management apps
    private fun checkRootApps(): Boolean {
        val pkgs = arrayOf(
            "com.topjohnwu.magisk",
            "com.noshufou.android.su",
            "com.noshufou.android.su.elite",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.thirdparty.superuser",
            "com.yellowes.su",
            "com.kingroot.kinguser",
            "com.kingo.root",
            "com.smedialink.oneclickroot",
            "com.zhiqupk.root.global",
            "com.alephzain.framaroot",
        )
        val pm = reactApplicationContext.packageManager
        return pkgs.any { pkg ->
            try { pm.getPackageInfo(pkg, 0); true } catch (e: Exception) { false }
        }
    }

    // ro.debuggable and ro.secure are altered on rooted devices
    private fun checkDangerousProps(): Boolean {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("/system/bin/getprop"))
            val output = process.inputStream.bufferedReader().readText()
            output.contains("[ro.debuggable]: [1]") || output.contains("[ro.secure]: [0]")
        } catch (e: Exception) { false }
    }

    // On stock ROMs /system is mounted read-only; root breaks this
    private fun checkWritableSystem(): Boolean {
        return try {
            val file = File("/system/test_rw_${System.currentTimeMillis()}")
            val created = file.createNewFile()
            if (created) file.delete()
            created
        } catch (e: Exception) { false }
    }

    // ─── Frida / dynamic instrumentation checks ─────────────────────────────────

    // Frida drops native libraries in known locations on disk
    private fun checkFridaFiles(): Boolean {
        val fridaPaths = arrayOf(
            "/data/local/tmp/frida-server",
            "/data/local/tmp/re.frida.server",
            "/system/bin/frida-server",
            "/system/xbin/frida-server",
            "/data/local/tmp/frida-agent.so",
            "/data/data/re.frida.server",
        )
        return fridaPaths.any { File(it).exists() }
    }

    // Frida injects a gadget that appears in /proc/self/maps
    private fun checkFridaMaps(): Boolean {
        return try {
            BufferedReader(FileReader("/proc/self/maps")).useLines { lines ->
                lines.any { line ->
                    line.contains("frida", ignoreCase = true) ||
                    line.contains("gadget", ignoreCase = true) ||
                    line.contains("linjector", ignoreCase = true)
                }
            }
        } catch (e: Exception) { false }
    }

    // ─── Xposed / hooking framework checks ──────────────────────────────────────

    // Xposed installs a special jar that appears in the stack trace of every method
    private fun checkXposed(): Boolean {
        return try {
            throw Exception("xposed_check")
        } catch (e: Exception) {
            e.stackTrace.any { frame ->
                frame.className.startsWith("de.robv.android.xposed") ||
                frame.className.startsWith("com.saurik.substrate")
            }
        }
    }

    // Cydia Substrate and RootCloak leave files or packages on disk
    private fun checkHookingFrameworks(): Boolean {
        val files = arrayOf(
            "/system/lib/libsubstrate.so",
            "/system/lib/libsubstrate-dvm.so",
            "/data/app/com.saurik.substrate-1.apk",
        )
        if (files.any { File(it).exists() }) return true

        val pkgs = arrayOf(
            "com.saurik.substrate",   // Cydia Substrate
            "com.devadvance.rootcloak",
            "com.devadvance.rootcloakplus",
            "de.robv.android.xposed.installer",
            "org.meowcat.edxposed.manager",
            "io.github.lsposed.manager",
        )
        val pm = reactApplicationContext.packageManager
        return pkgs.any { pkg ->
            try { pm.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES); true } catch (e: Exception) { false }
        }
    }

    // ─── Debugger check ─────────────────────────────────────────────────────────

    private fun checkDebuggerAttached(): Boolean {
        return Debug.isDebuggerConnected() || Debug.waitingForDebugger()
    }

    // ─── Emulator detection ─────────────────────────────────────────────────────

    // Returns true when 3 or more emulator indicators are present (reduces false positives)
    private fun checkEmulator(): Boolean {
        var score = 0

        val fingerprint = Build.FINGERPRINT ?: ""
        if (fingerprint.startsWith("generic") ||
            fingerprint.contains("vbox") ||
            fingerprint.contains("test-keys") ||
            fingerprint.contains("sdk_gphone")
        ) score++

        val model = (Build.MODEL ?: "").lowercase()
        if (model.contains("emulator") || model.contains("android sdk") || model.contains("sdk")) score++

        val manufacturer = (Build.MANUFACTURER ?: "").lowercase()
        if (manufacturer == "genymotion" || manufacturer.contains("unknown")) score++

        val hardware = (Build.HARDWARE ?: "").lowercase()
        if (hardware.contains("goldfish") || hardware.contains("ranchu") || hardware.contains("vbox")) score++

        val product = (Build.PRODUCT ?: "").lowercase()
        if (product == "sdk" || product.contains("emulator") || product.contains("sdk_gphone")) score++

        return score >= 3
    }
}
