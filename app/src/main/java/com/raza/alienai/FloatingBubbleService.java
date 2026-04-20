package com.raza.alienai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

import java.util.ArrayList;
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
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private Surface currentSurface;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isAyeshaReady = false;
    private boolean isCommandMode = false;
    private boolean isAyeshaSpeaking = false;

    // 🚀 لائیو کالنگ کے ویری ایبلز 🚀
    private OkHttpClient client;
    private WebSocket webSocket;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        startMyForeground();
        tts = new TextToSpeech(this, this);
        
        setupFloatingBubble();
        setupVideoPlayer();
        setupMovement();
        
        // 🚀 لائیو کالنگ کا پائپ جوڑیں 🚀
        connectLiveWebSocket();
        
        mainHandler.postDelayed(this::startListeningLoop, 2000);
    }

    // ==========================================
    // 🌐 لائیو کالنگ (WebSocket) کا جادو
    // ==========================================
    private void connectLiveWebSocket() {
        client = new OkHttpClient();
        // نوٹ: Hugging Face کے لیے wss:// استعمال ہوتا ہے
        Request request = new Request.Builder().url("wss://aigrowthbox-ayesha-ai.hf.space/ws/live").build();
        
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                mainHandler.post(() -> Toast.makeText(FloatingBubbleService.this, "لائیو کال کنیکٹ ہو گئی!", Toast.LENGTH_SHORT).show());
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                // سرور سے جیسے ہی جواب آئے، فوراً بول دو
                try {
                    JSONObject json = new JSONObject(text);
                    String reply = json.getString("response");
                    mainHandler.post(() -> speak(reply));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                mainHandler.post(() -> connectLiveWebSocket()); // اگر کنکشن ٹوٹے تو دوبارہ جوڑو
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                mainHandler.postDelayed(() -> connectLiveWebSocket(), 5000); // 5 سیکنڈ بعد دوبارہ کوشش کرو
            }
        });
    }

    private void sendToAiLive(String msg) {
        if (webSocket != null) {
            try {
                JSONObject json = new JSONObject();
                json.put("message", msg);
                json.put("email", "alirazasabir007@gmail.com");
                webSocket.send(json.toString()); // ⚡ بجلی کی سپیڈ سے میسج سینڈ!
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            speak("لائیو کال ڈس کنیکٹ ہو گئی ہے، دوبارہ کوشش کر رہی ہوں۔");
            connectLiveWebSocket();
        }
    }
    // ==========================================

    private void startMyForeground() {
        String channelId = "AyeshaChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha AI Live", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); 
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال پر ہے")
                .setContentText("سن رہی ہوں...")
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

    private void muteSystemBeep(boolean mute) {
        if (audioManager != null) {
            int direction = mute ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE;
            audioManager.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, direction, 0);
            audioManager.adjustStreamVolume(AudioManager.STREAM_ALARM, direction, 0);
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, direction, 0);
        }
    }

    private void startListeningLoop() {
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                muteSystemBeep(false); 
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();
                    
                    if (text.contains("ayesha") || text.contains("عائشہ") || text.contains("آشا")) {
                        if (isAyeshaSpeaking && tts != null) {
                            tts.stop(); 
                            if (mediaPlayer != null) mediaPlayer.pause();
                            isAyeshaSpeaking = false;
                        }
                        
                        if (!isCommandMode) {
                            isCommandMode = true;
                            speechRecognizer.cancel(); 
                            speak("جی، سن رہی ہوں");
                            mainHandler.postDelayed(() -> startListeningLoop(), 2000); 
                        }
                    }
                }
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();

                    if (isAyeshaSpeaking) {
                        restartMicQuietly();
                        return;
                    }

                    if (!isCommandMode) {
                        if (text.contains("ayesha") || text.contains("عائشہ")) {
                            isCommandMode = true;
                            speak("جی، سن رہی ہوں");
                        } else {
                            restartMicQuietly();
                        }
                    } else {
                        isCommandMode = false;
                        sendToAiLive(text); // 🚀 اب لائیو پائپ کے ذریعے بھیجو!
                    }
                } else {
                    restartMicQuietly();
                }
            }

            @Override 
            public void onError(int error) { 
                muteSystemBeep(false); 
                if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_AUDIO) {
                    mainHandler.postDelayed(() -> startListeningLoop(), 4000); 
                } else {
                    restartMicQuietly(); 
                }
            }

            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        muteSystemBeep(true);
        try { speechRecognizer.startListening(intent); } catch (Exception e) { muteSystemBeep(false); }
    }

    private void restartMicQuietly() {
        mainHandler.removeCallbacksAndMessages(null);
        mainHandler.postDelayed(this::startListeningLoop, 800);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
            isAyeshaReady = true;

            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) { isAyeshaSpeaking = true; }
                @Override public void onDone(String utteranceId) {
                    isAyeshaSpeaking = false;
                    mainHandler.post(() -> startListeningLoop());
                }
                @Override public void onError(String utteranceId) {
                    isAyeshaSpeaking = false;
                    mainHandler.post(() -> startListeningLoop());
                }
            });
        }
    }

    private void speak(String text) {
        if (isAyeshaReady && tts != null) {
            isAyeshaSpeaking = true;
            if (mediaPlayer != null) mediaPlayer.start();
            
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply");
            
            new Handler().postDelayed(() -> {
                if (mediaPlayer != null && !tts.isSpeaking()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100);
                }
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
                    mediaPlayer.setOnPreparedListener(mp -> mp.seekTo(100));
                } catch (Exception e) {}
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) { return true; }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    private void setupMovement() {
        bubbleView.findViewById(R.id.floating_bubble).setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN: return true;
                case MotionEvent.ACTION_MOVE: return true;
                case MotionEvent.ACTION_UP:
                    Intent intent = new Intent(FloatingBubbleService.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return true;
            }
            return false;
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mainHandler.removeCallbacksAndMessages(null); 
        muteSystemBeep(false);
        
        // 🚀 بند کرتے وقت لائیو کال بھی کاٹ دو 🚀
        if (webSocket != null) {
            webSocket.close(1000, "Service Destroyed");
        }
        
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
        }
        if (tts != null) tts.shutdown();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
                    }
            
