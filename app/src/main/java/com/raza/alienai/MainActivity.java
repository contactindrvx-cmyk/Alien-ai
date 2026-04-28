package com.raza.alienai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.MediaPlayer;
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
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.RelativeLayout;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private RelativeLayout splashScreen;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    private SpeechRecognizer textModeRecognizer;
    private Intent textModeIntent;
    private boolean isTextModeRecording = false;
    private boolean isCallModeActive = false;
    private TextToSpeech tts;
    private MediaPlayer mediaPlayer; 

    BroadcastReceiver messageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            new Handler(Looper.getMainLooper()).post(() -> {
                if (webView == null) return;
                
                if ("USER_MESSAGE_FROM_CALL".equals(action)) {
                    String msg = intent.getStringExtra("message");
                    if (msg != null) {
                        String safeMsg = msg.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        webView.evaluateJavascript("javascript:if(window.addMessage) window.addMessage('" + safeMsg + "', 'user', null);", null);
                    }
                } 
                else if ("NEW_MESSAGE_FROM_CALL".equals(action)) {
                    String msg = intent.getStringExtra("message");
                    if (msg != null) {
                        String safeMsg = msg.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        webView.evaluateJavascript("javascript:if(window.addMessageFromJava) window.addMessageFromJava('" + safeMsg + "');", null);
                    }
                } 
                else if ("SCREEN_ANALYZED".equals(action)) {
                    if (isCallModeActive) {
                        Intent callIntent = new Intent(MainActivity.this, AyeshaCallService.class);
                        callIntent.setAction("SCREEN_ANALYZED_WAKEUP");
                        startService(callIntent);
                    } else {
                        webView.evaluateJavascript("javascript:if(window.analyzeScreen) window.analyzeScreen();", null);
                    }
                }
            });
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webView);
        splashScreen = findViewById(R.id.splashScreen);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                splashScreen.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                startActivityForResult(fileChooserParams.createIntent(), FILECHOOSER_RESULTCODE); 
                return true;
            }
            @Override
            public void onPermissionRequest(final PermissionRequest request) { 
                runOnUiThread(() -> {
                    request.grant(request.getResources()); 
                });
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
        
        requestPermissions();
        initTextToSpeech();
        setupTextModeRecognizer();

        IntentFilter filter = new IntentFilter();
        filter.addAction("NEW_MESSAGE_FROM_CALL");
        filter.addAction("USER_MESSAGE_FROM_CALL"); 
        filter.addAction("SCREEN_ANALYZED");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(this, messageReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(messageReceiver, filter);
        }

        if (!isAccessibilityServiceEnabled(this, AyeshaAccessibilityService.class)) {
            Toast.makeText(this, "Accessibility سروس آن کریں", Toast.LENGTH_LONG).show();
            startActivity(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS));
        }
    }

    private void playBase64Audio(String base64Audio) {
        try {
            byte[] audioBytes = Base64.decode(base64Audio, Base64.DEFAULT);
            File tempAudioFile = File.createTempFile("gemini_audio_main", ".mp3", getCacheDir());
            FileOutputStream fos = new FileOutputStream(tempAudioFile);
            fos.write(audioBytes);
            fos.close();
            
            runOnUiThread(() -> {
                try {
                    if (mediaPlayer != null) { mediaPlayer.release(); }
                    mediaPlayer = new MediaPlayer();
                    mediaPlayer.setDataSource(tempAudioFile.getAbsolutePath());
                    mediaPlayer.prepare();
                    mediaPlayer.setOnCompletionListener(mp -> {
                        webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null);
                    });
                    mediaPlayer.start();
                } catch (Exception e) {
                    webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null);
                }
            });
        } catch (Exception e) {
            runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null));
        }
    }

    private void initTextToSpeech() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(new Locale("ur", "PK"));
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) {}
                    @Override public void onError(String utteranceId) {}
                    @Override public void onDone(String utteranceId) {
                        new Handler(Looper.getMainLooper()).post(() -> {
                            if (webView != null) webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null);
                        });
                    }
                });
            }
        });
    }

    private boolean isAccessibilityServiceEnabled(Context context, Class<?> accessibilityService) {
        String enabled = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled != null && enabled.contains(context.getPackageName() + "/" + accessibilityService.getName());
    }

    private void setupTextModeRecognizer() {
        textModeRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        textModeIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        textModeIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        textModeIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");

        textModeRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onError(int error) { stopTextRecordingState(); }
            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty() && matches.get(0).trim().length() >= 2) {
                    sendTextToJS(matches.get(0).trim(), true);
                }
                stopTextRecordingState();
            }
            @Override public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) sendTextToJS(matches.get(0).trim(), false);
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

    private void stopTextRecordingState() {
        isTextModeRecording = false;
        new Handler(Looper.getMainLooper()).post(() -> {
            if (webView != null) webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(false);", null);
        });
    }

    private void requestPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
            perms.add(Manifest.permission.READ_MEDIA_IMAGES);
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        ActivityCompat.requestPermissions(this, perms.toArray(new String[0]), 100);
    }

    public class WebAppInterface {

        @JavascriptInterface
        public void openCamera() {
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.evaluateJavascript("javascript:if(window.startLiveCamera) window.startLiveCamera();", null);
                }
            });
        }

        @JavascriptInterface
        public void openGallery() {
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.evaluateJavascript("javascript:var fi = document.getElementById('hidden-file-input'); if(fi) fi.click();", null);
                }
            });
        }

        @JavascriptInterface
        public void toggleCall(boolean start) {
            isCallModeActive = start;
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
                    if (start) {
                        if (isTextModeRecording) { textModeRecognizer.stopListening(); stopTextRecordingState(); }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
                        else startService(intent);
                    } else {
                        intent.setAction(AyeshaCallService.ACTION_STOP_SERVICE);
                        startService(intent); 
                    }
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void toggleInlineMic() {
            if (isCallModeActive) return; 
            runOnUiThread(() -> {
                if (isTextModeRecording) {
                    textModeRecognizer.stopListening(); stopTextRecordingState();
                } else {
                    AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                    try { am.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0); } catch (Exception e) {}
                    textModeRecognizer.startListening(textModeIntent);
                    isTextModeRecording = true;
                    webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(true);", null);
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        try { am.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0); } catch (Exception e) {}
                    }, 400);
                }
            });
        }

        @JavascriptInterface
        public void sendNativeRequest(String message, String base64Image, String assistantName) {
            new Thread(() -> {
                try {
                    URL url = new URL("https://ayesha.aigrowthbox.com/chat");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    
                    JSONObject payload = new JSONObject();
                    payload.put("message", message);
                    payload.put("email", "alirazasabir007@gmail.com");
                    
                    payload.put("mode", isCallModeActive ? "audio" : "text");
                    payload.put("assistant", assistantName); 
                    
                    if (base64Image != null && !base64Image.isEmpty()) payload.put("image", base64Image);
                    
                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamStart) window.onStreamStart();", null));
                    
                    if (isCallModeActive) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder fullResponse = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) fullResponse.append(line);
                        
                        JSONObject jsonResp = new JSONObject(fullResponse.toString());
                        String textResp = jsonResp.optString("text", "");
                        String audioB64 = jsonResp.optString("audio", "");
                        
                        String safeText = textResp.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamEnd) window.onStreamEnd('" + safeText + "');", null));
                        
                        if (audioB64 != null && !audioB64.isEmpty()) {
                            playBase64Audio(audioB64);
                        } else {
                            runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onSpeechDone) window.onSpeechDone();", null));
                        }
                    } else {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        String line;
                        StringBuilder fullResponse = new StringBuilder();
                        
                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                String data = line.substring(6);
                                if (data.trim().isEmpty() || data.equals("[DONE]")) continue;
                                JSONObject json = new JSONObject(data);
                                String chunkText = json.getString("text");
                                fullResponse.append(chunkText);
                                String safeChunk = chunkText.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                                runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamChunk) window.onStreamChunk('" + safeChunk + "');", null));
                            }
                        }
                        String finalSafeResp = fullResponse.toString().replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamEnd) window.onStreamEnd('" + finalSafeResp + "');", null));
                    }
                    
                } catch (Exception e) {
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamError) window.onStreamError();", null));
                }
            }).start();
        }

        @JavascriptInterface 
        public void speakText(String text) { 
            if (!isCallModeActive && tts != null) {
                tts.speak(text, TextToSpeech.QUEUE_ADD, null, "AyeshaTTS_ID"); 
            }
        }

        @JavascriptInterface public void stopSpeaking() { 
            if (tts != null && tts.isSpeaking()) { tts.stop(); }
            if (mediaPlayer != null && mediaPlayer.isPlaying()) { mediaPlayer.stop(); }
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class); 
            intent.setAction(AyeshaCallService.ACTION_STOP_AUDIO); 
            startService(intent);
        }

        @JavascriptInterface public void muteCall(boolean isMuted) { 
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class); 
            intent.setAction("ACTION_MUTE_CALL"); 
            intent.putExtra("isMuted", isMuted); 
            startService(intent); 
        }
        
         @JavascriptInterface 
        public void sendAccessibilityCommand(String action, String data) { 
            Intent intent = new Intent("AI_COMMAND_BROADCAST"); 
            intent.putExtra("action", action); 
            intent.putExtra("data", data); 
            intent.setPackage(getPackageName());
            sendBroadcast(intent); 
        }
        
        @JavascriptInterface public String pullScreenshot() { String b64 = AyeshaAccessibilityService.latestScreenshotBase64; AyeshaAccessibilityService.latestScreenshotBase64 = ""; return b64 != null ? b64 : ""; }
        @JavascriptInterface public String pullScreenText() { String text = AyeshaAccessibilityService.latestScreenText; AyeshaAccessibilityService.latestScreenText = ""; return text != null ? text : ""; }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE && filePathCallback != null) {
            Uri[] results = (resultCode == RESULT_OK && data != null && data.getDataString() != null) ? new Uri[]{Uri.parse(data.getDataString())} : null;
            filePathCallback.onReceiveValue(results); filePathCallback = null;
        } 
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        if (textModeRecognizer != null) textModeRecognizer.destroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (mediaPlayer != null) { mediaPlayer.release(); }
        try { unregisterReceiver(messageReceiver); } catch (Exception e) {}
    }
                                              }
