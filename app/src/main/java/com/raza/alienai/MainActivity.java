package com.raza.alienai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;

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
        webView.getSettings().setDomStorageEnabled(true);
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms.add(Manifest.permission.POST_NOTIFICATIONS);
        
        List<String> needed = new ArrayList<>();
        for (String p : perms) { if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) needed.add(p); }
        if (!needed.isEmpty()) ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 100);
    }

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
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(messageReceiver); } catch (Exception e) {}
    }
}
