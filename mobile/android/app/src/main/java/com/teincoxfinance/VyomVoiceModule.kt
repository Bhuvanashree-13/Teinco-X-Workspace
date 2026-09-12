package com.teincoxfinance

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class VyomVoiceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), RecognitionListener, TextToSpeech.OnInitListener {
  private var recognizer: SpeechRecognizer? = null
  private var tts: TextToSpeech? = null
  private var ttsReady = false
  private var pendingSpeech: String? = null
  override fun getName() = "VyomVoice"
  private fun emit(name: String, value: String) {
    val payload = Arguments.createMap().apply { putString("value", value) }
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)
  }
  @ReactMethod fun startListening(promise: Promise) {
    context.runOnUiQueueThread {
      if (!SpeechRecognizer.isRecognitionAvailable(context)) { promise.reject("VOICE_UNAVAILABLE", "Speech recognition is unavailable"); return@runOnUiQueueThread }
      recognizer?.destroy()
      recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(this) }
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      }
      recognizer?.startListening(intent); promise.resolve(true)
    }
  }
  @ReactMethod fun stopListening() { context.runOnUiQueueThread { recognizer?.stopListening() } }
  @ReactMethod fun speak(text: String, promise: Promise) {
    context.runOnUiQueueThread {
      if (text.isBlank()) { promise.resolve(false); return@runOnUiQueueThread }
      if (ttsReady) {
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "vyom-response")
      } else {
        pendingSpeech = text
        if (tts == null) tts = TextToSpeech(context, this)
      }
      promise.resolve(true)
    }
  }
  @ReactMethod fun stopSpeaking() { pendingSpeech = null; tts?.stop() }
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      ttsReady = true
      tts?.language = Locale.forLanguageTag("en-IN")
      tts?.setSpeechRate(0.95f)
      pendingSpeech?.let { text -> tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "vyom-response") }
      pendingSpeech = null
    } else {
      pendingSpeech = null
      emit("VyomVoiceError", "Text-to-speech initialization failed")
    }
  }
  override fun onResults(results: Bundle) { emit("VyomVoiceResult", results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()) }
  override fun onError(error: Int) { emit("VyomVoiceError", error.toString()) }
  override fun onReadyForSpeech(params: Bundle) { emit("VyomVoiceState", "listening") }
  override fun onEndOfSpeech() { emit("VyomVoiceState", "processing") }
  override fun onBeginningOfSpeech() {}
  override fun onRmsChanged(rmsdB: Float) {}
  override fun onBufferReceived(buffer: ByteArray) {}
  override fun onPartialResults(partialResults: Bundle) {}
  override fun onEvent(eventType: Int, params: Bundle) {}
  override fun invalidate() { recognizer?.destroy(); tts?.shutdown(); ttsReady = false; pendingSpeech = null; super.invalidate() }
}
