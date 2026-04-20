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
import android.speech.tts.UtteranceProgressListener;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Base64;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.util.Locale;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {

    private static final int SAMPLE_RATE = 16000;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private WebSocket webSocket;
    private TextToSpeech tts;
    private AudioManager audioManager;
    private TelephonyManager telephonyManager;
    private boolean isMutedBySystem = false;
    private boolean isAyeshaSpeaking = false;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startCallForeground();
        connectWebSocket();
        startAudioStreaming();
        return START_STICKY; // 🚀 یہ لائن ایپ سوائپ کرنے پر بھی کال بند نہیں ہونے دے گی
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "عائشہ لائیو کال", NotificationManager.IMPORTANCE_HIGH);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ کے ساتھ کال جاری ہے")
                .setContentText("آپ کی آواز سن رہی ہوں...")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true) // اسے یوزر ہٹا نہیں سکے گا جب تک کال چلے
                .setContentIntent(pendingIntent)
                .build();

        startForeground(1, notification);
    }

    private void setupListeners() {
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);

        // 🎧 واٹس ایپ وائس نوٹ / میڈیا ڈیٹیکٹر
        audioManager.requestAudioFocus(focusChange -> {
            if (focusChange == AudioManager.AUDIOFOCUS_LOSS || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                isMutedBySystem = true; // عائشہ میوٹ
            } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                isMutedBySystem = false; // عائشہ واپس ان میوٹ
            }
        }, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);

        // 📞 فون کال ڈیٹیکٹر
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
                if (isMutedBySystem || isAyeshaSpeaking) continue;
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read > 0) {
                    // یہاں ہم آواز کا والیوم چیک کر کے خاموشی پر ڈیٹا بھیجیں گے
                    baos.write(buffer, 0, read);
                    if (baos.size() > 32000) { // ہر 1-2 سیکنڈ بعد ڈیٹا بھیجیں
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
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) { isAyeshaSpeaking = true; }
                @Override public void onDone(String utteranceId) { isAyeshaSpeaking = false; }
                @Override public void onError(String utteranceId) { isAyeshaSpeaking = false; }
            });
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
