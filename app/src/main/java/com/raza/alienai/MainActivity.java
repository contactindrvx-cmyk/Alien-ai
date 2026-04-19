package com.raza.alienai;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings; // 🚨 نیو امپورٹ
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILE_CHOOSER_REQUEST_CODE = 1;
    private final static int PERMISSION_REQUEST_CODE = 100;
    private final static int OVERLAY_PERMISSION_REQ_CODE = 2084; // 🚨 ببل کے لیے نیا کوڈ

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 1. ایپ شروع ہوتے ہی تمام ضروری پرمیشنز چیک کرنا
        checkAndRequestPermissions();

        webView = findViewById(R.id.webView);
        WebSettings settings = webView.getSettings();

        // 2. ویب ویو کی ڈیپ سیٹنگز (مائیک، آڈیو اور فائلز کے لیے)
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false); // عائشہ کی آواز خودکار چلانے کے لیے
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.setWebViewClient(new WebViewClient());

        // 3. ویب کروم کلائنٹ (مائیکروفون اور گیلری کا اصلی انجن)
        webView.setWebChromeClient(new WebChromeClient() {
            
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*"); 

                startActivityForResult(Intent.createChooser(intent, "Select File"), FILE_CHOOSER_REQUEST_CODE);
                return true;
            }
        });

        // 4. آپ کی ایچ ٹی ایم ایل فائل لوڈ کرنا
        webView.loadUrl("file:///android_asset/index.html");

        // 🚀 5. فلوٹنگ ببل کو سٹارٹ کرنے کا لاجک 🚀
        startFloatingBubble();
    }

    // 🚨 فلوٹنگ ببل کی پرمیشن اور سٹارٹ فنکشن
    private void startFloatingBubble() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            // اگر پرمیشن نہیں ہے تو سیٹنگز اوپن کرو تاکہ یوزر الاؤ کر سکے
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE);
        } else {
            // پرمیشن ہے تو فلوٹنگ ببل سروس سٹارٹ کر دو
            startService(new Intent(MainActivity.this, FloatingBubbleService.class));
        }
    }

    // پرمیشنز مانگنے کا فنکشن (مائیک اور سٹوریج)
    private void checkAndRequestPermissions() {
        String[] permissions = {
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE
        };

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }
    }

    // گیلری سے سلیکٹ کی گئی فائل اور ببل پرمیشن کو ہینڈل کرنا
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else if (requestCode == OVERLAY_PERMISSION_REQ_CODE) {
            // 🚨 ببل کی پرمیشن ملنے کے بعد سروس آن کرنا
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                startService(new Intent(MainActivity.this, FloatingBubbleService.class));
            } else {
                Toast.makeText(this, "Bubble permission denied!", Toast.LENGTH_SHORT).show();
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    // موبائل کا بیک بٹن دبانے کی ہینڈلنگ
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
