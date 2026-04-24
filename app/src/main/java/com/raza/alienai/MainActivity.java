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
import org.vosk.Model;
import org.vosk.android.StorageService;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    private boolean isCallModeActive = false;
    
    // 🚀 Vosk ماڈل کو پوری ایپ کے لیے گلوبل کر دیا گیا ہے 🚀
    public static Model voskModel;

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
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);

        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                startActivityForResult(fileChooserParams.createIntent(), FILECHOOSER_RESULTCODE); 
                return true;
            }
            @Override
            public void onPermissionRequest(final PermissionRequest request) { request.grant(request.getResources()); }
        });

        webView.loadUrl("file:///android_asset/index.html");
        requestPermissions();
        
        // 🚀 ایپ کھلتے ہی آف لائن Vosk ماڈل لوڈ کریں 🚀
        initOfflineVoskModel();

        IntentFilter filter = new IntentFilter();
        filter.addAction("NEW_MESSAGE_FROM_CALL");
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

    private void initOfflineVoskModel() {
        StorageService.unpack(this, "model-ur", "model",
            (model) -> {
                voskModel = model;
                Toast.makeText(MainActivity.this, "آف لائن کان ریڈی ہیں!", Toast.LENGTH_SHORT).show();
            },
            (exception) -> {
                Toast.makeText(MainActivity.this, "ماڈل لوڈ نہیں ہوا: " + exception.getMessage(), Toast.LENGTH_LONG).show();
            });
    }

    private boolean isAccessibilityServiceEnabled(Context context, Class<?> accessibilityService) {
        String enabled = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled != null && enabled.contains(context.getPackageName() + "/" + accessibilityService.getName());
    }

    private void requestPermissions() {
        String[] perms = {Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA};
        ActivityCompat.requestPermissions(this, perms, 100);
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void toggleCall(boolean start) {
            isCallModeActive = start;
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
                    if (start) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
                        else startService(intent);
                    } else {
                        stopService(intent); 
                    }
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void toggleInlineMic() {
            // ❌ گوگل کا مائیک جڑ سے ختم کر دیا گیا ہے ❌
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "براہ کرم بات کرنے کے لیے لائیو کال کا بٹن دبائیں۔", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void sendNativeRequest(String message, String base64Image) {
            // Text Mode chat integration (Kept intact for text typing)
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
                    if (base64Image != null && !base64Image.isEmpty()) payload.put("image", base64Image);
                    
                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();
                    
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamStart) window.onStreamStart();", null));
                    
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
                    
                } catch (Exception e) {
                    runOnUiThread(() -> webView.evaluateJavascript("javascript:if(window.onStreamError) window.onStreamError();", null));
                }
            }).start();
        }

        @JavascriptInterface 
        public void speakText(String text) { /* اب TTS سرور سے MP3 کی صورت میں آئے گا */ }

        @JavascriptInterface 
        public void stopSpeaking() { 
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class); 
            intent.setAction("ACTION_STOP_AUDIO"); 
            startService(intent);
        }

        @JavascriptInterface public void muteCall(boolean isMuted) { Intent intent = new Intent(MainActivity.this, AyeshaCallService.class); intent.setAction("ACTION_MUTE_CALL"); intent.putExtra("isMuted", isMuted); startService(intent); }
        
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
        try { unregisterReceiver(messageReceiver); } catch (Exception e) {}
    }
                        }
        
