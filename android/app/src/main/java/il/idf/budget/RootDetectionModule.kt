package il.idf.budget

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File

class RootDetectionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "RootDetection"

    @ReactMethod
    fun isRooted(promise: Promise) {
        promise.resolve(checkRooted())
    }

    private fun checkRooted(): Boolean {
        return checkBuildTags()
            || checkSuBinaries()
            || checkRootApps()
            || checkDangerousProps()
            || checkWritableSystem()
    }

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
            "com.topjohnwu.magisk",         // Magisk
            "com.noshufou.android.su",       // Superuser
            "com.noshufou.android.su.elite",
            "eu.chainfire.supersu",          // SuperSU
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
}
