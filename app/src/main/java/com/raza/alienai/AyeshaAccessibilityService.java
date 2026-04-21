package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Path;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

public class AyeshaAccessibilityService extends AccessibilityService {

    private Queue<String> taskQueue = new LinkedList<>();
    private boolean isTaskRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            String rawData = intent.getStringExtra("data"); 

            if ("MULTI_TASK".equals(action) && rawData != null) {
                String[] tasks = rawData.split("&&");
                for (String task : tasks) {
                    taskQueue.add(task.trim());
                }
                if (!isTaskRunning) processNextTask();
            }
        }
    };

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
            changeVolume(parts.length > 1 ? parts[1].trim() : "MAX");
            mainHandler.postDelayed(this::processNextTask, 1000);
        } else if (cmdType.equals("APP")) {
            openAppAndSearch(parts.length > 1 ? parts[1].trim() : "", parts.length > 2 ? parts[2].trim() : "none");
            mainHandler.postDelayed(this::processNextTask, 6000);
        } else if (cmdType.equals("SCROLL")) {
            // 🚀 نیا انسانی سوائپ (Gesture) 🚀
            performSmoothScroll(parts.length > 1 ? parts[1].trim() : "DOWN");
            mainHandler.postDelayed(this::processNextTask, 1500);
        } else if (cmdType.equals("CLICK")) {
            // 🚀 ڈیپ سرچ کلکر 🚀
            smartClick(parts.length > 1 ? parts[1].trim() : "");
            mainHandler.postDelayed(this::processNextTask, 2000);
        } else {
            processNextTask();
        }
    }

    private void changeVolume(String level) {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level.equals("MAX") ? max : 0, 0);
        }
    }

    // 📱 سمارٹ سوائپ (بالکل جیسے انسان انگلی سے کرتا ہے) 📱
    private void performSmoothScroll(String direction) {
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;

        Path path = new Path();
        if (direction.equals("DOWN")) {
            // نیچے سے اوپر کی طرف سوائپ (نیچے جانے کے لیے)
            path.moveTo(screenWidth / 2f, screenHeight * 0.8f);
            path.lineTo(screenWidth / 2f, screenHeight * 0.2f);
        } else {
            // اوپر سے نیچے کی طرف سوائپ (اوپر جانے کے لیے)
            path.moveTo(screenWidth / 2f, screenHeight * 0.2f);
            path.lineTo(screenWidth / 2f, screenHeight * 0.8f);
        }

        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 100, 500));
        dispatchGesture(builder.build(), null, null);
    }

    // 👁️ سمارٹ کلکر (نام، ڈسکرپشن اور بٹن سب چیک کرے گا) 👁️
    private void smartClick(String targetText) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        // 1. پہلے ٹیکسٹ سے ڈھونڈو (جیسے "Ali Raza")
        List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByText(targetText);
        
        // 2. اگر نہ ملے، تو "Profile" کے لفظ سے ہائبرڈ سرچ کرو
        if (nodes.isEmpty() && targetText.toLowerCase().contains("profile")) {
            nodes = rootNode.findAccessibilityNodeInfosByText("Ali Raza"); // بیک اپ: اپنا نام ڈھونڈو
        }

        if (!nodes.isEmpty()) {
            clickFirstClickable(nodes.get(0));
        } else {
            // 3. اگر ابھی بھی نہ ملے، تو سکرین کے تمام بٹنز کی "خفیہ ڈسکرپشن" چیک کرو
            deepSearchByDescription(rootNode, targetText);
        }
    }

    private void deepSearchByDescription(AccessibilityNodeInfo node, String targetText) {
        if (node == null) return;
        
        CharSequence desc = node.getContentDescription();
        if (desc != null && desc.toString().toLowerCase().contains(targetText.toLowerCase())) {
            clickFirstClickable(node);
            return;
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            deepSearchByDescription(node.getChild(i), targetText);
        }
    }

    private void clickFirstClickable(AccessibilityNodeInfo node) {
        if (node == null) return;
        if (node.isClickable()) {
            node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        } else {
            clickFirstClickable(node.getParent());
        }
    }

    private void openAppAndSearch(String targetApp, String targetContent) {
        PackageManager pm = getPackageManager();
        try {
            Intent launchIntent = pm.getLaunchIntentForPackage(getPackagePath(targetApp));
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launchIntent);
                if (!targetContent.equals("none")) {
                    mainHandler.postDelayed(() -> smartClick(targetContent), 4000);
                }
            }
        } catch (Exception e) { }
    }

    private String getPackagePath(String targetApp) {
        PackageManager pm = getPackageManager();
        List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        for (ApplicationInfo packageInfo : packages) {
            String appName = pm.getApplicationLabel(packageInfo).toString();
            if (appName.toLowerCase().contains(targetApp.toLowerCase())) return packageInfo.packageName;
        }
        return "";
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        IntentFilter filter = new IntentFilter("AI_COMMAND_BROADCAST");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(commandReceiver, filter);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
