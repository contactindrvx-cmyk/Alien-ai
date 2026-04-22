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
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
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
    private Intent speechRecognizerIntent;
    private TextToSpeech tts;
    private AudioManager audioManager;
    
    private boolean isCallActive = false;
    public static boolean isMutedByUser = false; 
    private boolean isMicReleasedForOtherApp = false; 
    
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
            }
        }
        
        isCallActive = true;
        startCallForeground(); 
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        // 🚀 اینڈرائیڈ کو بتاؤ کہ کال چل رہی ہے، اس سے مائیک ٹک ٹک نہیں کرے گا 🚀
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        
        setupAudioFocus();
        setupSpeechRecognizer();
        playConnectSound();
        
        return START_STICKY;
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha Live Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        
        Intent openAppIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingOpenApp = PendingIntent.getActivity(this, 0, openAppIntent, PendingIntent.FLAG_IMMUTABLE);
        
        Intent stopIntent = new Intent(this, AyeshaCallService.class);
        stopIntent.setAction(ACTION_STOP_SERVICE);
        PendingIntent pendingStop = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE);
        
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ لائیو کال")
                .setContentText("عائشہ آپ کی بات سن رہی ہے...")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true)
                .setContentIntent(pendingOpenApp)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", pendingStop)
                .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, notification);
        }
    }

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
        mainHandler.post(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ur-PK");
            
            // 🚨 10 سیکنڈ تک خاموشی برداشت کرنے کی طاقت 🚨
            speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L);
            speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L);
            speechRecognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 10000L);

            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                
                @Override public void onBeginningOfSpeech() {
                    // BARGE-IN: یوزر بولے تو عائشہ چپ کر جائے گی
                    if (tts != null && tts.isSpeaking()) {
                        tts.stop();
                    }
                }

                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                
                @Override public void onError(int error) {
                    if (error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                        setupSpeechRecognizer();
                    } else {
                        restartMicSilently();
                    }
                }

                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        String spokenText = matches.get(0).trim();
                        if (spokenText.length() >= 2 && !isMutedByUser) {
                            sendToPythonServer(spokenText);
                        }
                    }
                    restartMicSilently();
                }

                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            
            restartMicSilently();
        });
    }

    private void restartMicSilently() {
        if (!isCallActive || isMicReleasedForOtherApp || (tts != null && tts.isSpeaking())) return;
        mainHandler.post(() -> {
            try {
                // سسٹم ساؤنڈ بند کر کے مائیک آن کرنا تاکہ بیپ نہ بجے
                if (audioManager != null) {
                    audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0);
                }
                speechRecognizer.startListening(speechRecognizerIntent);
                mainHandler.postDelayed(() -> {
                    if (audioManager != null) {
                        audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0);
                    }
                }, 400);
            } catch (Exception e) {
                setupSpeechRecognizer(); 
            }
        });
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
                
                // سکرین شاٹ بھیجنے کا حصہ
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
                        
                        try {
                            JSONObject json = new JSONObject(data);
                            String chunkText = json.getString("text");
                            fullResponse.append(chunkText);
                            
                            ttsBuffer.append(chunkText);
                            if (chunkText.contains("۔") || chunkText.contains("؟") || chunkText.contains(".") || chunkText.contains("\n")) {
                                String sentence = ttsBuffer.toString().trim();
                                if (!sentence.isEmpty() && !sentence.contains("[ACTION:")) {
                                    speak(sentence);
                                }
                                ttsBuffer.setLength(0);
                            }
                        } catch (Exception e) {}
                    }
                }
                
                String leftover = ttsBuffer.toString().trim();
                if (!leftover.isEmpty() && !leftover.contains("[ACTION:")) {
                    speak(leftover);
                }
                
                String finalText = fullResponse.toString();
                processBackgroundActions(finalText);
                
                Intent uiIntent = new Intent("NEW_MESSAGE_FROM_CALL");
                uiIntent.putExtra("message", finalText);
                sendBroadcast(uiIntent);
                
            } catch (Exception e) {
                speak("معذرت، نیٹ ورک کا مسئلہ ہے۔");
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

    @Override public void onInit(int status) { 
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(new Locale("ur", "PK")); 
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String s) {}
                @Override public void onError(String s) { restartMicSilently(); }
                @Override public void onDone(String s) { restartMicSilently(); }
            });
        }
    }
    
    private void speak(String text) { 
        if (tts != null && !isMicReleasedForOtherApp) { 
            Bundle params = new Bundle();
            // 🚀 اواز کو فون کال والے اسٹریم پر بھیجیں تاکہ واضح سنائی دے 🚀
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_VOICE_CALL);
            tts.speak(text, TextToSpeech.QUEUE_ADD, params, "AyeshaCallID"); 
        } 
    }
    
    private void playConnectSound() {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100);
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150);
            new Handler(Looper.getMainLooper()).postDelayed(toneGen::release, 200);
        } catch (Exception e) {}
    }

    private void endCallCompletely() {
        isCallActive = false;
        if (audioManager != null) {
            audioManager.setMode(AudioManager.MODE_NORMAL);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusChangeListener != null) {
                audioManager.abandonAudioFocus(audioFocusChangeListener);
            }
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        if (tts != null) { tts.stop(); tts.shutdown(); }
        stopForeground(true);
        stopSelf();
    }
    
    @Override public void onCreate() { 
        super.onCreate(); 
        tts = new TextToSpeech(this, this); 
    }
    
    @Override public void onDestroy() { 
        endCallCompletely();
        super.onDestroy();
    }
    
    @Override public IBinder onBind(Intent intent) { return null; }
                        }
                            
