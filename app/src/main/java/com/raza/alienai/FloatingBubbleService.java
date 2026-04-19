package com.raza.alienai;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.media.AudioManager;
import android.media.MediaPlayer;
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
    private boolean isTtsReady = false; // 🌟 چیک کرنے کے لیے کہ آواز تیار ہے یا نہیں 🌟

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        
        // 1. آواز کا برج (TTS) سیٹ اپ
        tts = new TextToSpeech(this, this);

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);

        int layoutFlag = (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) ? 2038 : 2002;
        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);

        setupVideoPlayer();
        setupMovement();
        
        new Handler().postDelayed(this::startWakeWordDetection, 1500);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(new Locale("ur", "PK"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // اگر اردو نہیں ہے تو انگلش کر دو تاکہ آواز تو آئے
                tts.setLanguage(Locale.US);
            }
            isTtsReady = true;
        }
    }

    private void speak(String text) {
        if (isTtsReady && tts != null) {
            // آواز کو فل والیم پر چلانے کی کوشش
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "AyeshaReply");
        }
    }

    private void setupVideoPlayer() {
        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false);
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                currentSurface = new Surface(surface);
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC); // آواز کا سسٹم ٹھیک کیا
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

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                isListeningNow = false;
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String heardText = matches.get(0).toLowerCase();
                    
                    // ڈیبگ میسج: کیا سنا؟
                    Toast.makeText(FloatingBubbleService.this, "سنا: " + heardText, Toast.LENGTH_SHORT).show();

                    if (heardText.contains("ayesha") || heardText.contains("عائشہ") || heardText.contains("asha") || heardText.contains("آشا")) {
                        activateAgent("ayesha", "جی رضا بھائی، فرمائیں!");
                        return;
                    }
                }
                restartListening();
            }

            @Override public void onError(int error) { isListeningNow = false; restartListening(); }
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() { isListeningNow = true; }
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        try { speechRecognizer.startListening(speechIntent); } catch (Exception e) {}
    }

    private void restartListening() {
        restartHandler.removeCallbacksAndMessages(null);
        restartHandler.postDelayed(() -> {
            if (!isListeningNow && speechRecognizer != null) {
                try { speechRecognizer.startListening(speechIntent); } catch (Exception e) {}
            }
        }, 800);
    }

    private void activateAgent(String agentName, String greeting) {
        // 🚀 آواز کا جادو 🚀
        speak(greeting);
        
        if (mediaPlayer != null) {
            mediaPlayer.start();
            // 4 سیکنڈ بعد ویڈیو روک دو (تاکہ اینیمیشن ختم ہو)
            new Handler().postDelayed(() -> {
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100);
                }
            }, 4000);
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
                        if (Math.abs(event.getRawX() - initialTouchX) > 10 || Math.abs(event.getRawY() - initialTouchY) > 10) {
                            isMoving = true;
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            windowManager.updateViewLayout(bubbleView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        // ❌ یہاں سے mediaPlayer.start() نکال دیا گیا ہے ❌
                        // اب ٹچ کرنے سے ویڈیو نہیں چلے گی، صرف آواز پر چلے گی
                        if (!isMoving) {
                             // یہاں آپ چاہیں تو کلک پر ایپ کھول سکتے ہیں
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
