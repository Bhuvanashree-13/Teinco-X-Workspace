package com.teincoxfinance

import android.media.AudioManager
import android.media.ToneGenerator
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class SplashSoundModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SplashSound"

  @ReactMethod
  fun play() {
    val tone = ToneGenerator(AudioManager.STREAM_MUSIC, 18)
    tone.startTone(ToneGenerator.TONE_PROP_ACK, 120)
    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ tone.release() }, 220)
  }
}

class SplashSoundPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(SplashSoundModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
