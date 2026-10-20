package com.personal.wearlog

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val api = LogApi(BuildConfig.API_BASE_URL, BuildConfig.DEVICE_API_TOKEN)
        setContent {
            MaterialTheme {
                LogScreen(api = api)
            }
        }
    }
}

@Composable
private fun LogScreen(api: LogApi) {
    var status by remember { mutableStateOf("Tap LOG and speak") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val voiceLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) {
            status = "Cancelled"
            return@rememberLauncherForActivityResult
        }
        val spoken = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
            ?.trim()
        if (spoken.isNullOrBlank()) {
            status = "No speech captured"
            return@rememberLauncherForActivityResult
        }
        status = "Sending…"
        busy = true
        scope.launch {
            val logResult = withContext(Dispatchers.IO) {
                runCatching { api.postUtterance(spoken) }
                    .getOrElse { LogResult(false, it.message ?: "Network error") }
            }
            status = if (logResult.ok) {
                "✓ ${logResult.summary}"
            } else {
                "✗ ${logResult.summary}"
            }
            busy = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Button(
            enabled = !busy,
            onClick = {
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
                    )
                    putExtra(
                        RecognizerIntent.EXTRA_PROMPT,
                        "Log a habit…",
                    )
                }
                voiceLauncher.launch(intent)
            },
        ) {
            Text(stringResource(R.string.log_label))
        }
        Text(
            text = stringResource(R.string.tap_speak),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            text = status,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 10.dp),
        )
    }
}
