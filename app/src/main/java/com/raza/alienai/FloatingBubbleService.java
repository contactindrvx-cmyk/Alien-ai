package com.raza.alienai;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;
import java.util.ArrayList;

public class FloatingBubbleService extends Service {

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private MediaPlayer mediaPlayer;
    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private boolean isListening = false;
    private Surface currentSurface;
    private Handler restartHandler = new Handler(Looper.getMainLooper()); // 🌟 مائیک کو پاگل ہونے سے بچانے کے لیے 🌟

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private BroadcastReceiver videoControlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (mediaPlayer == null) return;
            if ("com.raza.alienai.PLAY_VIDEO".equals(intent.getAction())) {
                if (!mediaPlayer.isPlaying()) mediaPlayer.start();
            } else if ("com.raza.alienai.PAUSE_VIDEO".equals(intent.getAction())) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100);
                }
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();

        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raza.alienai.PLAY_VIDEO");
        filter.addAction("com.raza.alienai.PAUSE_VIDEO");
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(videoControlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(videoControlReceiver, filter);
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);

        int layoutFlag = (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) ? 
                         WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
                         WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);

        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);

        setupVideoPlayer();
        setupMovement();
        
        startWakeWordDetection();
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
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                boolean found = false;
                if (matches != null) {
                    for (String text : matches) {
                        String speech = text.toLowerCase();
                        if (speech.contains("ayesha") || speech.contains("عائشہ")) {
                            activateAgent("ayesha", "جی رضا بھائی، عائشہ سن رہی ہے!");
                            found = true; break;
                        } else if (speech.contains("alex") || speech.contains("ایلیکس")) {
                            activateAgent("alex", "Hello Raza, Alex is active!");
                            found = true; break;
                        } else if (speech.contains("raza") || speech.contains("رضا")) {
                            activateAgent("raza", "جی رضا، آپ کا پرسنل اسسٹنٹ حاضر ہے!");
                            found = true; break;
                        } else if (speech.contains("sara") || speech.contains("سارہ")) {
                            activateAgent("sara", "جی، سارہ آپ کی خدمت میں حاضر ہے!");
                            found = true; break;
                        }
                    }
                }
                if (!found) restartListeningWithDelay(); // 🌟 اگر نام نہ ملے تو وقفے کے ساتھ ری سٹارٹ کرو
            }

            @Override public void onError(int error) { restartListeningWithDelay(); }
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        speechRecognizer.startListening(speechIntent);
    }

    // 🌟 مائیک کو 1 سیکنڈ کے وقفے سے ری سٹارٹ کرنے کا لاجک تاکہ بیپ بیپ تنگ نہ کرے 🌟
    private void restartListeningWithDelay() {
        restartHandler.postDelayed(() -> {
            if (speechRecognizer != null && !isListening) {
                try { speechRecognizer.startListening(speechIntent); } catch (Exception e) {}
            }
        }, 1000);
    }

    private void activateAgent(String agentName, String greetingMsg) {
        Toast.makeText(this, greetingMsg, Toast.LENGTH_SHORT).show();
        getSharedPreferences("AyeshaPrefs", MODE_PRIVATE).edit().putString("selectedAgent", agentName).apply();
        
        loadAgentVideo(agentName);
        if (mediaPlayer != null) mediaPlayer.start();

        // 🚀 سب سے اہم جادو: ایپ کو فوراً سکرین پر لاؤ تاکہ دماغ (JS) کام کر سکے! 🚀
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("WAKE_AGENT", agentName);
        startActivity(intent);
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
                        isMoving = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        if (Math.abs(event.getRawX() - initialTouchX) > 10 || Math.abs(event.getRawY() - initialTouchY) > 10) {
                            isMoving = true;
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            windowManager.updateViewLayout(bubbleView, params);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!isMoving) {
                            Intent i = new Intent(FloatingBubbleService.this, MainActivity.class);
                            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(i);
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
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
    }
                                                         
