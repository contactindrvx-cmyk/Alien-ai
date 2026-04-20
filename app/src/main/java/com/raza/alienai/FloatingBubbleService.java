package com.raza.alienai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Base64;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.Locale;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class FloatingBubbleService extends Service implements TextToSpeech.OnInitListener {

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private TextToSpeech tts;
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private TelephonyManager telephonyManager;
    private Surface currentSurface;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    
    private boolean isAyeshaReady = false;
    private boolean isAyeshaSpeaking = false;
    private boolean isAyeshaPausedBySystem = false;

    private OkHttpClient client;
    private WebSocket webSocket;

    // 🚀 لائیو کالنگ کے نئے ہتھیار (No More Beeps) 🚀
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private boolean isRecording = false;
    private static final int SAMPLE_RATE = 16000;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        
        startMyForeground();
        tts = new TextToSpeech(this, this);
        
        setupFloatingBubble();
        setupVideoPlayer();
        setupMovement();
        
        setupAudioFocusListener();
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            setupCallListener();
        }
        
        connectLiveWebSocket();
        
        // 🚀 کالنگ مائیک سٹارٹ کرو 🚀
        startSilentLiveCall();
    }

    // ==========================================
    // 🎙️ خالص لائیو کالنگ مائیک (ChatGPT Style)
    // ==========================================
    private void startSilentLiveCall() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        
        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        
        // VOICE_COMMUNICATION اسے ایک فون کال بنا دیتا ہے (کوئی بیپ نہیں، ایکو کینسلر آن)
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 
                SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        
        audioRecord.startRecording();
        isRecording = true;

        recordingThread = new Thread(() -> {
            byte[] audioBuffer = new byte[bufferSize];
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            boolean userIsSpeaking = false;
            int silenceFrames = 0;

            while (isRecording) {
                if (isAyeshaPausedBySystem || isAyeshaSpeaking) {
                    continue; // اگر واٹس ایپ چل رہا ہے یا عائشہ بول رہی ہے تو چپ رہو
                }

                int read = audioRecord.read(audioBuffer, 0, audioBuffer.length);
                if (read > 0) {
                    double rms = calculateRMS(audioBuffer, read);
                    
                    if (rms > 800) { // 🚀 آواز کی طاقت (Threshold)
                        userIsSpeaking = true;
                        silenceFrames = 0;
                        try { baos.write(audioBuffer, 0, read); } catch (Exception e) {}
                    } else if (userIsSpeaking) {
                        silenceFrames++;
                        try { baos.write(audioBuffer, 0, read); } catch (Exception e) {}
                        
                        // جب آپ بات ختم کر کے 1.5 سیکنڈ چپ رہیں گے تو آڈیو سرور کو جائے گی
                        if (silenceFrames > 25) { 
                            userIsSpeaking = false;
                            sendRawAudioToAI(baos.toByteArray());
                            baos.reset();
                        }
                    }
                }
            }
        });
        recordingThread.start();
    }

    // آواز کا والیوم چیک کرنے والا جادو
    private double calculateRMS(byte[] buffer, int length) {
        long sum = 0;
        for (int i = 0; i < length; i += 2) {
            short sample = (short) ((buffer[i + 1] << 8) | (buffer[i] & 0xFF));
            sum += sample * sample;
        }
        return Math.sqrt(sum / (length / 2.0));
    }

    // لائیو آڈیو کو سرور پر بھیجنا
    private void sendRawAudioToAI(byte[] pcmData) {
        if (pcmData.length < 4000) return; // کھانسی یا شور کو اگنور کرو
        
        byte[] wavData = addWavHeader(pcmData);
        String base64Audio = Base64.encodeToString(wavData, Base64.NO_WRAP);
        
        mainHandler.post(() -> Toast.makeText(FloatingBubbleService.this, "آواز بھیجی جا رہی ہے...", Toast.LENGTH_SHORT).show());
        
        if (webSocket != null) {
            try {
                JSONObject json = new JSONObject();
                json.put("audio", base64Audio);
                json.put("email", "alirazasabir007@gmail.com");
                webSocket.send(json.toString());
            } catch (Exception e) { e.printStackTrace(); }
        } else {
            connectLiveWebSocket();
        }
    }

    // AI کے لیے آڈیو کو درست فارمیٹ (WAV) میں کنورٹ کرنا
    private byte[] addWavHeader(byte[] pcmData) {
        int totalAudioLen = pcmData.length;
        int totalDataLen = totalAudioLen + 36;
        int byteRate = SAMPLE_RATE * 2;

        byte[] header = new byte[44];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff); header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff); header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0;
        header[20] = 1; header[21] = 0; header[22] = 1; header[23] = 0;
        header[24] = (byte) (SAMPLE_RATE & 0xff); header[25] = (byte) ((SAMPLE_RATE >> 8) & 0xff);
        header[26] = (byte) ((SAMPLE_RATE >> 16) & 0xff); header[27] = (byte) ((SAMPLE_RATE >> 24) & 0xff);
        header[28] = (byte) (byteRate & 0xff); header[29] = (byte) ((byteRate >> 8) & 0xff);
        header[30] = (byte) ((byteRate >> 16) & 0xff); header[31] = (byte) ((byteRate >> 24) & 0xff);
        header[32] = 2; header[33] = 0; header[34] = 16; header[35] = 0;
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (totalAudioLen & 0xff); header[41] = (byte) ((totalAudioLen >> 8) & 0xff);
        header[42] = (byte) ((totalAudioLen >> 16) & 0xff); header[43] = (byte) ((totalAudioLen >> 24) & 0xff);

        byte[] wavData = new byte[header.length + pcmData.length];
        System.arraycopy(header, 0, wavData, 0, header.length);
        System.arraycopy(pcmData, 0, wavData, header.length, pcmData.length);
        return wavData;
    }

    // ==========================================
    // 📞 فون کالز کنٹرول (Telephony)
    // ==========================================
    private void setupCallListener() {
        try {
            PhoneStateListener phoneStateListener = new PhoneStateListener() {
                @Override
                public void onCallStateChanged(int state, String phoneNumber) {
                    if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
                        pauseAyesha("فون کال کی وجہ سے عائشہ رک گئی");
                    } else if (state == TelephonyManager.CALL_STATE_IDLE) {
                        if (isAyeshaPausedBySystem) resumeAyesha("کال ختم، عائشہ واپس کنیکٹ ہو گئی");
                    }
                }
            };
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
        } catch (Exception e) {}
    }

    // ==========================================
    // 🎧 واٹس ایپ/میڈیا کنٹرول (Audio Focus)
    // ==========================================
    private void setupAudioFocusListener() {
        AudioManager.OnAudioFocusChangeListener focusChangeListener = focusChange -> {
            if (focusChange == AudioManager.AUDIOFOCUS_LOSS || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                pauseAyesha("واٹس ایپ/میڈیا چل رہا ہے...");
            } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                if (isAyeshaPausedBySystem) resumeAyesha("عائشہ دوبارہ ایکٹو");
            }
        };
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.requestAudioFocus(new android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setOnAudioFocusChangeListener(focusChangeListener).build());
        } else {
            audioManager.requestAudioFocus(focusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
    }

    private void pauseAyesha(String reason) {
        isAyeshaPausedBySystem = true;
        mainHandler.post(() -> Toast.makeText(FloatingBubbleService.this, reason, Toast.LENGTH_SHORT).show());
        if (tts != null && tts.isSpeaking()) tts.stop();
        if (webSocket != null) {
            webSocket.close(1000, "Paused");
            webSocket = null;
        }
    }

    private void resumeAyesha(String reason) {
        isAyeshaPausedBySystem = false;
        mainHandler.post(() -> Toast.makeText(FloatingBubbleService.this, reason, Toast.LENGTH_SHORT).show());
        connectLiveWebSocket();
    }

    // ==========================================
    // 🌐 لائیو کالنگ پائپ (WebSocket)
    // ==========================================
    private void connectLiveWebSocket() {
        if (isAyeshaPausedBySystem) return;
        client = new OkHttpClient();
        Request request = new Request.Builder().url("wss://aigrowthbox-ayesha-ai.hf.space/ws/live").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    String reply = json.getString("response");
                    mainHandler.post(() -> speak(reply));
                } catch (Exception e) {}
            }
            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                if (!isAyeshaPausedBySystem) mainHandler.postDelayed(() -> connectLiveWebSocket(), 2000);
            }
            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                if (!isAyeshaPausedBySystem) mainHandler.postDelayed(() -> connectLiveWebSocket(), 5000);
            }
        });
    }

    private void startMyForeground() {
        String channelId = "AyeshaChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha AI Live", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); 
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال پر ہے")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);
    }

    private void setupFloatingBubble() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? 2038 : 2002;
        params = new WindowManager.LayoutParams(-2, -2, layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
            isAyeshaReady = true;
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) { isAyeshaSpeaking = true; }
                @Override public void onDone(String utteranceId) { isAyeshaSpeaking = false; }
                @Override public void onError(String utteranceId) { isAyeshaSpeaking = false; }
            });
        }
    }

    private void speak(String text) {
        if (isAyeshaPausedBySystem) return;
        if (isAyeshaReady && tts != null) {
            isAyeshaSpeaking = true;
            if (mediaPlayer != null) mediaPlayer.start();
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply");
            new Handler().postDelayed(() -> {
                if (mediaPlayer != null && !tts.isSpeaking()) { mediaPlayer.pause(); mediaPlayer.seekTo(100); }
            }, 3000);
        }
    }

    private void setupVideoPlayer() {
        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false);
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override public void onSurfaceTextureAvailable(SurfaceTexture s, int w, int h) {
                currentSurface = new Surface(s);
                mediaPlayer = new MediaPlayer();
                try {
                    AssetFileDescriptor afd = getAssets().openFd("ayesha_video.mp4");
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    mediaPlayer.setSurface(currentSurface);
                    mediaPlayer.setLooping(true);
                    mediaPlayer.prepareAsync();
                } catch (Exception e) {}
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) { return true; }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    private void setupMovement() {
        bubbleView.findViewById(R.id.floating_bubble).setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                Intent intent = new Intent(FloatingBubbleService.this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            }
            return true;
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mainHandler.removeCallbacksAndMessages(null); 
        isRecording = false;
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
        }
        if (webSocket != null) webSocket.close(1000, "Destroyed");
        if (tts != null) tts.shutdown();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
            }
                            
