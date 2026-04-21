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
import android.widget.Toast;
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
                for (String task : tasks) taskQueue.add(task.trim());
                if (!isTaskRunning) processNextTask();
            }
        }
    };

    private void processNextTask() {
        if (taskQueue.isEmpty()) { isTaskRunning = false; return; }
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
            performSmoothScroll(parts.length > 1 ? parts[1].trim() : "DOWN");
            mainHandler.postDelayed(this::processNextTask, 1500);
        } else if (cmdType.equals("CLICK")) {
            smartClick(parts.length > 1 ? parts[1].trim() : "");
            mainHandler.postDelayed(this::processNextTask, 2000);
        } else {
            processNextTask();
        }
    }

    private void sendResultToChat(String result) {
        Intent intent = new Intent("NEW_MESSAGE_FROM_CALL");
        intent.putExtra("message", result);
        sendBroadcast(intent);
    }

    private void smartClick(String targetText) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;
        List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByText(targetText);
        if (!nodes.isEmpty()) {
            clickFirstClickable(nodes.get(0));
            sendResultToChat("میں نے '" + targetText + "' پر کلک کر دیا ہے۔");
        } else {
            deepSearchByDescription(rootNode, targetText);
        }
    }

    private void deepSearchByDescription(AccessibilityNodeInfo node, String targetText) {
        if (node == null) return;
        CharSequence desc = node.getContentDescription();
        if (desc != null && desc.toString().toLowerCase().contains(targetText.toLowerCase())) {
            clickFirstClickable(node);
            sendResultToChat("میں نے سکرین پر آپ کے مطلوبہ بٹن پر کلک کر دیا ہے۔");
            return;
        }
        for (int i = 0; i < node.getChildCount(); i++) deepSearchByDescription(node.getChild(i), targetText);
    }

    private void clickFirstClickable(AccessibilityNodeInfo node) {
        if (node == null) return;
        if (node.isClickable()) node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        else clickFirstClickable(node.getParent());
    }

    private void performSmoothScroll(String direction) {
        int height = getResources().getDisplayMetrics().heightPixels;
        int width = getResources().getDisplayMetrics().widthPixels;
        Path path = new Path();
        if (direction.equals("DOWN")) path.moveTo(width / 2f, height * 0.8f); path.lineTo(width / 2f, height * 0.2f);
        else path.moveTo(width / 2f, height * 0.2f); path.lineTo(width / 2f, height * 0.8f);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 100, 500));
        dispatchGesture(builder.build(), null, null);
    }

    private void changeVolume(String level) {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, level.equals("MAX") ? max : 0, 0);
        }
    }

    private void openAppAndSearch(String targetApp, String targetContent) {
        PackageManager pm = getPackageManager();
        for (ApplicationInfo packageInfo : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
            if (pm.getApplicationLabel(packageInfo).toString().toLowerCase().contains(targetApp.toLowerCase())) {
                Intent launchIntent = pm.getLaunchIntentForPackage(packageInfo.packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launchIntent);
                    if (!targetContent.equals("none")) mainHandler.postDelayed(() -> smartClick(targetContent), 4000);
                }
                break;
            }
        }
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        IntentFilter filter = new IntentFilter("AI_COMMAND_BROADCAST");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(commandReceiver, filter);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
