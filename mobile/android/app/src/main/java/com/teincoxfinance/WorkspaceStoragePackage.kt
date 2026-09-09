package com.teincoxfinance

import android.webkit.CookieManager
import android.webkit.WebStorage
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager

class WorkspaceStorageModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "WorkspaceStorage"

  @ReactMethod
  fun clear(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        // WebView incognito mode alone does not clear Android DOM storage.
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies {
          CookieManager.getInstance().flush()
          promise.resolve(null)
        }
      } catch (error: Exception) {
        promise.reject("WORKSPACE_STORAGE", "Could not clear the web workspace session", error)
      }
    }
  }
}

class WorkspaceStoragePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(WorkspaceStorageModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
