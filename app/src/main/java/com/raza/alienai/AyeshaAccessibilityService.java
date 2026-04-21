package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.ByteArrayOutputStream;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

public class AyeshaAccessibilityService extends AccessibilityService {

    public static String latestScreenshotBase64 = "";
    private Queue<String> taskQueue = new LinkedList<>();
    private boolean isTaskRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            String data = intent.getStringExtra("data");
            if (action != null) {
                if (action.equals("MULTI_TASK") || action.equals("READ_SCREEN") || action.equals("TAKE_SCREENSHOT")) {
                    taskQueue.add(action + "||" + (data != null ? data : "none"));
                    if (!isTaskRunning) processNextTask();
                }
            }
        }
    };

    private void processNextTask() {
        if (taskQueue.isEmpty()) { isTaskRunning = false; return; }
        isTaskRunning = true;
        String currentTask = taskQueue.poll();
        String[] parts = currentTask.split("\\|\\|");
        String cmdType = parts[0].trim();

        if (cmdType.equals("READ_SCREEN")) {
            readScreenRealTime();
            mainHandler.postDelayed(this::processNextTask, 1000);
        } else if (cmdType.equals("TAKE_SCREENSHOT")) {
            takeAndSendScreenshot();
            mainHandler.postDelayed(this::processNextTask, 3000);
        } else if (cmdType.equals("SCROLL")) {
            performSmoothScroll(parts.length > 1 ? parts[1] : "DOWN");
            mainHandler.postDelayed(this::processNextTask, 1500);
        } else if (cmdType.equals("CLICK")) {
            smartClick(parts.length > 1 ? parts[1] : "");
            mainHandler.postDelayed(this::processNextTask, 2000);
        } else if (cmdType.equals("APP")) {
            openApp(parts.length > 1 ? parts[1] : "");
            mainHandler.postDelayed(this::processNextTask, 5000);
        } else { processNextTask(); }
    }

    private void readScreenRealTime() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) { sendResultToChat("SCREEN_DATA||سکرین خالی ہے۔"); return; }
        StringBuilder sb = new StringBuilder();
        extractText(root, sb);
        sendResultToChat("SCREEN_DATA||" + sb.toString());
    }

    private void extractText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        if (node.getText() != null) sb.append(node.getText()).append(" ");
        for (int i = 0; i < node.getChildCount(); i++) extractText(node.getChild(i), sb);
    }

    private void takeAndSendScreenshot() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult result) {
                    try {
                        Bitmap hwBitmap = Bitmap.wrapHardwareBuffer(result.getHardwareBuffer(), result.getColorSpace());
                        Bitmap swBitmap = hwBitmap.copy(Bitmap.Config.ARGB_8888, false);
                        Bitmap resized = Bitmap.createScaledBitmap(swBitmap, swBitmap.getWidth()/2, swBitmap.getHeight()/2, true);
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        resized.compress(Bitmap.CompressFormat.JPEG, 15, bos);
                        latestScreenshotBase64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                        sendBroadcast(new Intent("SCREENSHOT_CAPTURED"));
                        swBitmap.recycle(); resized.recycle();
                    } catch (Exception e) { sendResultToChat("تصویر دیکھنے میں مسئلہ ہوا۔"); }
                }
                @Override public void onFailure(int i) { sendResultToChat("سکرین شاٹ فیل ہو گیا۔"); }
            });
        }
    }

    private void sendResultToChat(String msg) {
        Intent i = new Intent("NEW_MESSAGE_FROM_CALL");
        i.putExtra("message", msg);
        sendBroadcast(i);
    }

    private void openApp(String appName) {
        PackageManager pm = getPackageManager();
        Intent intent = pm.getLaunchIntentForPackage(appName); // Simple for now
        if (intent != null) { intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(intent); }
    }

    private void smartClick(String text) { /* Previous logic */ }
    private void performSmoothScroll(String dir) { /* Previous logic */ }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}
    @Override protected void onServiceConnected() {
        super.onServiceConnected();
        registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"), Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? Context.RECEIVER_NOT_EXPORTED : 0);
    }
}
