package com.raza.alienai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

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
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");

        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_PHONE_STATE}, 1);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(messageReceiver, new IntentFilter("NEW_MESSAGE_FROM_CALL"));
        }
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void toggleCall(boolean start) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            if (start) startService(intent); else stopService(intent);
        }
        @JavascriptInterface
        public void muteCall(boolean isMuted) {
            Intent intent = new Intent(MainActivity.this, AyeshaCallService.class);
            intent.putExtra("isMuted", isMuted); startService(intent);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(messageReceiver);
    }
}
