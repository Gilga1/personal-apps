package com.personal.wearlog

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

data class LogResult(
    val ok: Boolean,
    val summary: String,
)

class LogApi(
    private val baseUrl: String,
    private val token: String,
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build()

    fun postUtterance(text: String): LogResult {
        if (token.isBlank()) {
            return LogResult(false, "Set DEVICE_API_TOKEN in gradle.properties")
        }
        val payload = JSONObject()
            .put("text", text)
            .put("idempotency_key", "watch-${UUID.randomUUID()}")
            .put("timezone", "Asia/Kolkata")
            .put("device", "galaxy_watch_5")
            .toString()

        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/utterances")
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                return LogResult(false, "HTTP ${response.code}: ${body.take(120)}")
            }
            val json = JSONObject(body)
            val events = json.optJSONArray("events")
            if (events == null || events.length() == 0) {
                return LogResult(true, "Logged (no events)")
            }
            val parts = mutableListOf<String>()
            for (i in 0 until events.length()) {
                val e = events.getJSONObject(i)
                val activity = e.optString("activity", e.optString("event_type"))
                val status = e.optString("status")
                val note = e.optString("notion_note", "")
                parts.add("$activity:$status")
                if (note.isNotBlank()) parts.add(note.take(40))
            }
            return LogResult(true, parts.joinToString(" · "))
        }
    }
}
