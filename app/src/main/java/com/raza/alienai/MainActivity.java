package com.raza.alienai;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SharedPreferences sharedPreferences;
    
    // 📸 تصویر اپلوڈ کرنے کے لیے 📸
    private ValueCallback<Uri[]> mFilePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 1;

    // 🌟 بیک گراؤنڈ سروس سے "نام پکارنے" کا سگنل پکڑنے والا ریسیور 🌟
    private BroadcastReceiver wakeWordReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String agentName = intent.getStringExtra("agentName");
            // ویب ویو (JS) کو بتانا کہ ریکارڈنگ شروع کرو
            if (webView != null) {
                webView.evaluateJavascript("javascript:if(window.onWakeWordDetected) window.onWakeWordDetected('" + agentName + "');", null);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        sharedPreferences = getSharedPreferences("AyeshaPrefs", MODE_PRIVATE);
        webView = findViewById(R.id.webView);

        requestRuntimePermissions();

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false); 

        // جاوا سکرپٹ برج
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        // 📸 مائیک اور گیلری کا کنٹرول 📸
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent intent = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    intent = fileChooserParams.createIntent();
                }
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (ActivityNotFoundException e) {
                    mFilePathCallback = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html"); 

        // 🌟 ریسیور کو رجسٹر کریں 🌟
        IntentFilter filter = new IntentFilter("com.raza.alienai.WAKE_WORD_DETECTED");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(wakeWordReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(wakeWordReceiver, filter);
        }
    }

    private void requestRuntimePermissions() {
        String[] permissions = {
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
                Manifest.permission.READ_EXTERNAL_STORAGE
        };
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, permissions, 100);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        stopService(new Intent(this, FloatingBubbleService.class));
    }

    @Override
    protected void onStop() {
        super.onStop();
        boolean isEnabled = sharedPreferences.getBoolean("bubbleEnabled", true);
        if (isEnabled && hasOverlayPermission()) {
            startService(new Intent(this, FloatingBubbleService.class));
        }
    }

    private boolean hasOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(this);
        }
        return true;
    }

    private void checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, 1000);
        }
    }

    // 📸 یہ وہ فنکشن ہے جو پلس بٹن سے گیلری کھلوائے گا (جو مس ہو گیا تھا) 📸
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mFilePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(wakeWordReceiver); 
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void toggleBubble(boolean isEnabled) {
            sharedPreferences.edit().putBoolean("bubbleEnabled", isEnabled).apply();
            runOnUiThread(() -> {
                if (isEnabled) {
                    checkOverlayPermission();
                    Toast.makeText(MainActivity.this, "Floating Bubble: ON", Toast.LENGTH_SHORT).show();
                } else {
                    stopService(new Intent(MainActivity.this, FloatingBubbleService.class));
                    Toast.makeText(MainActivity.this, "Floating Bubble: OFF", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void setAgent(String agentName) {
            sharedPreferences.edit().putString("selectedAgent", agentName).apply();
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Agent " + agentName + " Selected", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public void startBubbleVideo() {
            Intent intent = new Intent("com.raza.alienai.PLAY_VIDEO");
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        }

        @JavascriptInterface
        public void stopBubbleVideo() {
            Intent intent = new Intent("com.raza.alienai.PAUSE_VIDEO");
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        }
    }
        }
                          
