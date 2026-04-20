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
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private Surface currentSurface;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isAyeshaReady = false;
    private boolean isCommandMode = false;
    private boolean isAyeshaSpeaking = false;

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
        
        mainHandler.postDelayed(this::startListeningLoop, 2000);
    }

    private void startMyForeground() {
        String channelId = "AyeshaChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Ayesha AI", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null); 
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("عائشہ ایکٹو ہے")
                .setContentText("سن رہی ہوں...")
                .setSmallIcon(R.drawable.app_logo)
                .build();
        startForeground(1, notification);
    }

    // 🔇 مائیک کی بیپ کو ہر طرح سے گلا دبا کر ختم کرنے کا فنکشن 🔇
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
                // مائیک آن ہو گیا، اب سسٹم کی آواز واپس کھول دو
                muteSystemBeep(false); 
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String text = matches.get(0).toLowerCase();
                    
                    // 🚀 بات کاٹنے والا فیچر (Interruption Logic) 🚀
                    if (text.contains("ayesha") || text.contains("عائشہ") || text.contains("آشا")) {
                        if (isAyeshaSpeaking && tts != null) {
                            tts.stop(); // فوراً چپ ہو جاؤ
                            if (mediaPlayer != null) mediaPlayer.pause();
                            isAyeshaSpeaking = false;
                        }
                        
                        if (!isCommandMode) {
                            isCommandMode = true;
                            speechRecognizer.cancel(); 
                            speak("جی، سن رہی ہوں"); // 🌟 نیا رسپانس 🌟
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

                    // اگر عائشہ بول رہی ہے تو باقی ہر لفظ اگنور کرو (Echo Filter)
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
                        sendToAiServer(text);
                    }
                } else {
                    restartMicQuietly();
                }
            }

            @Override 
            public void onError(int error) { 
                muteSystemBeep(false); // ایرر پر بھی آواز کھول دو
                
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

        // 🤫 مائیک سٹارٹ ہونے سے عین پہلے بیپ کو خاموش کر دو 🤫
        muteSystemBeep(true);
        try { speechRecognizer.startListening(intent); } catch (Exception e) { muteSystemBeep(false); }
    }

    private void restartMicQuietly() {
        mainHandler.removeCallbacksAndMessages(null);
        mainHandler.postDelayed(this::startListeningLoop, 800);
    }

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
                mainHandler.post(() -> speak(reply));
            } catch (Exception e) {
                mainHandler.post(() -> {
                    speak("انٹرنیٹ کا مسئلہ ہے۔");
                    restartMicQuietly();
                });
            }
        }).start();
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
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
        }
        if (tts != null) tts.shutdown();
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
}
