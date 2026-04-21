package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.util.List;

public class AyeshaAccessibilityService extends AccessibilityService {

    private String currentAction = "";
    
    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            String rawData = intent.getStringExtra("data"); // اس میں APP اور TARGET دونوں ہوں گے
            
            if ("UNIVERSAL_CMD".equals(action) && rawData != null) {
                // جاوا سکرپٹ سے ڈیٹا الگ کرنا (Format: APP_NAME|||TARGET)
                String[] parts = rawData.split("\\|\\|\\|");
                String targetApp = parts[0].trim();
                String targetContent = parts.length > 1 ? parts[1].trim() : "none";
                
                Toast.makeText(context, "عائشہ " + targetApp + " کو ڈھونڈ رہی ہے...", Toast.LENGTH_SHORT).show();
                
                // 🚀 سٹیپ 1: یونیورسل ایپ فائنڈر (PackageManager) 🚀
                PackageManager pm = getPackageManager();
                List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
                String appPackageName = null;
                
                for (ApplicationInfo packageInfo : packages) {
                    String appName = pm.getApplicationLabel(packageInfo).toString();
                    // اگر ایپ کا نام میچ ہو جائے (مثلاً YouTube)
                    if (appName.toLowerCase().contains(targetApp.toLowerCase())) {
                        appPackageName = packageInfo.packageName;
                        break;
                    }
                }
                
                if (appPackageName != null) {
                    // ایپ مل گئی! اسے اوپن کرو
                    Intent launchIntent = pm.getLaunchIntentForPackage(appPackageName);
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(launchIntent);
                        
                        // 🚀 سٹیپ 2: سکرین ریڈر (اگر کوئی ٹارگٹ دیا گیا ہے) 🚀
                        if (!targetContent.equals("none") && !targetContent.isEmpty()) {
                            Toast.makeText(context, "سکرین پڑھ رہی ہے...", Toast.LENGTH_LONG).show();
                            
                            // عائشہ کو 4 سیکنڈ کا ٹائم دیں تاکہ ایپ پوری طرح اوپن ہو جائے
                            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                                universalScreenReaderAndClicker(targetContent);
                            }, 4000); // 4 Seconds Delay (آرام سے کام کرنے کے لیے)
                        }
                    }
                } else {
                    Toast.makeText(context, "عائشہ کو آپ کے موبائل میں '" + targetApp + "' نہیں ملی۔", Toast.LENGTH_LONG).show();
                }
            }
        }
    };

    // 🧠 یونیورسل سکرین ریڈر اور کلکر (یہ پوری سکرین کو سکین کرے گا) 🧠
    private void universalScreenReaderAndClicker(String targetText) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        // پہلے ٹیکسٹ کے ذریعے ڈھونڈنے کی کوشش کرو
        List<AccessibilityNodeInfo> foundNodes = rootNode.findAccessibilityNodeInfosByText(targetText);
        
        if (!foundNodes.isEmpty()) {
            AccessibilityNodeInfo target = foundNodes.get(0);
            
            // ہو سکتا ہے جو ٹیکسٹ ملا ہو وہ خود کلک ایبل نہ ہو، تو ہم اس کے Parent (بٹن) کو ڈھونڈ کر کلک کریں گے
            while (target != null && !target.isClickable()) {
                target = target.getParent();
            }
            
            if (target != null) {
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                Toast.makeText(getApplicationContext(), "عائشہ نے ٹارگٹ پر کلک کر دیا!", Toast.LENGTH_SHORT).show();
            }
        } else {
            // اگر پہلی بار نہ ملے، تو ہو سکتا ہے سکرین ابھی لوڈ ہو رہی ہو
            Toast.makeText(getApplicationContext(), "عائشہ کو سکرین پر '" + targetText + "' نظر نہیں آیا۔", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // سارا کام اب یونیورسل سکرین ریڈر کر رہا ہے۔
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"));
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
