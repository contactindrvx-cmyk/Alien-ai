package com.raza.alienai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";

    private TextToSpeech tts;
    private AudioManager audioManager;
    
    private boolean isCallActive = false;
    public static boolean isMutedByUser = false; 
    
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    
    private OkHttpClient client;
    private WebSocket webSocket;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private Thread recordingThread;
    private static final int SAMPLE_RATE = 16000;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_SERVICE.equals(action)) {
                endCallCompletely();
                return START_NOT_STICKY;
            } else if (ACTION_MUTE_CALL.equals(action)) {
                isMutedByUser = intent.getBooleanExtra("isMuted", false); 
                return START_STICKY;
            }
        }
        
        isCallActive = true;
        startCallForeground(); 
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn(true);
        
        client = new OkHttpClient();
        connectWebSocket();
        
        playConnectSound();
        
        return START_STICKY;
    }

    private void connectWebSocket() {
        Request request = new Request.Builder().url("wss://ayesha.aigrowthbox.com/ws/audio").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                mainHandler.postDelayed(() -> startAudioRecording(), 300);
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    if (json.has("text")) {
                        String reply = json.getString("text");
                        processBackgroundActions(reply);
                        
                        Intent uiIntent = new Intent("NEW_MESSAGE_FROM_CALL");
                        uiIntent.putExtra("message", reply);
                        sendBroadcast(uiIntent);
                        
                        speak(reply.replaceAll("\\[.*?\\]", "").trim());
                    }
                } catch (Exception e) {
                    Log.e("AyeshaWS", "JSON Parse Error", e);
                }
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                stopAudioRecording();
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                stopAudioRecording();
            }
        });
    }

    private void startAudioRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        
        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        // 🚀 اصل اور صاف مائیک سورس تاکہ WebRTC اسے آسانی سے پہچان سکے 🚀
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            return;
        }

        audioRecord.startRecording();
        isRecording = true;
        
        recordingThread = new Thread(() -> {
            byte[] buffer = new byte[bufferSize];
            while (isRecording && !isMutedByUser) {
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read > 0 && webSocket != null && !tts.isSpeaking()) {
                    // 🚀 آڈیو بوسٹر اڑا دیا گیا ہے! اب صاف آواز سرور پر جائے گی 🚀
                    webSocket.send(ByteString.of(buffer, 0, read));
                }
            }
        });
        recordingThread.start();
    }

    private void stopAudioRecording() {
        isRecording = false;
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }
        if (recordingThread != null) {
            recordingThread.interrupt();
            recordingThread = null;
        }
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "عائشہ لائیو کال", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال")
                .setContentText("عائشہ آپ کی آواز سن رہی ہے...")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, notification);
        }
    }

    private void processBackgroundActions(String text) {
        Pattern pattern = Pattern.compile("\\[ACTION:\\s*(.*?)(?:,\\s*DATA:\\s*(.*?))?\\]", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String action = matcher.group(1).trim();
            String data = matcher.group(2) != null ? matcher.group(2).trim() : "none";
            if (action.contains("||") && !action.contains("MULTI_TASK")) {
                data = action;
                action = "MULTI_TASK";
            }
            Intent intent = new Intent("AI_COMMAND_BROADCAST");
            intent.putExtra("action", action);
            intent.putExtra("data", data);
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        }
    }

    private void speak(String text) { 
        if (tts != null && !text.isEmpty()) { 
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL);
            tts.speak(text, TextToSpeech.QUEUE_ADD, params, "AyeshaCallID_" + System.currentTimeMillis()); 
        } 
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
        }
    }

    private void playConnectSound() {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100);
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150);
            mainHandler.postDelayed(toneGen::release, 300);
        } catch (Exception ignored) {}
    }

    private void endCallCompletely() {
        isCallActive = false;
        stopAudioRecording();
        if (webSocket != null) {
            webSocket.close(1000, "Call Ended");
        }
        if (audioManager != null) {
            audioManager.setSpeakerphoneOn(false);
            audioManager.setMode(AudioManager.MODE_NORMAL);
        }
        if (tts != null) { tts.stop(); tts.shutdown(); }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); tts = new TextToSpeech(this, this); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
