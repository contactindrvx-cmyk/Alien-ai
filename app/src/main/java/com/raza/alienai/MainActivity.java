package com.raza.alienai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
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

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    // وائس ریکگنیشن (بغیر گوگل پاپ اپ کے)
    private SpeechRecognizer speechRecognizer;
    private Intent speechRecognizerIntent;
    private boolean isRecording = false;

    BroadcastReceiver messageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String msg = intent.getStringExtra("message");
            if (webView != null && msg != null) {
                webView.evaluateJavascript("javascript:if(window.addMessageFromJava) window.addMessageFromJava('" + msg.replace("'", "\\'") + "');", null);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webView);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        // گیلری اور کیمرے کی پرمیشن کے لیے WebChromeClient
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
        setupSpeechRecognizer(); // مائیک سیٹ اپ

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"));
        }
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
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    sendTextToJS(matches.get(0), true);
                }
                stopRecordingState();
            }
            @Override
            public void onPartialResults(Bundle partialResults) {
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
            webView.evaluateJavascript("javascript:if(window.updateInputFromJava) window.updateInputFromJava('" + text + "', " + isFinal + ");", null);
        });
    }

    private void stopRecordingState() {
        isRecording = false;
        new Handler(Looper.getMainLooper()).post(() -> {
            webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(false);", null);
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
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) needed.add(p); 
        }
        if (!needed.isEmpty()) ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 100);
    }

    // جاوا سکرپٹ اور اینڈرائیڈ کے درمیان پل
    public class WebAppInterface {
        @JavascriptInterface
        public void toggleCall(boolean start) {
            // runOnUiThread کا استعمال تاکہ ایپ کریش نہ ہو
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
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "Call Service Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
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
                        speechRecognizer.startListening(speechRecognizerIntent);
                        isRecording = true;
                        webView.evaluateJavascript("javascript:if(window.onInlineMicState) window.onInlineMicState(true);", null);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "Mic Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void muteCall(boolean isMuted) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            intent.setAction("ACTION_MUTE_CALL");
            intent.putExtra("isMuted", isMuted);
            startService(intent);
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
        if (speechRecognizer != null) speechRecognizer.destroy();
        try { unregisterReceiver(messageReceiver); } catch (Exception e) {}
    }
                        }
                          
