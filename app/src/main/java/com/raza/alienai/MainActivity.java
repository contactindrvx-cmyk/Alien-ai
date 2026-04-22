package com.raza.alienai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    private SpeechRecognizer speechRecognizer;
    private Intent speechRecognizerIntent;
    private boolean isRecording = false;
    private TextToSpeech tts;
    private AudioManager audioManager;

    BroadcastReceiver messageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            new Handler(Looper.getMainLooper()).post(() -> {
                if (webView == null) return;
                
                if ("NEW_MESSAGE_FROM_CALL".equals(action)) {
                    String msg = intent.getStringExtra("message");
                    if (msg != null) {
                        String safeMsg = msg.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        webView.evaluateJavascript("javascript:if(window.addMessageFromJava) window.addMessageFromJava('" + safeMsg + "');", null);
                    }
                } else if ("SCREEN_ANALYZED".equals(action)) {
                    webView.evaluateJavascript("javascript:if(window.analyzeScreen) window.analyzeScreen();", null);
                }
            });
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        webView = findViewById(R.id.webView);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try { 
                    startActivityForResult(fileChooserParams.createIntent(), FILECHOOSER_RESULTCODE); 
                } catch (Exception e) { 
                    MainActivity.this.filePathCallback = null; 
                    return false; 
                }
                return true;
            }
            @Override
            public void onPermissionRequest(final PermissionRequest request) { 
                request.grant(request.getResources()); 
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
        requestPermissions();
        setupSpeechRecognizer();
        initTextToSpeech();

        IntentFilter filter = new IntentFilter();
        filter.addAction("NEW_MESSAGE_FROM_CALL");
        filter.addAction("SCREEN_ANALYZED");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(this, messageReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(messageReceiver, filter);
        }

        if (!isAccessibilityServiceEnabled(this, AyeshaAccessibilityService.class)) {
            Toast.makeText(this, "عائشہ کو کنٹرول دینے کے لیے Accessibility آن کریں", Toast.LENGTH_LONG).show();
            Intent intent = new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
        }
    }

    private void initTextToSpeech() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(new Locale("ur", "PK"));
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(new Locale("ur"));
                }
                
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) {}
                    @Override public void onError(String utteranceId) {}
                    @Override 
                    public void onDone(String utteranceId) {
                        new Handler(Looper.getMainLooper()).post(() -> {
                            if (webView != null) webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null);
                        });
                    }
                });
            }
        });
    }

    private boolean isAccessibilityServiceEnabled(Context context, Class<?> accessibilityService) {
        android.content.ComponentName expectedComponentName = new android.content.ComponentName(context, accessibilityService);
        String enabledServicesSetting = android.provider.Settings.Secure.getString(context.getContentResolver(),  android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabledServicesSetting == null) return false;
        android.text.TextUtils.SimpleStringSplitter colonSplitter = new android.text.TextUtils.SimpleStringSplitter(':');
        colonSplitter.setString(enabledServicesSetting);
        while (colonSplitter.hasNext()) {
            String componentNameString = colonSplitter.next();
            android.content.ComponentName enabledService = android.content.ComponentName.unflattenFromString(componentNameString);
            if (enabledService != null && enabledService.equals(expectedComponentName)) return true;
        }
        return false;
    }

    private void setupSpeechRecognizer() {
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onError(int error) { 
                stopRecordingState(); 
            }
            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String spokenText = matches.get(0).trim();
                    // 🚨 خاموشی کا فلٹر: اگر 2 حروف سے کم ہے تو API پر مت بھیجو (لمٹ بچاؤ) 🚨
                    if (spokenText.length() >= 2) {
                        sendTextToJS(spokenText, true);
                    }
                }
                stopRecordingState();
            }
            @Override public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    sendTextToJS(matches.get(0), false);
                }
            }
            @Override public void onEvent(int eventType, Bundle params) {}
        });
    }

    private void sendTextToJS(String text, boolean isFinal) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (webView != null && text != null) {
                String safeText = text.replace("'", "\\'"); 
                webView.evaluateJavascript("javascript:if(window.updateInputFromJava) window.updateInputFromJava('" + safeText + "', " + isFinal + ");", null);
            }
        });
    }

    private void stopRecordingState() {
        isRecording = false;
        new Handler(Looper.getMainLooper()).post(() -> {
            if (webView != null) {
                webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(false);", null);
            }
        });
    }

    private void requestPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.CAMERA);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.READ_MEDIA_IMAGES);
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        
        List<String> needed = new ArrayList<>();
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p);
            }
        }
        
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 100);
        }
    }

    public class WebAppInterface {
        
        // 🚀 یہ ہے وہ ماسٹر پیس جو جاوا سکرپٹ کے پل کو بائی پاس کرے گا (Native Streaming API) 🚀
        @JavascriptInterface
        public void sendNativeRequest(String message, String base64Image) {
            new Thread(() -> {
                try {
                    URL url = new URL("https://aigrowthbox-ayesha-ai.hf.space/chat");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    
                    JSONObject payload = new JSONObject();
                    payload.put("message", message);
                    payload.put("email", "alirazasabir007@gmail.com");
                    if (base64Image != null && !base64Image.isEmpty()) {
                        payload.put("image", base64Image);
                    }
                    
                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamStart) window.onStreamStart();", null));
                    
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    String line;
                    StringBuilder fullResponse = new StringBuilder();
                    StringBuilder ttsBuffer = new StringBuilder();
                    
                    while ((line = reader.readLine()) != null) {
                        if (line.startsWith("data: ")) {
                            String data = line.substring(6);
                            if (data.trim().isEmpty() || data.equals("[DONE]")) continue;
                            
                            try {
                                JSONObject json = new JSONObject(data);
                                String chunkText = json.getString("text");
                                fullResponse.append(chunkText);
                                
                                String safeChunk = chunkText.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                                runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamChunk) window.onStreamChunk('" + safeChunk + "');", null));
                                
                                // 🚀 500ms جادو: جیسے ہی ایک جملہ بنے، بولنا شروع کر دو 🚀
                                ttsBuffer.append(chunkText);
                                if (chunkText.contains("۔") || chunkText.contains("؟") || chunkText.contains(".") || chunkText.contains("\n")) {
                                    String sentence = ttsBuffer.toString().trim();
                                    if (!sentence.isEmpty() && !sentence.contains("[ACTION:")) {
                                        speakText(sentence);
                                    }
                                    ttsBuffer.setLength(0);
                                }
                            } catch (Exception e) {}
                        }
                    }
                    
                    String leftover = ttsBuffer.toString().trim();
                    if (!leftover.isEmpty() && !leftover.contains("[ACTION:")) {
                        speakText(leftover);
                    }
                    
                    String finalSafeResp = fullResponse.toString().replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamEnd) window.onStreamEnd('" + finalSafeResp + "');", null));
                    
                } catch (Exception e) {
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamError) window.onStreamError();", null));
                }
            }).start();
        }

        @JavascriptInterface
        public void toggleCall(boolean start) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
                    if (start) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(intent);
                        } else {
                            startService(intent);
                        }
                    } else {
                        stopService(intent); 
                    }
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void toggleInlineMic() {
            runOnUiThread(() -> {
                try {
                    if (isRecording) {
                        speechRecognizer.stopListening();
                        stopRecordingState();
                    } else {
                        // 🚨 سائلنٹ مائیک جادو: بیپ کی آواز کو چھپا دو 🚨
                        if (audioManager != null) {
                            audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0);
                        }
                        
                        speechRecognizer.startListening(speechRecognizerIntent);
                        isRecording = true;
                        webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(true);", null);
                        
                        // بیپ کا ٹائم گزرنے کے بعد آواز واپس کھول دو
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            if (audioManager != null) {
                                audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0);
                            }
                        }, 500);
                    }
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void muteCall(boolean isMuted) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            intent.setAction("ACTION_MUTE_CALL");
            intent.putExtra("isMuted", isMuted);
            startService(intent);
        }

        @JavascriptInterface
        public void sendAccessibilityCommand(String action, String data) {
            runOnUiThread(() -> {
                Intent intent = new Intent("AI_COMMAND_BROADCAST");
                intent.putExtra("action", action);
                intent.putExtra("data", data);
                intent.setPackage(getPackageName()); 
                sendBroadcast(intent);
            });
        }

        @JavascriptInterface
        public String pullScreenshot() {
            String b64 = AyeshaAccessibilityService.latestScreenshotBase64;
            AyeshaAccessibilityService.latestScreenshotBase64 = ""; 
            return b64 != null ? b64 : "";
        }

        @JavascriptInterface
        public String pullScreenText() {
            String text = AyeshaAccessibilityService.latestScreenText;
            AyeshaAccessibilityService.latestScreenText = ""; 
            return text != null ? text : "";
        }

        @JavascriptInterface
        public void speakText(String text) {
            if (tts != null) {
                tts.speak(text, TextToSpeech.QUEUE_ADD, null, "AyeshaTTS_ID"); // اب یہ QUEUE_ADD ہے تاکہ جملے کٹیں نہیں
            }
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (tts != null && tts.isSpeaking()) {
                tts.stop();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getDataString() != null) {
                results = new Uri[]{Uri.parse(data.getDataString())};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        if (tts != null) { 
            tts.stop(); 
            tts.shutdown(); 
        }
        try { 
            unregisterReceiver(messageReceiver); 
        } catch (Exception e) {}
    }
                    }
                    
