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
import android.hardware.HardwareBuffer;
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
                // 🚨 میری پرانی غلطی یہیں تھی، اب یہ بالکل صحیح کمانڈ پکڑے گا 🚨
                if (action.equals("MULTI_TASK") && data != null) {
                    String[] tasks = data.split("&&");
                    for (String task : tasks) taskQueue.add(task.trim());
                } else if (action.equals("READ_SCREEN") || action.equals("TAKE_SCREENSHOT")) {
                    taskQueue.add(action);
                }
                
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
        } else if (cmdType.equals("READ_SCREEN")) {
            readScreenRealTime();
            mainHandler.postDelayed(this::processNextTask, 1000);
        } else if (cmdType.equals("TAKE_SCREENSHOT")) {
            takeAndSendScreenshot();
            mainHandler.postDelayed(this::processNextTask, 3000);
        } else {
            processNextTask();
        }
    }

    // 🚀 ایپ اوپن کرنے والا انجن (جو میں نے غلطی سے اڑا دیا تھا) 🚀
    private void openAppAndSearch(String targetApp, String targetContent) {
        PackageManager pm = getPackageManager();
        boolean appFound = false;
        for (ApplicationInfo packageInfo : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
            if (pm.getApplicationLabel(packageInfo).toString().toLowerCase().contains(targetApp.toLowerCase())) {
                Intent launchIntent = pm.getLaunchIntentForPackage(packageInfo.packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launchIntent);
                    appFound = true;
                    if (!targetContent.equals("none")) mainHandler.postDelayed(() -> smartClick(targetContent), 4000);
                }
                break;
            }
        }
        if (!appFound) {
            sendResultToChat("رضا بھائی، مجھے موبائل میں '" + targetApp + "' نام کی کوئی ایپ نہیں ملی۔");
        }
    }

    private void readScreenRealTime() {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) {
            sendResultToChat("SCREEN_DATA||سکرین پر کچھ پڑھنے کو نہیں ملا۔");
            return;
        }
        StringBuilder screenText = new StringBuilder();
        extractTextFromNodes(rootNode, screenText);
        String finalData = screenText.toString().trim();
        if (finalData.isEmpty()) finalData = "سکرین پر کوئی ٹیکسٹ نہیں ہے۔";
        sendResultToChat("SCREEN_DATA||" + finalData);
    }

    private void extractTextFromNodes(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        if (node.getText() != null) sb.append(node.getText().toString()).append(". ");
        else if (node.getContentDescription() != null) sb.append(node.getContentDescription().toString()).append(". ");
        for (int i = 0; i < node.getChildCount(); i++) extractTextFromNodes(node.getChild(i), sb);
    }

    private void takeAndSendScreenshot() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult screenshotResult) {
                    try {
                        HardwareBuffer hardwareBuffer = screenshotResult.getHardwareBuffer();
                        Bitmap hardwareBitmap = Bitmap.wrapHardwareBuffer(hardwareBuffer, screenshotResult.getColorSpace());
                        if (hardwareBitmap != null) {
                            Bitmap softwareBitmap = hardwareBitmap.copy(Bitmap.Config.ARGB_8888, false);
                            int width = softwareBitmap.getWidth() / 2;
                            int height = softwareBitmap.getHeight() / 2;
                            Bitmap resizedBitmap = Bitmap.createScaledBitmap(softwareBitmap, width, height, true);
                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 20, baos); 
                            latestScreenshotBase64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                            sendBroadcast(new Intent("SCREENSHOT_CAPTURED"));
                            hardwareBuffer.close();
                            if (!softwareBitmap.isRecycled()) softwareBitmap.recycle();
                            if (!resizedBitmap.isRecycled()) resizedBitmap.recycle();
                        }
                    } catch (Exception e) {
                        sendResultToChat("تصویر پروسیس کرنے میں مسئلہ آیا ہے۔");
                    }
                }
                @Override public void onFailure(int errorCode) { sendResultToChat("سکرین شاٹ لینے میں ایرر آ گیا۔"); }
            });
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
        if (nodes.isEmpty() && targetText.toLowerCase().contains("profile")) {
             nodes = rootNode.findAccessibilityNodeInfosByText("Ali Raza"); 
        }
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
            sendResultToChat("میں نے بٹن پر کلک کر دیا ہے۔");
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
        if (direction.equals("DOWN")) { path.moveTo(width / 2f, height * 0.8f); path.lineTo(width / 2f, height * 0.2f); }
        else { path.moveTo(width / 2f, height * 0.2f); path.lineTo(width / 2f, height * 0.8f); }
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
            
