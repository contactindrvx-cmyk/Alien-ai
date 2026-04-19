package com.raza.alienai;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SharedPreferences sharedPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        sharedPreferences = getSharedPreferences("AyeshaPrefs", MODE_PRIVATE);
        webView = findViewById(R.id.webView);

        // ویب ویو کی سیٹنگز
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);

        // 🚀 یہ ہے وہ "پل" جو HTML کو Android سے جوڑے گا 🚀
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient());
        
        // 🔴 یہاں اپنی HTML فائل کا لنک دیں (اگر assets میں index.html ہے تو ایسے لکھیں)
        webView.loadUrl("file:///android_asset/index.html"); 
    }

    @Override
    protected void onStart() {
        super.onStart();
        // ایپ کے اندر ببل غائب
        stopService(new Intent(this, FloatingBubbleService.class));
    }

    @Override
    protected void onStop() {
        super.onStop();
        // ایپ سے باہر نکلنے پر سیٹنگ کے مطابق ببل دکھائیں
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

    // ========================================================
    // یہ کلاس HTML سے آرڈر لے کر جاوا میں کام کرے گی
    // ========================================================
    public class WebAppInterface {

        // HTML سے ببل آن/آف کرنے کا سگنل
        @JavascriptInterface
        public void toggleBubble(boolean isEnabled) {
            sharedPreferences.edit().putBoolean("bubbleEnabled", isEnabled).apply();
            runOnUiThread(() -> {
                if (isEnabled) {
                    checkOverlayPermission();
                    Toast.makeText(MainActivity.this, "Bubble Enabled", Toast.LENGTH_SHORT).show();
                } else {
                    stopService(new Intent(MainActivity.this, FloatingBubbleService.class));
                    Toast.makeText(MainActivity.this, "Bubble Disabled", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // HTML سے ایجنٹ (عائشہ، رضا، ڈیوڈ) بدلنے کا سگنل
        @JavascriptInterface
        public void setAgent(String agentName) {
            sharedPreferences.edit().putString("selectedAgent", agentName).apply();
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, agentName + " Selected", Toast.LENGTH_SHORT).show();
            });
        }
    }
}
