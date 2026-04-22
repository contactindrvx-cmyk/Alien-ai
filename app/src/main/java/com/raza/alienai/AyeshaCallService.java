package com.raza.alienai;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
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

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";

    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private TextToSpeech tts;
    private AudioManager audioManager;
    
    private boolean isCallActive = false;
    private boolean isListening = false; // 🚀 ٹک ٹک روکنے کے لیے 🚀
    public static boolean isMutedByUser = false; 
    private boolean isMicReleasedForOtherApp = false; 
    
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP_SERVICE.equals(intent.getAction())) {
            endCallCompletely();
            return START_NOT_STICKY;
        }
        
        isCallActive = true;
        startCallForeground(); 
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        
        setupSpeechRecognizer();
        playConnectSound();
        
        return START_STICKY;
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "عائشہ لائیو کال", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال")
                .setContentText("عائشہ آپ کی آواز سن رہی ہے...")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, notification);
        }
    }

    private void setupSpeechRecognizer() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
        // مائیک کو لمبا کھلا رکھنے کی کوشش
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L);

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { 
                isListening = true; 
                unmuteSystem(); 
            }
            @Override public void onBeginningOfSpeech() { if (tts.isSpeaking()) tts.stop(); }
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() { isListening = false; }
            @Override public void onError(int error) {
                isListening = false;
                if (isCallActive) mainHandler.postDelayed(() -> restartMicSilently(), 1000); 
            }
            @Override public void onResults(Bundle results) {
                isListening = false;
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).trim();
                    if (text.length() >= 2 && !isMutedByUser) sendToPythonServer(text);
                }
                if (isCallActive) restartMicSilently();
            }
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });
        restartMicSilently();
    }

    private void restartMicSilently() {
        if (!isCallActive || isListening || (tts != null && tts.isSpeaking())) return;
        mainHandler.post(() -> {
            try {
                muteSystem();
                speechRecognizer.startListening(speechIntent);
            } catch (Exception e) { setupSpeechRecognizer(); }
        });
    }

    private void muteSystem() {
        if (audioManager != null) audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0);
    }

    private void unmuteSystem() {
        if (audioManager != null) audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0);
    }

    private void sendToPythonServer(String message) {
        new Thread(() -> {
            try {
                URL url = new URL("https://aigrowthbox-ayesha-ai.hf.space/chat");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                
                JSONObject payload = new JSONObject();
                payload.put("message", message);
                payload.put("email", "alirazasabir007@gmail.com");
                
                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.close();
                
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String line;
                StringBuilder ttsBuffer = new StringBuilder();
                
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("data: ")) {
                        JSONObject json = new JSONObject(line.substring(6));
                        String chunkText = json.getString("text");
                        ttsBuffer.append(chunkText);
                        if (chunkText.contains("۔") || chunkText.contains("؟") || chunkText.contains(".")) {
                            speak(ttsBuffer.toString().trim());
                            ttsBuffer.setLength(0);
                        }
                    }
                }
                if (ttsBuffer.length() > 0) speak(ttsBuffer.toString().trim());
                
            } catch (Exception ignored) {}
        }).start();
    }

    private void speak(String text) { 
        if (tts != null && !text.contains("[ACTION:")) { 
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL);
            tts.speak(text, TextToSpeech.QUEUE_ADD, params, "AyeshaID"); 
        } 
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK"));
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String s) {}
                @Override public void onDone(String s) { if (isCallActive) restartMicSilently(); }
                @Override public void onError(String s) { if (isCallActive) restartMicSilently(); }
            });
        }
    }

    private void playConnectSound() {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100);
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150);
            mainHandler.postDelayed(toneGen::release, 300);
        } catch (Exception ignored) {}
    }

    private void endCallCompletely() {
        isCallActive = false;
        if (audioManager != null) audioManager.setMode(AudioManager.MODE_NORMAL);
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); tts = new TextToSpeech(this, this); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
    }
                                                       
