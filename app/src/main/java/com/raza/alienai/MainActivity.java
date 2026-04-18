package com.raza.alienai;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // ویب ویو کو سیٹ کرنا
        webView = findViewById(R.id.webView);
        WebSettings webSettings = webView.getSettings();
        
        // جاوا اسکرپٹ اور اسٹوریج کو آن کرنا تاکہ ڈیزائن صحیح چلے
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        // آپ کا اصلی ہگنگ فیس لنک یہاں لگا دیا گیا ہے
        webView.loadUrl("https://huggingface.co/spaces/aigrowthbox/ayesha-ai");
    }

    // بیک بٹن دبانے پر ایپ بند ہونے کے بجائے پیچھے والے پیج پر جائے گی
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
