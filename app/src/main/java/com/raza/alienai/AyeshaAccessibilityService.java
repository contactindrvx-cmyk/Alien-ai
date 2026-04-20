package com.raza.alienai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.util.Locale;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";

    private static final int SAMPLE_RATE = 16000;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private WebSocket webSocket;
    private TextToSpeech tts;
    private AudioManager audioManager;
    private TelephonyManager telephonyManager;
    
    private boolean isMutedBySystem = false;
    public static boolean isMutedByUser = false; // نیا: یوزر کا میوٹ بٹن
    private boolean isAyeshaSpeaking = false;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_SERVICE.equals(action)) {
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            } else if (ACTION_MUTE_CALL.equals(action)) {
                isMutedByUser = intent.getBooleanExtra("isMuted", false);
                return START_STICKY;
            }
        }
        
        startCallForeground();
        connectWebSocket();
        startAudioStreaming();
        return START_STICKY;
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Active Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        Intent openAppIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingOpenApp = PendingIntent.getActivity(this, 0, openAppIntent, PendingIntent.FLAG_IMMUTABLE);

        // 🚀 نوٹیفکیشن میں 'End' کا بٹن 🚀
        Intent stopIntent = new Intent(this, AyeshaCallService.class);
        stopIntent.setAction(ACTION_STOP_SERVICE);
        PendingIntent pendingStop = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("Ayesha AI")
                .setContentText("Ongoing voice conversation")
                .setSmallIcon(R.drawable.app_logo) // اپنا ایپ لوگو استعمال کریں
                .setOngoing(true)
                .setContentIntent(pendingOpenApp)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", pendingStop)
                .build();

        startForeground(1, notification);
    }

    private void setupListeners() {
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);

        audioManager.requestAudioFocus(focusChange -> {
            if (focusChange == AudioManager.AUDIOFOCUS_LOSS || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                isMutedBySystem = true; 
            } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                isMutedBySystem = false; 
            }
        }, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);

        telephonyManager.listen(new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String phoneNumber) {
                if (state == TelephonyManager.CALL_STATE_OFFHOOK) isMutedBySystem = true;
                else if (state == TelephonyManager.CALL_STATE_IDLE) isMutedBySystem = false;
            }
        }, PhoneStateListener.LISTEN_CALL_STATE);
    }

    private void startAudioStreaming() {
        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        
        audioRecord.startRecording();
        isRecording = true;

        new Thread(() -> {
            byte[] buffer = new byte[bufferSize];
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            while (isRecording) {
                // اگر سسٹم نے میوٹ کیا ہے، یا یوزر نے سکرین سے میوٹ دبایا ہے
                if (isMutedBySystem || isAyeshaSpeaking || isMutedByUser) continue;
                
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read > 0) {
                    baos.write(buffer, 0, read);
                    if (baos.size() > 32000) { 
                        sendToWebSocket(baos.toByteArray());
                        baos.reset();
                    }
                }
            }
        }).start();
    }

    private void sendToWebSocket(byte[] data) {
        if (webSocket != null) {
            JSONObject json = new JSONObject();
            try {
                json.put("audio", Base64.encodeToString(data, Base64.NO_WRAP));
                json.put("email", "alirazasabir007@gmail.com");
                webSocket.send(json.toString());
            } catch (Exception e) {}
        }
    }

    private void connectWebSocket() {
        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder().url("wss://aigrowthbox-ayesha-ai.hf.space/ws/live").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    String reply = new JSONObject(text).getString("response");
                    mainHandler.post(() -> speak(reply));
                } catch (Exception e) {}
            }
        });
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
        }
    }

    private void speak(String text) {
        if (tts != null && !isMutedBySystem) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaCall");
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        tts = new TextToSpeech(this, this);
        setupListeners();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRecording = false;
        if (audioRecord != null) audioRecord.release();
        if (webSocket != null) webSocket.close(1000, "User Cut Call");
        if (tts != null) tts.shutdown();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
                                                                                  }
            
