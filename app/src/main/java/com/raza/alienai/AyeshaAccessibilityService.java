package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

public class AyeshaAccessibilityService extends AccessibilityService {

    // 🚀 کاموں کی قطار (Task Queue) 🚀
    private Queue<String> taskQueue = new LinkedList<>();
    private boolean isTaskRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            String rawData = intent.getStringExtra("data"); 

            if ("MULTI_TASK".equals(action) && rawData != null) {
                // تمام کمانڈز کو && کے ذریعے الگ کر کے قطار میں لگائیں
                String[] tasks = rawData.split("&&");
                for (String task : tasks) {
                    taskQueue.add(task.trim());
                }
                
                // اگر کوئی کام پہلے سے نہیں چل رہا، تو قطار شروع کریں
                if (!isTaskRunning) {
                    processNextTask();
                }
            }
        }
    };

    // 🧠 ملٹی ٹاسک مینیجر 🧠
    private void processNextTask() {
        if (taskQueue.isEmpty()) {
            isTaskRunning = false;
            return;
        }

        isTaskRunning = true;
        String currentTask = taskQueue.poll();
        String[] parts = currentTask.split("\\|\\|");
        String cmdType = parts[0].trim();

        if (cmdType.equals("VOLUME")) {
            String level = parts.length > 1 ? parts[1].trim() : "MAX";
            changeVolume(level);
            mainHandler.postDelayed(this::processNextTask, 1000);
            
        } else if (cmdType.equals("APP")) {
            String appName = parts.length > 1 ? parts[1].trim() : "";
            String targetData = parts.length > 2 ? parts[2].trim() : "none";
            openAppAndSearch(appName, targetData);
            mainHandler.postDelayed(this::processNextTask, 6000);
            
        } else if (cmdType.equals("SCROLL")) {
            // 🌟 نیا سکرول فنکشن 🌟
            String direction = parts.length > 1 ? parts[1].trim() : "DOWN";
            performScroll(direction);
            mainHandler.postDelayed(this::processNextTask, 1500); // سکرول کے بعد 1.5 سیکنڈ رکو
            
        } else if (cmdType.equals("CLICK")) {
            // 🌟 نیا ڈائنامک کلک فنکشن 🌟
            String targetData = parts.length > 1 ? parts[1].trim() : "";
            universalScreenClicker(targetData);
            mainHandler.postDelayed(this::processNextTask, 2000); // کلک کے بعد 2 سیکنڈ رکو
            
        } else {
            // اگر کمانڈ سمجھ نہ آئے تو اگلا کام پکڑیں
            processNextTask();
        }
    }

    // 🔊 والیوم کنٹرولر 🔊
    private void changeVolume(String level) {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            if (level.equals("MAX")) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVolume, AudioManager.FLAG_SHOW_UI);
                Toast.makeText(this, "عائشہ نے والیوم فل کر دیا ہے 🔊", Toast.LENGTH_SHORT).show();
            } else if (level.equals("MIN")) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, AudioManager.FLAG_SHOW_UI);
                Toast.makeText(this, "عائشہ نے والیوم کم کر دیا ہے 🔈", Toast.LENGTH_SHORT).show();
            }
        }
    }

    // 📱 یونیورسل ایپ اوپنر 📱
    private void openAppAndSearch(String targetApp, String targetContent) {
        PackageManager pm = getPackageManager();
        List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        String appPackageName = null;
        
        for (ApplicationInfo packageInfo : packages) {
            String appName = pm.getApplicationLabel(packageInfo).toString();
            if (appName.toLowerCase().contains(targetApp.toLowerCase())) {
                appPackageName = packageInfo.packageName;
                break;
            }
        }
        
        if (appPackageName != null) {
            Intent launchIntent = pm.getLaunchIntentForPackage(appPackageName);
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launchIntent);
                Toast.makeText(this, "عائشہ " + targetApp + " کھول رہی ہے...", Toast.LENGTH_SHORT).show();
                
                if (!targetContent.equals("none") && !targetContent.isEmpty()) {
                    mainHandler.postDelayed(() -> universalScreenClicker(targetContent), 4000);
                }
            }
        } else {
            Toast.makeText(this, "موبائل میں '" + targetApp + "' نہیں ملی!", Toast.LENGTH_SHORT).show();
        }
    }

    // 📜 نیا سکرولنگ فنکشن (Scroll Magic) 📜
    private void performScroll(String direction) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        AccessibilityNodeInfo scrollableNode = findScrollableNode(rootNode);
        if (scrollableNode != null) {
            if (direction.equals("DOWN")) {
                scrollableNode.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
                Toast.makeText(this, "عائشہ سکرول ڈاؤن کر رہی ہے ⬇️", Toast.LENGTH_SHORT).show();
            } else if (direction.equals("UP")) {
                scrollableNode.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
                Toast.makeText(this, "عائشہ سکرول اپ کر رہی ہے ⬆️", Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(this, "اس سکرین پر سکرول نہیں ہو سکتا۔", Toast.LENGTH_SHORT).show();
        }
    }

    // سکرول ہونے والی جگہ (لسٹ یا پیج) کو ڈھونڈنے کے لیے
    private AccessibilityNodeInfo findScrollableNode(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isScrollable()) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo result = findScrollableNode(node.getChild(i));
            if (result != null) return result;
        }
        return null;
    }

    // 👁️ سکرین کو پڑھ کر ڈائنامک کلک کرنے والا فنکشن 👁️
    private void universalScreenClicker(String targetText) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        List<AccessibilityNodeInfo> foundNodes = rootNode.findAccessibilityNodeInfosByText(targetText);
        
        if (!foundNodes.isEmpty()) {
            AccessibilityNodeInfo target = foundNodes.get(0);
            while (target != null && !target.isClickable()) {
                target = target.getParent();
            }
            if (target != null) {
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                Toast.makeText(this, "عائشہ نے '" + targetText + "' پر کلک کر دیا! ✅", Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(this, "سکرین پر '" + targetText + "' نہیں ملا۔", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

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
        Toast.makeText(this, "عائشہ کا ملٹی ٹاسک ایجنٹ ایکٹو ہو گیا ہے! 🤖", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
