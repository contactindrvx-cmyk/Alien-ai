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
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Scanner;

public class FloatingBubbleService extends Service implements TextToSpeech.OnInitListener {

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private MediaPlayer mediaPlayer;
    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private TextToSpeech tts;
    private AudioManager audioManager;
    private Surface currentSurface;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isAyeshaListening = false;
    private boolean isAiProcessing = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        tts = new TextToSpeech(this, this);

        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, "AyeshaChannel")
                .setContentTitle("Alien AI")
                .setContentText("Ayesha is ready to help...")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);

        setupFloatingBubble();
        setupVideoPlayer();
        setupMovement();
        
        // 🎤 مائیک شروع کریں
        startListeningLoop();
    }

    private void setupFloatingBubble() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? 2038 : 2002;
        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) { tts.setLanguage(new Locale("ur", "PK")); }
    }

    private void speak(String text) {
        if (tts != null) {
            // ویڈیو پلے کرو جب عائشہ بولے
            if (mediaPlayer != null) mediaPlayer.start();
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply");
            
            // جب بولنا ختم کرے تو ویڈیو روک دو
            new Handler().postDelayed(() -> {
                if (mediaPlayer != null && !tts.isSpeaking()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100);
                }
            }, 5000); 
        }
    }

    // 🔇 بیپ کی آواز کو خاموش کرنے کا پروفیشنل طریقہ 🔇
    private void muteSystemSounds(boolean mute) {
        if (audioManager != null) {
            int mode = mute ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE;
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, mode, 0);
        }
    }

    private void startListeningLoop() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                muteSystemSounds(false);
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();
                    
                    if (!isAiProcessing) {
                        if (text.contains("ayesha") || text.contains("عائشہ")) {
                            isAiProcessing = true;
                            speak("جی رضا بھائی، میں سن رہی ہوں، بتائیے کیا کام ہے؟");
                            // 2 سیکنڈ بعد یوزر کا اصل سوال سننا شروع کرو
                            mainHandler.postDelayed(() -> startListeningLoop(), 3000);
                        } else {
                            // اگر نام نہیں تھا تو یہ یوزر کا سوال ہے، اسے AI کو بھیجو
                            sendToAiServer(text);
                        }
                    }
                } else {
                    restartMic();
                }
            }

            @Override
            public void onError(int error) {
                muteSystemSounds(false);
                restartMic();
            }

            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        muteSystemSounds(true); // بیپ سے بچنے کے لیے خاموش کرو
        speechRecognizer.startListening(speechIntent);
    }

    private void restartMic() {
        mainHandler.postDelayed(() -> {
            if (!tts.isSpeaking()) startListeningLoop();
        }, 1000);
    }

    // 🧠 AI سرور (Hugging Face) سے رابطہ 🧠
    private void sendToAiServer(String userMessage) {
        new Thread(() -> {
            try {
                URL url = new URL("https://aigrowthbox-ayesha-ai.hf.space/chat");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                JSONObject jsonParam = new JSONObject();
                jsonParam.put("message", userMessage);
                jsonParam.put("email", "alirazasabir007@gmail.com");

                OutputStream os = conn.getOutputStream();
                os.write(jsonParam.toString().getBytes("UTF-8"));
                os.close();

                Scanner s = new Scanner(conn.getInputStream()).useDelimiter("\\A");
                String response = s.hasNext() ? s.next() : "";
                JSONObject resObj = new JSONObject(response);
                String aiReply = resObj.getString("response");

                mainHandler.post(() -> {
                    speak(aiReply);
                    isAiProcessing = false;
                });

            } catch (Exception e) {
                mainHandler.post(() -> {
                    speak("سرور سے رابطہ نہیں ہو سکا");
                    isAiProcessing = false;
                });
            }
        }).start();
    }

    private void setupVideoPlayer() {
        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false);
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture s, int w, int h) {
                currentSurface = new Surface(s);
                mediaPlayer = new MediaPlayer();
                try {
                    AssetFileDescriptor afd = getAssets().openFd("ayesha_video.mp4");
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    mediaPlayer.setSurface(currentSurface);
                    mediaPlayer.setLooping(true);
                    mediaPlayer.prepareAsync();
                    mediaPlayer.setOnPreparedListener(mp -> mp.seekTo(100));
                } catch (Exception e) { e.printStackTrace(); }
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) { return true; }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    private void setupMovement() {
        bubbleView.findViewById(R.id.floating_bubble).setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x; initialY = params.y;
                        initialTouchX = event.getRawX(); initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(bubbleView, params);
                        return true;
                }
                return false;
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel("AyeshaChannel", "Ayesha AI", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (tts != null) tts.shutdown();
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
                }
