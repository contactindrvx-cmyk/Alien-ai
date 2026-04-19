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

        // ویب ویو کی پروفیشنل سیٹنگز
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        // 🚀 جاوا سکرپٹ برج (پل) جو HTML کو اینڈرائیڈ سے جوڑتا ہے
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient());
        
        // آپ کی اصل HTML فائل یہاں لوڈ ہوگی
        webView.loadUrl("file:///android_asset/index.html"); 
    }

    @Override
    protected void onStart() {
        super.onStart();
        // جب یوزر ایپ کے اندر ہو، ببل کو روک دو
        stopService(new Intent(this, FloatingBubbleService.class));
    }

    @Override
    protected void onStop() {
        super.onStop();
        // جب یوزر باہر نکلے، اگر سیٹنگ آن ہے تو ببل دکھا دو
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
            // 🔴 یہ وہ لائن ہے جو فکس کر دی گئی ہے 🔴
            startActivityForResult(intent, 1000);
        }
    }

    // یہ کلاس آپ کے HTML بٹنوں کے آرڈر وصول کرے گی
    public class WebAppInterface {

        @JavascriptInterface
        public void toggleBubble(boolean isEnabled) {
            sharedPreferences.edit().putBoolean("bubbleEnabled", isEnabled).apply();
            runOnUiThread(() -> {
                if (isEnabled) {
                    checkOverlayPermission();
                    Toast.makeText(MainActivity.this, "Ayesha Bubble: ON", Toast.LENGTH_SHORT).show();
                } else {
                    stopService(new Intent(MainActivity.this, FloatingBubbleService.class));
                    Toast.makeText(MainActivity.this, "Ayesha Bubble: OFF", Toast.LENGTH_SHORT).show();
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
    }
}
