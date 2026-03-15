package com.renfi

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ExitAppModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "ExitApp"

    @ReactMethod
    fun exit() {
        val activity = currentActivity ?: return
        activity.finishAndRemoveTask()
        android.os.Process.killProcess(android.os.Process.myPid())
    }
}
