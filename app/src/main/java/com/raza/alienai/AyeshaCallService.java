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
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.media.ToneGenerator;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;
import org.vosk.Recognizer;

import java.io.File;
import java.io.FileOutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";
    public static final String ACTION_STOP_AUDIO = "ACTION_STOP_AUDIO";

    private AudioManager audioManager;
    private boolean isCallActive = false;
    public static boolean isMutedByUser = false; 
    
    private OkHttpClient client;
    private WebSocket webSocket;
    
    // 🚀 Vosk STT اور آڈیو پلے بیک 🚀
    private Recognizer voskRecognizer;
    private AudioRecord audioRecord;
    private MediaPlayer mediaPlayer;
    private boolean isRecording = false;
    private boolean isAyeshaSpeaking = false;
    private Thread recordingThread;
    
    private static final int SAMPLE_RATE = 16000;
    
    private AcousticEchoCanceler aec;
    private NoiseSuppressor ns;
    private AutomaticGainControl agc;

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
            } else if (ACTION_STOP_AUDIO.equals(action)) {
                stopMediaPlayer();
                return START_STICKY;
            }
        }

        if (!isCallActive) {
            isCallActive = true;
            startCallForeground(); 
            
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION); 
            audioManager.setSpeakerphoneOn(true);
            
            int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVol, 0);
            audioManager.requestAudioFocus(focusChange -> {}, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
            
            client = new OkHttpClient();
            connectWebSocket();
            playConnectSound();
        }
        return START_STICKY;
    }

    private void connectWebSocket() {
        // 🚀 اب ہم ٹیکسٹ والے راکٹ روٹ سے جڑ رہے ہیں 🚀
        Request request = new Request.Builder().url("wss://ayesha.aigrowthbox.com/ws/text_chat").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                startVoskRecording();
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    String reply = json.optString("text", "");
                    String audioB64 = json.optString("audio", "");
                    
                    if (!reply.isEmpty()) {
                        processBackgroundActions(reply); 
                        
                        Intent uiIntent = new Intent("NEW_MESSAGE_FROM_CALL");
                        uiIntent.putExtra("message", reply);
                        sendBroadcast(uiIntent);
                    }
                    
                    if (!audioB64.isEmpty()) {
                        playBase64Audio(audioB64);
                    }
                } catch (Exception e) {}
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) { stopVoskRecording(); }
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) { stopVoskRecording(); }
        });
    }

    private void startVoskRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        if (MainActivity.voskModel == null) {
            Log.e("AyeshaCall", "Vosk Model not loaded yet!");
            return;
        }

        try {
            voskRecognizer = new Recognizer(MainActivity.voskModel, SAMPLE_RATE);
            int minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            int bufferSize = Math.max(4096, minBufferSize);
            
            audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
            
            int audioSessionId = audioRecord.getAudioSessionId();
            if (AcousticEchoCanceler.isAvailable()) { aec = AcousticEchoCanceler.create(audioSessionId); if (aec != null) aec.setEnabled(true); }
            if (NoiseSuppressor.isAvailable()) { ns = NoiseSuppressor.create(audioSessionId); if (ns != null) ns.setEnabled(true); }
            if (AutomaticGainControl.isAvailable()) { agc = AutomaticGainControl.create(audioSessionId); if (agc != null) agc.setEnabled(true); }

            audioRecord.startRecording();
            isRecording = true;
            
            recordingThread = new Thread(() -> {
                byte[] buffer = new byte[4096];
                while (isRecording) {
                    int read = audioRecord.read(buffer, 0, buffer.length);
                    // 🚀 ایکو سے بچنے کے لیے: جب عائشہ بول رہی ہو یا یوزر نے میوٹ کیا ہو، تو سننا بند 🚀
                    if (isAyeshaSpeaking || isMutedByUser) continue;

                    if (read > 0) {
                        // 🚀 Vosk جادو: جیسے ہی یوزر چپ ہوگا، یہ true دے گا 🚀
                        if (voskRecognizer.acceptWaveForm(buffer, read)) {
                            String jsonResult = voskRecognizer.getResult();
                            try {
                                JSONObject obj = new JSONObject(jsonResult);
                                String recognizedText = obj.optString("text", "");
                                if (recognizedText.trim().length() > 2 && webSocket != null) {
                                    // 🚀 صرف سمارٹ ٹیکسٹ سرور کو بھیجو (کوئی آڈیو اپلوڈ نہیں ہوگی) 🚀
                                    JSONObject payload = new JSONObject();
                                    payload.put("text", recognizedText);
                                    webSocket.send(payload.toString());
                                }
                            } catch (Exception e) {}
                        }
                    }
                }
            });
            recordingThread.start();
        } catch (Exception e) {
            Log.e("AyeshaCall", "Vosk Setup Error", e);
        }
    }

    private void stopVoskRecording() {
        isRecording = false;
        if (audioRecord != null) { audioRecord.stop(); audioRecord.release(); audioRecord = null; }
        if (recordingThread != null) { recordingThread.interrupt(); recordingThread = null; }
        if (voskRecognizer != null) { voskRecognizer.close(); voskRecognizer = null; }
        if (aec != null) { aec.release(); aec = null; }
        if (ns != null) { ns.release(); ns = null; }
        if (agc != null) { agc.release(); agc = null; }
    }

    private void playBase64Audio(String base64String) {
        try {
            isAyeshaSpeaking = true;
            byte[] decodedAudio = Base64.decode(base64String, Base64.DEFAULT);
            File tempAudioFile = File.createTempFile("ayesha_voice", ".mp3", getCacheDir());
            FileOutputStream fos = new FileOutputStream(tempAudioFile);
            fos.write(decodedAudio);
            fos.close();

            stopMediaPlayer(); // پرانی آڈیو روک دو
            
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_VOICE_CALL);
            mediaPlayer.setDataSource(tempAudioFile.getAbsolutePath());
            mediaPlayer.prepare();
            mediaPlayer.setOnCompletionListener(mp -> {
                isAyeshaSpeaking = false;
                mp.release();
                mediaPlayer = null;
                tempAudioFile.delete();
            });
            mediaPlayer.start();
        } catch (Exception e) {
            isAyeshaSpeaking = false;
            Log.e("AyeshaCall", "Audio Playback Error", e);
        }
    }

    private void stopMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception e) {}
            mediaPlayer = null;
        }
        isAyeshaSpeaking = false;
    }

    private void startCallForeground() {
        String channelId = "AYESHA_CALL";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال (Vosk Mode)")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true).build();
                
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
            Intent intent = new Intent("AI_COMMAND_BROADCAST");
            intent.putExtra("action", matcher.group(1).trim());
            intent.putExtra("data", matcher.group(2) != null ? matcher.group(2).trim() : "none");
            intent.setPackage(getPackageName());
            sendBroadcast(intent);
        }
    }

    private void playConnectSound() { 
        ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100); 
        tg.startTone(ToneGenerator.TONE_PROP_BEEP, 150); 
    }

    private void endCallCompletely() {
        isCallActive = false;
        stopVoskRecording();
        stopMediaPlayer();
        if (webSocket != null) webSocket.close(1000, "Ended");
        if (audioManager != null) { 
            audioManager.setSpeakerphoneOn(false); 
            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.abandonAudioFocus(focusChange -> {});
        }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
            }
            
