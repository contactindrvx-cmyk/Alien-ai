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
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Locale;

public class FloatingBubbleService extends Service implements TextToSpeech.OnInitListener {

    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private Handler silenceHandler = new Handler(Looper.getMainLooper());
    private boolean isAyeshaReady = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        startMyForeground();
        tts = new TextToSpeech(this, this);
        setupMic();
    }

    private void startMyForeground() {
        String channelId = "AyeshaVoiceChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha AI", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ ایکٹو ہے")
                .setContentText("آپ کی آواز سن رہی ہوں...")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);
    }

    private void setupMic() {
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
        
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();
                    if (text.contains("ayesha") || text.contains("عائشہ")) {
                        speak("جی رضا بھائی، فرمائیے!");
                    }
                }
                // بولنے کے بعد 2 سیکنڈ خاموش رہیں تاکہ بیپ نہ آئے
                silenceHandler.postDelayed(() -> speechRecognizer.startListening(intent), 2000);
            }
            @Override public void onError(int error) {
                // اگر مائیک پر ایرر آئے تو 1 سیکنڈ بعد دوبارہ ٹرائی کریں
                silenceHandler.postDelayed(() -> speechRecognizer.startListening(intent), 1000);
            }
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });
        speechRecognizer.startListening(intent);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
            isAyeshaReady = true;
        }
    }

    private void speak(String text) {
        if (isAyeshaReady) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaReply");
        }
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }
}
