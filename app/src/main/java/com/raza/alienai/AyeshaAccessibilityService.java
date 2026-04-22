package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
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
    public static String latestScreenText = "";
    
    private Queue<String> taskQueue = new LinkedList<>();
    private boolean isTaskRunning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            String data = intent.getStringExtra("data");
            
            if (action != null) {
                if (action.equals("MULTI_TASK") && data != null) {
                    String[] tasks = data.split("&&");
                    for (String task : tasks) {
                        taskQueue.add(task.trim());
                    }
                } else if (action.equals("ANALYZE_SCREEN") || action.equals("READ_SCREEN") || action.equals("TAKE_SCREENSHOT")) {
                    taskQueue.add(action + "||" + (data != null ? data : "none"));
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

        if (cmdType.equals("ANALYZE_SCREEN") || cmdType.equals("TAKE_SCREENSHOT") || cmdType.equals("READ_SCREEN")) {
            latestScreenText = extractAllText(); 
            takeAndSendScreenshot();
            mainHandler.postDelayed(this::processNextTask, 3000);
        } else if (cmdType.equals("APP")) {
            fastOpenApp(parts.length > 1 ? parts[1].trim() : "");
            mainHandler.postDelayed(this::processNextTask, 3000); 
        } else if (cmdType.equals("CLICK")) {
            smartClick(parts.length > 1 ? parts[1].trim() : "");
            mainHandler.postDelayed(this::processNextTask, 2000);
        } else if (cmdType.equals("SCROLL")) {
            performSmoothScroll(parts.length > 1 ? parts[1].trim() : "DOWN");
            mainHandler.postDelayed(this::processNextTask, 1500);
        } else if (cmdType.equals("VOLUME")) {
            changeVolume(parts.length > 1 ? parts[1].trim() : "MAX");
            mainHandler.postDelayed(this::processNextTask, 1000);
        } else { 
            processNextTask(); 
        }
    }

    private String extractAllText() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "سکرین پر کوئی ٹیکسٹ نہیں ہے۔";
        StringBuilder sb = new StringBuilder();
        extractTextFromNodes(root, sb);
        return sb.toString().trim();
    }

    private void extractTextFromNodes(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        if (node.getText() != null) sb.append(node.getText().toString()).append("\n"); 
        else if (node.getContentDescription() != null) sb.append(node.getContentDescription().toString()).append("\n");
        for (int i = 0; i < node.getChildCount(); i++) extractTextFromNodes(node.getChild(i), sb);
    }

    private void takeAndSendScreenshot() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult result) {
                    try {
                        HardwareBuffer hwBuffer = result.getHardwareBuffer();
                        Bitmap hwBitmap = Bitmap.wrapHardwareBuffer(hwBuffer, result.getColorSpace());
                        if (hwBitmap != null) {
                            Bitmap swBitmap = hwBitmap.copy(Bitmap.Config.ARGB_8888, false);
                            Bitmap resized = Bitmap.createScaledBitmap(swBitmap, swBitmap.getWidth()/3, swBitmap.getHeight()/3, true);
                            ByteArrayOutputStream bos = new ByteArrayOutputStream();
                            resized.compress(Bitmap.CompressFormat.JPEG, 15, bos);
                            latestScreenshotBase64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                            sendBroadcast(new Intent("SCREEN_ANALYZED"));
                            hwBuffer.close(); 
                            swBitmap.recycle(); 
                            resized.recycle();
                        } else { 
                            sendBroadcast(new Intent("SCREEN_ANALYZED"));
                        }
                    } catch (Exception e) { 
                        sendBroadcast(new Intent("SCREEN_ANALYZED"));
                    }
                }
                @Override public void onFailure(int i) { 
                    sendBroadcast(new Intent("SCREEN_ANALYZED")); 
                }
            });
        } else { 
            sendBroadcast(new Intent("SCREEN_ANALYZED")); 
        }
    }

    private void fastOpenApp(String targetApp) {
        PackageManager pm = getPackageManager();
        Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
        mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> appList = pm.queryIntentActivities(mainIntent, 0);
        
        boolean appFound = false;
        for (ResolveInfo info : appList) {
            String appLabel = info.loadLabel(pm).toString().toLowerCase();
            if (appLabel.contains(targetApp.toLowerCase())) {
                Intent launchIntent = pm.getLaunchIntentForPackage(info.activityInfo.packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launchIntent);
                    appFound = true;
                    break;
                }
            }
        }
        if (!appFound) {
            sendResultToChat("رضا بھائی، موبائل میں '" + targetApp + "' نہیں ملی۔");
        }
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
        if (direction.equals("DOWN")) { 
            path.moveTo(width / 2f, height * 0.8f); 
            path.lineTo(width / 2f, height * 0.2f); 
        } else { 
            path.moveTo(width / 2f, height * 0.2f); 
            path.lineTo(width / 2f, height * 0.8f); 
        }
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

    private void sendResultToChat(String msg) {
        Intent i = new Intent("NEW_MESSAGE_FROM_CALL");
        i.putExtra("message", msg);
        sendBroadcast(i);
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
                        
