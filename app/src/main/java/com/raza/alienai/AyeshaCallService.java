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
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
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
    
    // 🚀 سرور کی ڈیمانڈ کے مطابق پرفیکٹ آڈیو سیٹنگ 🚀
    private static final int SAMPLE_RATE = 16000;
    private static final int FRAME_SIZE = 960; 

    private AcousticEchoCanceler aec;
    private NoiseSuppressor ns;
    private AutomaticGainControl agc;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_SERVICE.equals(intent.getAction())) {
            endCallCompletely();
            return START_NOT_STICKY;
        }

        isCallActive = true;
        startCallForeground(); 
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        // 🚀 VoIP موڈ تاکہ اینڈرائیڈ مائیک کو روکے نہیں 🚀
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION); 
        audioManager.setSpeakerphoneOn(true);
        
        int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
        audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVol, 0);
        
        audioManager.requestAudioFocus(focusChange -> {}, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
        
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
                startAudioRecording();
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    if (json.has("text")) {
                        String reply = json.getString("text");
                        
                        // 🚀 کمانڈز کو فلٹر کر کے براڈکاسٹ کرنا 🚀
                        processBackgroundActions(reply); 
                        
                        Intent uiIntent = new Intent("NEW_MESSAGE_FROM_CALL");
                        uiIntent.putExtra("message", reply);
                        sendBroadcast(uiIntent);
                        
                        // 🚀 کلین ٹیکسٹ (بغیر کمانڈ کے) پڑھنا 🚀
                        speak(reply.replaceAll("\\[.*?\\]", "").trim());
                    }
                } catch (Exception e) {}
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) { stopAudioRecording(); }
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) { stopAudioRecording(); }
        });
    }

    private void startAudioRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        
        int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int bufferSize = Math.max(FRAME_SIZE, minBufferSize);
        
        // 🚀 اینڈرائیڈ 14 کی سیکیورٹی سے بچنے کے لیے اسے واپس MIC کر دیا گیا ہے 🚀
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            Log.e("AyeshaCallService", "Mic failed to initialize!");
            return;
        }

        int audioSessionId = audioRecord.getAudioSessionId();

        try {
            if (AcousticEchoCanceler.isAvailable()) {
                aec = AcousticEchoCanceler.create(audioSessionId);
                if (aec != null) aec.setEnabled(true);
            }
            if (NoiseSuppressor.isAvailable()) {
                ns = NoiseSuppressor.create(audioSessionId);
                if (ns != null) ns.setEnabled(true);
            }
            if (AutomaticGainControl.isAvailable()) {
                agc = AutomaticGainControl.create(audioSessionId);
                if (agc != null) agc.setEnabled(true);
            }
        } catch (Exception e) {
            Log.e("AyeshaCallService", "Hardware Filters Error", e);
        }

        audioRecord.startRecording();
        isRecording = true;
        
        recordingThread = new Thread(() -> {
            byte[] buffer = new byte[FRAME_SIZE]; // 🚀 بالکل 960 بائٹس سرور کے لیے 🚀
            while (isRecording) {
                int read = audioRecord.read(buffer, 0, buffer.length);
                // 🚀 جب عائشہ بول رہی ہو تو ہماری آواز سرور پر نہ جائے (Echo Prevention) 🚀
                if (read > 0 && webSocket != null && !tts.isSpeaking() && !isMutedByUser) {
                    webSocket.send(ByteString.of(buffer, 0, read));
                }
            }
        });
        recordingThread.start();
    }

    private void stopAudioRecording() {
        isRecording = false;
        if (audioRecord != null) { audioRecord.stop(); audioRecord.release(); audioRecord = null; }
        if (recordingThread != null) { recordingThread.interrupt(); recordingThread = null; }
        
        if (aec != null) { aec.release(); aec = null; }
        if (ns != null) { ns.release(); ns = null; }
        if (agc != null) { agc.release(); agc = null; }
    }

    private void startCallForeground() {
        String channelId = "AYESHA_CALL";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true).build();
                
        // 🚀 فورگراؤنڈ مائیکروفون پرمیشن تاکہ سکرین بند ہونے پر بھی مائیک کٹ نہ ہو 🚀
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, notification);
        }
    }

    private void processBackgroundActions(String text) {
        // 🚀 ایپس کھولنے والی کمانڈ کو کیچ کرنا 🚀
        Pattern pattern = Pattern.compile("\\[ACTION:\\s*(.*?)(?:,\\s*DATA:\\s*(.*?))?\\]", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            Intent intent = new Intent("AI_COMMAND_BROADCAST");
            intent.putExtra("action", matcher.group(1).trim());
            intent.putExtra("data", matcher.group(2) != null ? matcher.group(2).trim() : "none");
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        }
    }

    private void speak(String text) { 
        if (tts != null && !text.isEmpty()) { 
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL);
            tts.speak(text, TextToSpeech.QUEUE_ADD, params, "AYESHA_TTS_" + System.currentTimeMillis()); 
        } 
    }

    @Override public void onInit(int status) { 
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK")); 
        }
    }
    
    private void playConnectSound() { 
        ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100); 
        tg.startTone(ToneGenerator.TONE_PROP_BEEP, 150); 
    }

    private void endCallCompletely() {
        isCallActive = false;
        stopAudioRecording();
        if (webSocket != null) webSocket.close(1000, "Ended");
        if (audioManager != null) { 
            audioManager.setSpeakerphoneOn(false); 
            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.abandonAudioFocus(focusChange -> {});
        }
        if (tts != null) { tts.stop(); tts.shutdown(); }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); tts = new TextToSpeech(this, this); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
