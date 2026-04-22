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
    private boolean isListening = false; 
    public static boolean isMutedByUser = false; 
    private boolean isMicReleasedForOtherApp = false; // واٹس ایپ کے لیے مائیک چھوڑنا
    
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_SERVICE.equals(action)) {
                endCallCompletely();
                return START_NOT_STICKY;
            } else if (ACTION_MUTE_CALL.equals(action)) {
                isMutedByUser = intent.getBooleanExtra("isMuted", false); 
                return START_STICKY;
            } else if ("SCREEN_ANALYZED_WAKEUP".equals(action)) {
                // 🚀 سکرین پڑھنے کے بعد یہ سروس جاگے گی اور تصویر بھیجے گی 🚀
                String promptMsg = "[سکرین کا ڈیٹا موصول ہوا]\nصارف کی سکرین پر موجود چیزوں کا جائزہ لے کر اردو میں مختصر جواب دیں۔";
                sendToPythonServer(promptMsg);
                return START_STICKY;
            }
        }
        
        isCallActive = true;
        startCallForeground(); 
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        
        setupAudioFocus(); // واٹس ایپ کے لیے مائیک چھوڑنے والا فنکشن
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
                .setContentText("عائشہ پس منظر میں سن رہی ہے...")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, notification);
        }
    }

    // 🚀 واٹس ایپ اور دوسری ایپس کو مائیک دینے والا کوڈ 🚀
    private void setupAudioFocus() {
        audioFocusChangeListener = focusChange -> {
            if (focusChange == AudioManager.AUDIOFOCUS_LOSS || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                isMicReleasedForOtherApp = true;
                if (speechRecognizer != null) speechRecognizer.stopListening();
                if (tts != null && tts.isSpeaking()) tts.stop();
            } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
                isMicReleasedForOtherApp = false;
                restartMicSilently();
            }
        };
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
    }

    private void setupSpeechRecognizer() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 5000L); // 5 سیکنڈ خاموشی

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
                if (isCallActive && !isMicReleasedForOtherApp) mainHandler.postDelayed(() -> restartMicSilently(), 500); 
            }
            @Override public void onResults(Bundle results) {
                isListening = false;
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).trim();
                    // صارف کی آواز سرور کو بھیجو
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
        if (!isCallActive || isListening || isMicReleasedForOtherApp || (tts != null && tts.isSpeaking())) return;
        mainHandler.post(() -> {
            try {
                muteSystem(); // بیپ کی آواز روکو
                speechRecognizer.startListening(speechIntent);
                mainHandler.postDelayed(this::unmuteSystem, 300); // 300ms بعد ساؤنڈ کھولو تاکہ عائشہ بول سکے
            } catch (Exception e) { setupSpeechRecognizer(); }
        });
    }

    private void muteSystem() {
        if (audioManager != null) {
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0);
        }
    }

    private void unmuteSystem() {
        if (audioManager != null) {
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0);
        }
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
                
                // تصویر سکرین شاٹ بھیجو اگر موجود ہو
                String currentB64 = AyeshaAccessibilityService.latestScreenshotBase64;
                if (currentB64 != null && !currentB64.isEmpty()) {
                    payload.put("image", currentB64);
                    AyeshaAccessibilityService.latestScreenshotBase64 = ""; 
                }
                
                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.close();
                
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String line;
                StringBuilder fullResponse = new StringBuilder();
                StringBuilder ttsBuffer = new StringBuilder();
                
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("data: ")) {
                        String data = line.substring(6);
                        if (data.trim().isEmpty() || data.equals("[DONE]")) continue;
                        
                        JSONObject json = new JSONObject(data);
                        String chunkText = json.getString("text");
                        fullResponse.append(chunkText);
                        ttsBuffer.append(chunkText);
                        
                        // 🚀 بولتے وقت [ACTION] والی کمانڈ کو نہیں بولنا 🚀
                        if (chunkText.contains("۔") || chunkText.contains("؟") || chunkText.contains("\n")) {
                            String sentence = ttsBuffer.toString().replaceAll("\\[.*?\\]", "").trim();
                            if (!sentence.isEmpty()) speak(sentence);
                            ttsBuffer.setLength(0);
                        }
                    }
                }
                
                String leftover = ttsBuffer.toString().replaceAll("\\[.*?\\]", "").trim();
                if (!leftover.isEmpty()) speak(leftover);
                
                // 🚀 اب یہ ایکشن لے گی (جیسے یوٹیوب ان کرنا) 🚀
                String finalText = fullResponse.toString();
                processBackgroundActions(finalText);
                
                // 🚀 UI (سکرین) کو بھی اپڈیٹ کرے گی 🚀
                Intent uiIntent = new Intent("NEW_MESSAGE_FROM_CALL");
                uiIntent.putExtra("message", finalText);
                sendBroadcast(uiIntent);
                
            } catch (Exception ignored) {
                speak("معذرت، انٹرنیٹ کا مسئلہ ہے۔");
            }
        }).start();
    }

    private void processBackgroundActions(String text) {
        Pattern pattern = Pattern.compile("\\[ACTION:\\s*(.*?)(?:,\\s*DATA:\\s*(.*?))?\\]", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String action = matcher.group(1).trim();
            String data = matcher.group(2) != null ? matcher.group(2).trim() : "none";
            if (action.contains("||") && !action.contains("MULTI_TASK")) {
                data = action;
                action = "MULTI_TASK";
            }
            Intent intent = new Intent("AI_COMMAND_BROADCAST");
            intent.putExtra("action", action);
            intent.putExtra("data", data);
            sendBroadcast(intent);
        }
    }

    private void speak(String text) { 
        if (tts != null && !isMicReleasedForOtherApp) { 
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL);
            tts.speak(text, TextToSpeech.QUEUE_ADD, params, "AyeshaCallID"); 
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
        if (audioManager != null) {
            audioManager.setMode(AudioManager.MODE_NORMAL);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusChangeListener != null) {
                audioManager.abandonAudioFocus(audioFocusChangeListener);
            }
        }
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); tts = new TextToSpeech(this, this); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
                    }
        
