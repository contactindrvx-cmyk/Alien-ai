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
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
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

    private OkHttpClient httpClient;
    private WebSocket webSocket;
    private AudioRecord audioRecord;
    private AudioTrack audioTrack;
    
    private boolean isRecording = false;
    private boolean isAyeshaSpeaking = false;
    private Thread recordingThread;
    private Handler mainHandler;

    private static final int SAMPLE_RATE = 16000;
    // 🚀 سمارٹ سینسر: 24 گھنٹے جاگے گی، لیکن صرف تب سنے گی جب آپ بولیں گے 🚀
    private static final int SILENCE_THRESHOLD = 500; 

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
                isAyeshaSpeaking = false;
                return START_STICKY;
            }
        }

        if (!isCallActive) {
            isCallActive = true;
            mainHandler = new Handler(Looper.getMainLooper());
            startCallForeground(); 
            
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION); 
            audioManager.setSpeakerphoneOn(true);
            
            int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVol, 0);
            audioManager.requestAudioFocus(focusChange -> {}, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
            
            // 🚀 لائیو آڈیو سننے کے لیے پلیئر سیٹ اپ 🚀
            initAudioTrack();
            
            httpClient = new OkHttpClient();
            connectToLiveServer();
            playConnectSound();
        }
        return START_STICKY;
    }

    private void initAudioTrack() {
        int minBufferSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioTrack = new AudioTrack(
                AudioManager.STREAM_VOICE_CALL,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                Math.max(minBufferSize, 4096),
                AudioTrack.MODE_STREAM
        );
        audioTrack.play();
    }

    private void connectToLiveServer() {
        // 🚀 ہمارا نیا لائیو ویب ساکٹ روٹ 🚀
        Request request = new Request.Builder().url("wss://ayesha.aigrowthbox.com/ws/live").build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                startDirectMic();
                showToast("لائیو کنکشن جڑ گیا ہے! (Gemini 3.0 Live)");
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    
                    // 🚀 1. اگر سرور سے اصلی آڈیو آ رہی ہے 🚀
                    if (json.has("audio")) {
                        isAyeshaSpeaking = true;
                        byte[] pcmData = Base64.decode(json.getString("audio"), Base64.DEFAULT);
                        if (audioTrack != null) {
                            audioTrack.write(pcmData, 0, pcmData.length);
                        }
                        resetSpeakingFlag(); // تھوڑی دیر بعد مائیک دوبارہ آن کر دے گا
                    }
                    
                    // 🚀 2. اگر سرور نے کوئی ٹیکسٹ کمانڈ (App/YouTube چلانا) بھیجی ہے 🚀
                    if (json.has("text")) {
                        String reply = json.getString("text");
                        if (!reply.isEmpty()) {
                            processActions(reply);
                            sendBroadcast(new Intent("NEW_MESSAGE_FROM_CALL").putExtra("message", reply));
                        }
                    }
                } catch (Exception e) {}
            }

            @Override public void onClosed(WebSocket webSocket, int code, String reason) { stopRecording(); showToast("کال ڈس کنیکٹ ہو گئی۔"); }
            @Override public void onFailure(WebSocket webSocket, Throwable t, Response response) { stopRecording(); showToast("سرور ایرر: کنکشن ٹوٹ گیا۔"); }
        });
    }

    private void resetSpeakingFlag() {
        mainHandler.removeCallbacksAndMessages(null);
        mainHandler.postDelayed(() -> isAyeshaSpeaking = false, 800);
    }

    private void startDirectMic() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;

        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int finalBufferSize = Math.max(4096, bufferSize);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, finalBufferSize);
        
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) return;

        audioRecord.startRecording();
        isRecording = true;

        recordingThread = new Thread(() -> {
            short[] audioData = new short[finalBufferSize / 2];
            while (isRecording) {
                // 🚀 ایکو کینسلیشن: جب عائشہ بول رہی ہو تو مائیک بند 🚀
                if (isAyeshaSpeaking || isMutedByUser) {
                    continue;
                }

                int read = audioRecord.read(audioData, 0, audioData.length);
                if (read > 0) {
                    double rms = calculateRMS(audioData, read);
                    
                    // 🚀 صرف تب آڈیو بھیجو جب آپ بول رہے ہوں (تاکہ گوگل بین نہ کرے) 🚀
                    if (rms > SILENCE_THRESHOLD) {
                        byte[] bytes = shortToByte(audioData, read);
                        String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                        
                        try {
                            JSONObject json = new JSONObject();
                            json.put("realtime_input", b64);
                            if (webSocket != null) {
                                webSocket.send(json.toString());
                            }
                        } catch (Exception e) {}
                    }
                }
            }
        });
        recordingThread.start();
    }

    private double calculateRMS(short[] data, int read) {
        double sum = 0;
        for (int i = 0; i < read; i++) sum += data[i] * data[i];
        return Math.sqrt(sum / read);
    }

    private byte[] shortToByte(short[] data, int read) {
        ByteBuffer bb = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < read; i++) bb.putShort(data[i]);
        return bb.array();
    }

    private void processActions(String text) {
        Pattern p = Pattern.compile("\\[ACTION:\\s*(.*?)(?:,\\s*DATA:\\s*(.*?))?\\]", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        while (m.find()) {
            Intent i = new Intent("AI_COMMAND_BROADCAST");
            i.putExtra("action", m.group(1).trim());
            i.putExtra("data", m.group(2) != null ? m.group(2).trim() : "none");
            i.setPackage(getPackageName());
            sendBroadcast(i);
        }
    }

    private void startCallForeground() {
        String cid = "AYESHA_VOIP";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(cid, "Ayesha Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
        Notification n = new NotificationCompat.Builder(this, cid)
                .setContentTitle("عائشہ لائیو کال")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true).build();
                
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, n);
        }
    }

    private void playConnectSound() { 
        ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100); 
        tg.startTone(ToneGenerator.TONE_PROP_BEEP, 150); 
    }

    private void showToast(String message) {
        if (mainHandler != null) {
            mainHandler.post(() -> Toast.makeText(AyeshaCallService.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    private void stopRecording() {
        isRecording = false;
        if (audioRecord != null) { audioRecord.stop(); audioRecord.release(); audioRecord = null; }
        if (recordingThread != null) { recordingThread.interrupt(); recordingThread = null; }
    }

    private void endCallCompletely() {
        isCallActive = false;
        stopRecording();
        if (audioTrack != null) {
            audioTrack.stop();
            audioTrack.release();
            audioTrack = null;
        }
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
    @Override public IBinder onBind(Intent i) { return null; }
            }
    
