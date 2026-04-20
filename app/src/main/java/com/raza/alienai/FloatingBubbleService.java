package com.raza.alienai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
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
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isAyeshaReady = false;
    
    // 🚀 جادوئی ویری ایبل: یہ طے کرے گا کہ عائشہ نام سن رہی ہے یا سوال 🚀
    private boolean isCommandMode = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        startMyForeground();
        tts = new TextToSpeech(this, this);
        
        setupFloatingBubble();
        setupMovement();
        
        // سروس سٹارٹ ہوتے ہی مائیک لوپ میں لگا دیں
        startListeningLoop();
    }

    private void startMyForeground() {
        String channelId = "AyeshaChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha AI", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); // بیپ بند
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ ایکٹو ہے")
                .setContentText("پسِ پردہ آپ کی آواز سن رہی ہوں...")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);
    }

    private void setupFloatingBubble() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? 2038 : 2002;
        params = new WindowManager.LayoutParams(-2, -2, layoutFlag, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, android.graphics.PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 100; params.y = 100;
        windowManager.addView(bubbleView, params);
    }

    // 🎤 اصل مائیک لاجک 🎤
    private void startListeningLoop() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();
                    
                    if (!isCommandMode) {
                        // 🟢 WAKE WORD MODE 🟢
                        if (text.contains("ayesha") || text.contains("عائشہ")) {
                            isCommandMode = true; // اب سوال سننے کے موڈ میں آ جاؤ
                            speak("جی رضا بھائی؟");
                            // 2 سیکنڈ بعد سوال سننے کے لیے مائیک آن کرو
                            mainHandler.postDelayed(() -> startListeningLoop(), 2000);
                        } else {
                            // اگر نام نہیں بولا، تو خاموشی سے دوبارہ سننا شروع کرو
                            restartMicQuietly();
                        }
                    } else {
                        // 🔴 COMMAND MODE (AI سوال) 🔴
                        isCommandMode = false; // واپس نیند کے موڈ میں
                        sendToAiServer(text);
                    }
                } else {
                    restartMicQuietly();
                }
            }
            
            @Override public void onError(int error) { restartMicQuietly(); }
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        try { speechRecognizer.startListening(intent); } catch (Exception e) {}
    }

    private void restartMicQuietly() {
        mainHandler.postDelayed(() -> {
            if (!tts.isSpeaking()) {
                startListeningLoop();
            } else {
                restartMicQuietly(); // اگر بول رہی ہے تو اور انتظار کرو
            }
        }, 800);
    }

    // 🧠 AI دماغ (Hugging Face) 🧠
    private void sendToAiServer(String msg) {
        new Thread(() -> {
            try {
                URL url = new URL("https://aigrowthbox-ayesha-ai.hf.space/chat");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                JSONObject json = new JSONObject();
                json.put("message", msg);
                json.put("email", "alirazasabir007@gmail.com");
                OutputStream os = conn.getOutputStream();
                os.write(json.toString().getBytes("UTF-8"));
                os.close();
                Scanner s = new Scanner(conn.getInputStream()).useDelimiter("\\A");
                String reply = new JSONObject(s.hasNext() ? s.next() : "").getString("response");
                mainHandler.post(() -> {
                    speak(reply);
                    // AI کا جواب دینے کے بعد واپس مائیک آن کر دو
                    mainHandler.postDelayed(this::startListeningLoop, 3000);
                });
            } catch (Exception e) {
                mainHandler.post(() -> {
                    speak("سرور سے رابطہ ٹوٹ گیا ہے۔");
                    startListeningLoop();
                });
            }
        }).start();
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
            isAyeshaReady = true;
        }
    }

    private void speak(String text) {
        if (isAyeshaReady && tts != null) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply");
        }
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

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (tts != null) tts.shutdown();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
            }
