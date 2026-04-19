package com.raza.alienai;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private Switch bubbleSwitch;
    private RadioGroup agentGroup;
    private SharedPreferences sharedPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bubbleSwitch = findViewById(R.id.bubbleSwitch);
        agentGroup = findViewById(R.id.agentGroup);
        sharedPreferences = getSharedPreferences("AyeshaPrefs", MODE_PRIVATE);

        // 1. پرانی سیٹنگ لوڈ کریں (سوئچ کی)
        boolean isEnabled = sharedPreferences.getBoolean("bubbleEnabled", true);
        bubbleSwitch.setChecked(isEnabled);

        // 2. پرانا سلیکٹڈ ایجنٹ لوڈ کریں اور بٹن کو چیک کریں
        String currentAgent = sharedPreferences.getString("selectedAgent", "ayesha");
        if (currentAgent.equals("ayesha")) ((RadioButton) findViewById(R.id.radioAyesha)).setChecked(true);
        else if (currentAgent.equals("raza")) ((RadioButton) findViewById(R.id.radioRaza)).setChecked(true);
        else if (currentAgent.equals("david")) ((RadioButton) findViewById(R.id.radioDavid)).setChecked(true);
        else if (currentAgent.equals("sara")) ((RadioButton) findViewById(R.id.radioSara)).setChecked(true);

        // 3. سوئچ (On/Off) کے لیے لسنر
        bubbleSwitch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            sharedPreferences.edit().putBoolean("bubbleEnabled", isChecked).apply();
            if (isChecked) {
                checkOverlayPermission();
            } else {
                stopService(new Intent(MainActivity.this, FloatingBubbleService.class));
            }
        });

        // 4. ایجنٹ (Ayesha/Raza وغیرہ) تبدیل کرنے کے لیے لسنر
        agentGroup.setOnCheckedChangeListener((group, checkedId) -> {
            String agentName = "ayesha"; // ڈیفالٹ
            if (checkedId == R.id.radioRaza) agentName = "raza";
            else if (checkedId == R.id.radioDavid) agentName = "david";
            else if (checkedId == R.id.radioSara) agentName = "sara";

            sharedPreferences.edit().putString("selectedAgent", agentName).apply();
            Toast.makeText(this, "Agent " + agentName + " Selected", Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    protected void onStart() {
        super.onStart();
        // جب آپ ایپ کے اندر ہوں گے، تو ببل غائب ہو جائے گا
        stopService(new Intent(this, FloatingBubbleService.class));
    }

    @Override
    protected void onStop() {
        super.onStop();
        // جب آپ ایپ سے باہر نکلیں گے، تو سیٹنگ کے مطابق ببل خود بخود آ جائے گا
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
}
