package com.raza.alienai;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // اگر آپ کی کوئی activity_main.xml لے آؤٹ ہے تو اسے یہاں رہنے دیں، ورنہ یہ ایپ ڈائریکٹ ببل کھولے گی
        
        checkOverlayPermission();
    }

    private void checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // اگر پرمیشن نہیں ہے تو سیٹنگز میں لے جاؤ
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, 1000);
            } else {
                startBubbleService();
            }
        } else {
            startBubbleService();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1000) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    startBubbleService();
                } else {
                    Toast.makeText(this, "Ayesha AI needs overlay permission!", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    private void startBubbleService() {
        // ببل سروس سٹارٹ کرو اور ایپ کی مین سکرین بند کر دو
        Intent intent = new Intent(this, FloatingBubbleService.class);
        startService(intent);
        Toast.makeText(this, "Ayesha AI Bubble Started!", Toast.LENGTH_SHORT).show();
        finish(); 
    }
}
