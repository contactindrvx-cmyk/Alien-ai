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

        // ویب ویو کو لے آؤٹ سے کنیکٹ کرنا
        webView = findViewById(R.id.webView);
        WebSettings webSettings = webView.getSettings();
        
        // یہ سیٹنگز بہت ضروری ہیں تاکہ آپ کی HTML, CSS اور JS مکھن کی طرح چلیں
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false); // آڈیو چلانے کے لیے

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        // ⚠️ یہاں نیچے اپنے ہگنگ فیس (Hugging Face) پروجیکٹ کا اصل لنک ڈالنا ہے ⚠️
        webView.loadUrl("https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME");
    }

    // موبائل کا بیک (Back) بٹن دبانے کی سیٹنگ
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack(); // اگر ایپ کے اندر پچھلا پیج ہے تو وہاں جائے
        } else {
            super.onBackPressed(); // ورنہ ایپ بند کر دے
        }
    }
}
