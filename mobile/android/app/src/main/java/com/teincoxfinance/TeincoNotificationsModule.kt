package com.teincoxfinance

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class TeincoNotificationsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val CHANNEL_ID = "workspace_alerts"
    private const val CHANNEL_NAME = "Workspace alerts"
  }

  override fun getName() = "TeincoNotifications"

  @ReactMethod
  fun show(id: String, title: String, message: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    createChannel()
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.teinco_mark)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()
    NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Attendance and workspace updates from Teinco-X"
      }
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }
}
