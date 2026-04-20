package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.List;

public class AyeshaAccessibilityService extends AccessibilityService {

    // یہ متغیرات (Variables) یاد رکھیں گے کہ ہم ابھی کیا کام کر رہے ہیں
    private String currentAction = "";
    private String actionData = "";
    private int currentStep = 0;

    // 🌟 سگنل ریسیور (یہاں دماغ سے آرڈر موصول ہوگا) 🌟
    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            currentAction = intent.getStringExtra("action");
            actionData = intent.getStringExtra("data"); // مثلاً کیا سرچ کرنا ہے
            currentStep = 1; // کام کا پہلا سٹیپ شروع کریں

            if ("OPEN_YOUTUBE".equals(currentAction)) {
                Toast.makeText(context, "عائشہ یوٹیوب کھول رہی ہے...", Toast.LENGTH_SHORT).show();
                
                // یوٹیوب ایپ کو اوپن کرنے کا کوڈ
                Intent launchIntent = getPackageManager().getLaunchIntentForPackage("com.google.android.youtube");
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launchIntent);
                } else {
                    Toast.makeText(context, "یوٹیوب ایپ نہیں ملی!", Toast.LENGTH_SHORT).show();
                    currentAction = "";
                }
            }
        }
    };

    // 🌟 اصل جادو یہاں ہوگا: سکرین کو پڑھنا اور کلک کرنا 🌟
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null || currentAction.isEmpty()) return;

        String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "";

        // === یوٹیوب آٹومیشن لاجک ===
        if ("OPEN_YOUTUBE".equals(currentAction) && packageName.equals("com.google.android.youtube")) {
            
            // سٹیپ 1: سرچ والا بٹن (Magnifying Glass) ڈھونڈ کر کلک کرو
            if (currentStep == 1) {
                List<AccessibilityNodeInfo> searchButtons = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/menu_search");
                if (searchButtons.isEmpty()) {
                    // اگر ID سے نہ ملے تو نام (Content Description) سے ڈھونڈیں
                    searchButtons = rootNode.findAccessibilityNodeInfosByText("Search");
                }
                
                if (!searchButtons.isEmpty()) {
                    searchButtons.get(0).performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    currentStep = 2; // اگلے سٹیپ پر جائیں
                }
            }
            
            // سٹیپ 2: سرچ بار ڈھونڈو اور اس میں ٹائپ کرو
            else if (currentStep == 2) {
                List<AccessibilityNodeInfo> searchInputs = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/search_edit_text");
                if (!searchInputs.isEmpty()) {
                    AccessibilityNodeInfo inputNode = searchInputs.get(0);
                    
                    // سرچ بار میں ٹیکسٹ (actionData) لکھو
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, actionData);
                    inputNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    
                    // ابھی کے لیے کام ختم کریں (کیونکہ کی بورڈ کا Enter دبانا تھوڑا ٹرکی ہوتا ہے، وہ ہم اگلے حصے میں پرفیکٹ کریں گے)
                    currentStep = 0;
                    currentAction = "";
                }
            }
        }
    }

    @Override
    public void onInterrupt() {
        // سروس میں کوئی رکاوٹ آنے پر
    }

    // جب یوزر سیٹنگز سے پرمیشن آن کرے گا
    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        // سگنل ریسیور کو رجسٹر کریں
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"));
        }
        
        Toast.makeText(this, "عائشہ کے ہاتھ ایکٹو ہو گئے ہیں! 🦾", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
