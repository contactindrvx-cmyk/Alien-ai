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
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    
    // تصویر چننے اور مائیک کے لیے ویری ایبلز
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1001;
    private final static int VOICE_RESULTCODE = 1002;

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
        webView.getSettings().setAllowFileAccess(true); // فائل ایکسیس کی اجازت
        
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        // تصویروں (گیلری/کیمرے) اور مائیک کی پرمیشن کے لیے WebChromeClient
        webView.setWebChromeClient(new WebChromeClient() {
            // یہ فنکشن آپ کے HTML کے <input type="file"> کو ہینڈل کرے گا
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }

            // WebView کے اندر کیمرہ/مائیک پرمیشنز کو آٹو گرانٹ کرنے کے لیے
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        webView.loadUrl("file:///android_asset/index.html");

        requestPermissions();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"));
        }
    }

    private void requestPermissions() {
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.READ_PHONE_STATE);
        perms.add(Manifest.permission.CAMERA); // کیمرے کی پرمیشن
        
        // اینڈرائیڈ 13 اور اس سے اوپر کے لیے نئی پرمیشنز
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
            perms.add(Manifest.permission.READ_MEDIA_IMAGES);
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        
        List<String> needed = new ArrayList<>();
        for (String p : perms) { 
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) needed.add(p); 
        }
        if (!needed.isEmpty()) ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 100);
    }

    // آپ کے JS اور جاوا کے درمیان پل (Bridge)
    public class WebAppInterface {
        @JavascriptInterface
        public void toggleCall(boolean start) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            if (start) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent); else startService(intent);
            } else {
                stopService(intent);
            }
        }
        
        @JavascriptInterface
        public void muteCall(boolean isMuted) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            intent.setAction(AyeshaCallService.ACTION_MUTE_CALL);
            intent.putExtra("isMuted", isMuted);
            startService(intent);
        }

        // مائیک کا نیٹو ڈائیلاگ اوپن کرنے کے لیے
        @JavascriptInterface
        public void startVoiceRecognition() {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK"); // اردو زبان
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "کچھ بولیں...");
            try {
                startActivityForResult(intent, VOICE_RESULTCODE);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    // جب گیلری یا مائیک سے رزلٹ واپس آئے تو اسے ہینڈل کرنا
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // تصویر منتخب کرنے کا رزلٹ
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } 
        // مائیک کا رزلٹ
        else if (requestCode == VOICE_RESULTCODE && resultCode == RESULT_OK && data != null) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) {
                String spokenText = matches.get(0);
                // جاوا سکرپٹ کو ویلیو بھیجنا اور خودکار طور پر سینڈ بٹن دبانا
                webView.evaluateJavascript("javascript:(function(){ " +
                        "var input = document.getElementById('user-input'); " +
                        "if(input){ " +
                        "input.value = '" + spokenText + "'; " +
                        "input.dispatchEvent(new Event('input')); " + // UI کو اپڈیٹ کرنے کے لیے
                        "setTimeout(function(){ document.getElementById('in-send').click(); }, 500); " +
                        "} " +
                        "})();", null);
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(messageReceiver); } catch (Exception e) {}
    }
}
