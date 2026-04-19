package com.raza.alienai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
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
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Locale;

public class FloatingBubbleService extends Service implements TextToSpeech.OnInitListener {

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private MediaPlayer mediaPlayer;
    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private TextToSpeech tts;
    private Surface currentSurface;
    private Handler restartHandler = new Handler(Looper.getMainLooper());
    private boolean isListeningNow = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        
        // 1. اینڈرائیڈ پولیس کو نوٹیفیکیشن دکھاؤ (Foreground Service)
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, "AyeshaChannel")
                .setContentTitle("Alien AI Active")
                .setContentText("Ayesha is listening for your command...")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);

        tts = new TextToSpeech(this, this);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);

        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? 2038 : 2002;
        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);

        setupVideoPlayer();
        setupMovement();
        
        // مائیک سٹارٹ کریں
        startWakeWordDetection();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel("AyeshaChannel", "Ayesha Service", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) { tts.setLanguage(new Locale("ur", "PK")); }
    }

    private void speak(String text) {
        if (tts != null) { tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply"); }
    }

    private void setupVideoPlayer() {
        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false);
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                currentSurface = new Surface(surface);
                mediaPlayer = new MediaPlayer();
                SharedPreferences prefs = getSharedPreferences("AyeshaPrefs", MODE_PRIVATE);
                loadAgentVideo(prefs.getString("selectedAgent", "ayesha"));
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) { return true; }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    private void loadAgentVideo(String agentName) {
        if (mediaPlayer == null || currentSurface == null) return;
        try {
            mediaPlayer.reset();
            AssetFileDescriptor afd = getAssets().openFd(agentName + "_video.mp4");
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            mediaPlayer.setSurface(currentSurface);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepareAsync();
            mediaPlayer.setOnPreparedListener(mp -> mp.seekTo(100));
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void startWakeWordDetection() {
        if (speechRecognizer != null) { speechRecognizer.destroy(); }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
        // 🌟 اس سے مائیک زیادہ حساس ہو جائے گا 🌟
        speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                isListeningNow = false;
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null) {
                    for (String text : matches) {
                        String speech = text.toLowerCase();
                        if (speech.contains("ayesha") || speech.contains("عائشہ") || speech.contains("آشا")) {
                            activateAgent("ayesha", "جی رضا بھائی");
                            return;
                        }
                    }
                }
                restartListening();
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                // 🌟 بات ختم ہونے سے پہلے ہی نام پہچان لو 🌟
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null) {
                    for (String text : matches) {
                        if (text.toLowerCase().contains("ayesha") || text.contains("عائشہ")) {
                            activateAgent("ayesha", "جی رضا بھائی");
                            speechRecognizer.stopListening();
                            return;
                        }
                    }
                }
            }

            @Override public void onError(int error) { isListeningNow = false; restartListening(); }
            @Override public void onReadyForSpeech(Bundle params) { isListeningNow = true; }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() { isListeningNow = false; }
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        speechRecognizer.startListening(speechIntent);
    }

    private void restartListening() {
        restartHandler.removeCallbacksAndMessages(null);
        restartHandler.postDelayed(() -> {
            if (!isListeningNow) {
                try { speechRecognizer.startListening(speechIntent); } catch (Exception e) {}
            }
        }, 500);
    }

    private void activateAgent(String agentName, String greeting) {
        speak(greeting);
        if (mediaPlayer != null) {
            mediaPlayer.start();
            new Handler().postDelayed(() -> {
                if (mediaPlayer != null) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100);
                }
            }, 3000);
        }
        restartListening();
    }

    private void setupMovement() {
        bubbleView.findViewById(R.id.floating_bubble).setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isMoving = false;
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x; initialY = params.y;
                        initialTouchX = event.getRawX(); initialTouchY = event.getRawY();
                        isMoving = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        if (Math.abs(event.getRawX() - initialTouchX) > 5 || Math.abs(event.getRawY() - initialTouchY) > 5) {
                            isMoving = true;
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            windowManager.updateViewLayout(bubbleView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!isMoving) {
                            // کلک پر ایپ کھولے گی، آواز پر نہیں
                            Intent intent = new Intent(FloatingBubbleService.this, MainActivity.class);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        }
                        return true;
                }
                return false;
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
                }
            
