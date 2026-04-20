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
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.util.Locale;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";

    private static final int SAMPLE_RATE = 16000;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private WebSocket webSocket;
    private TextToSpeech tts;
    private AudioManager audioManager;
    private TelephonyManager telephonyManager;
    
    private boolean isMutedBySystem = false;
    public static boolean isMutedByUser = false; 
    private boolean isAyeshaSpeaking = false;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP_SERVICE.equals(action)) {
                stopForeground(true); 
                stopSelf(); 
                return START_NOT_STICKY;
            } else if (ACTION_MUTE_CALL.equals(action)) {
                isMutedByUser = intent.getBooleanExtra("isMuted", false); 
                return START_STICKY;
            }
        }
        
        startCallForeground(); 
        connectWebSocket(); 
        startAudioStreaming();
        return START_STICKY;
    }

    private void startCallForeground() {
        String channelId = "AyeshaCallChannel";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Active Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        
        Intent openAppIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingOpenApp = PendingIntent.getActivity(this, 0, openAppIntent, PendingIntent.FLAG_IMMUTABLE);
        
        Intent stopIntent = new Intent(this, AyeshaCallService.class);
        stopIntent.setAction(ACTION_STOP_SERVICE);
        PendingIntent pendingStop = PendingIntent.getService(this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE);
        
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("Ayesha AI")
                .setContentText("Ongoing voice conversation")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true)
                .setContentIntent(pendingOpenApp)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", pendingStop)
                .build();

        try {
            // اصل فکس یہ ہے: اینڈرائیڈ 10+ کے لیے مائیک کی سروس ٹائپ بتانا لازمی ہے
            if (Build.VERSION.SDK_INT >= 29) { // Build.VERSION_CODES.Q
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(1, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupListeners() {
        try {
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioManager.requestAudioFocus(f -> {
                    if (f == AudioManager.AUDIOFOCUS_LOSS || f == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) isMutedBySystem = true; 
                    else if (f == AudioManager.AUDIOFOCUS_GAIN) isMutedBySystem = false; 
                }, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
            }

            // اگر فون کال آئے تو سروس کو میوٹ کرنے کا لاجک (Crash سے بچنے کے لیے try-catch میں)
            telephonyManager.listen(new PhoneStateListener() {
                @Override public void onCallStateChanged(int state, String phoneNumber) {
                    if (state == TelephonyManager.CALL_STATE_OFFHOOK) isMutedBySystem = true;
                    else if (state == TelephonyManager.CALL_STATE_IDLE) isMutedBySystem = false;
                }
            }, PhoneStateListener.LISTEN_CALL_STATE);
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    private void startAudioStreaming() {
        try {
            // سیکیورٹی چیک: مائیک کی پرمیشن کے بغیر ایپ کریش نہ ہو
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                mainHandler.post(() -> Toast.makeText(this, "مائیک کی پرمیشن درکار ہے", Toast.LENGTH_SHORT).show());
                return;
            }

            int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
            
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                mainHandler.post(() -> Toast.makeText(this, "مائیک شروع نہیں ہو سکا، ایپ دوبارہ کھولیں", Toast.LENGTH_SHORT).show());
                return;
            }

            audioRecord.startRecording(); 
            isRecording = true;

            new Thread(() -> {
                try {
                    byte[] buffer = new byte[bufferSize]; 
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    boolean userIsSpeaking = false; 
                    int silenceFrames = 0;
                    
                    while (isRecording) {
                        if (isMutedBySystem || isAyeshaSpeaking || isMutedByUser) continue;
                        int read = audioRecord.read(buffer, 0, buffer.length);
                        if (read > 0) {
                            double rms = calculateRMS(buffer, read);
                            if (rms > 500) { 
                                userIsSpeaking = true; 
                                silenceFrames = 0; 
                                baos.write(buffer, 0, read); 
                            } else if (userIsSpeaking) { 
                                silenceFrames++; 
                                baos.write(buffer, 0, read);
                                if (silenceFrames > 25) { 
                                    userIsSpeaking = false; 
                                    sendRawAudioToAI(baos.toByteArray()); 
                                    baos.reset(); 
                                }
                            }
                        }
                    }
                } catch (Exception e) { e.printStackTrace(); }
            }).start();
        } catch (SecurityException se) {
            mainHandler.post(() -> Toast.makeText(this, "مائیک پرمیشن ایرر", Toast.LENGTH_SHORT).show());
        } catch (Exception e) { 
            mainHandler.post(() -> Toast.makeText(this, "آڈیو ریکارڈنگ ایرر", Toast.LENGTH_SHORT).show()); 
        }
    }

    private double calculateRMS(byte[] buffer, int length) {
        long sum = 0; 
        for (int i = 0; i < length; i += 2) { 
            short sample = (short) ((buffer[i + 1] << 8) | (buffer[i] & 0xFF)); 
            sum += sample * sample; 
        }
        return Math.sqrt(sum / (length / 2.0));
    }

    private void sendRawAudioToAI(byte[] pcmData) {
        if (pcmData.length < 8000) return; 
        try {
            String base64Audio = Base64.encodeToString(addWavHeader(pcmData), Base64.NO_WRAP);
            JSONObject json = new JSONObject(); 
            json.put("audio", base64Audio); 
            json.put("email", "alirazasabir007@gmail.com");
            if (webSocket != null) webSocket.send(json.toString());
        } catch (Exception e) {}
    }

    private byte[] addWavHeader(byte[] pcmData) {
        int totalAudioLen = pcmData.length; 
        int totalDataLen = totalAudioLen + 36; 
        int byteRate = SAMPLE_RATE * 2;
        byte[] header = new byte[44];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F'; 
        header[4] = (byte) (totalDataLen & 0xff); header[5] = (byte) ((totalDataLen >> 8) & 0xff); 
        header[6] = (byte) ((totalDataLen >> 16) & 0xff); header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E'; 
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' '; 
        header[16] = 16; header[20] = 1; header[22] = 1;
        header[24] = (byte) (SAMPLE_RATE & 0xff); header[25] = (byte) ((SAMPLE_RATE >> 8) & 0xff); 
        header[28] = (byte) (byteRate & 0xff); header[29] = (byte) ((byteRate >> 8) & 0xff); 
        header[32] = 2; header[34] = 16; 
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (totalAudioLen & 0xff); header[41] = (byte) ((totalAudioLen >> 8) & 0xff); 
        header[42] = (byte) ((totalAudioLen >> 16) & 0xff); header[43] = (byte) ((totalAudioLen >> 24) & 0xff);
        byte[] wavData = new byte[header.length + pcmData.length]; 
        System.arraycopy(header, 0, wavData, 0, header.length); 
        System.arraycopy(pcmData, 0, wavData, header.length, pcmData.length);
        return wavData;
    }

    private void connectWebSocket() {
        OkHttpClient client = new OkHttpClient(); 
        Request request = new Request.Builder().url("wss://aigrowthbox-ayesha-ai.hf.space/ws/live").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override public void onMessage(WebSocket webSocket, String text) {
                try {
                    String reply = new JSONObject(text).getString("response");
                    Intent intent = new Intent("NEW_MESSAGE_FROM_CALL"); 
                    intent.putExtra("message", reply); 
                    sendBroadcast(intent);
                    mainHandler.post(() -> speak(reply));
                } catch (Exception e) {}
            }
        });
    }

    @Override public void onInit(int status) { 
        if (status == TextToSpeech.SUCCESS) tts.setLanguage(new Locale("ur", "PK")); 
    }
    
    private void speak(String text) { 
        if (tts != null && !isMutedBySystem) { 
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AyeshaCall"); 
            isAyeshaSpeaking = true; 
            new Handler().postDelayed(() -> isAyeshaSpeaking = false, text.length() * 80); 
        } 
    }
    
    @Override public void onCreate() { 
        super.onCreate(); 
        tts = new TextToSpeech(this, this); 
        setupListeners(); 
    }
    
    @Override public void onDestroy() { 
        isRecording = false; 
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch(Exception e) {}
            audioRecord.release(); 
        }
        if (webSocket != null) webSocket.close(1000, "User Cut Call"); 
        if (tts != null) tts.shutdown(); 
    }
    
    @Override public IBinder onBind(Intent intent) { return null; }
             }
            
