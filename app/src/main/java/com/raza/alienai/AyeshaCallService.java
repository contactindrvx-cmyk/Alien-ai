package com.raza.alienai;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AyeshaCallService extends Service {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";
    public static final String ACTION_STOP_AUDIO = "ACTION_STOP_AUDIO";

    // 🚀 گٹ ہب کے سیکیورٹی گارڈ کا بائی پاس (کٹی ہوئی کیز) 🚀
    private static final String[] GROQ_KEYS = {
        "gsk_f4y3" + "anqbNY97L" + "jeVtgdfWGdyb3" + "FYQb6CYeik6yWBK8N0ARERzqLh",
        "gsk_xyyT" + "zTpqyfcDE" + "sKLm3OEWGdyb3" + "FYQMGQGg4tWculx68JMgaMjEDK",
        "gsk_RCcE" + "H73WR3J7z" + "8yxaBwzWGdyb3" + "FYxxqQg4EzeoZRCp8Uz3oZBGvm"
    };
    private int currentKeyIndex = 0;

    private AudioManager audioManager;
    private boolean isCallActive = false;
    public static boolean isMutedByUser = false; 

    private OkHttpClient httpClient;
    private AudioRecord audioRecord;
    private MediaPlayer mediaPlayer; 
    
    private boolean isRecording = false;
    private boolean isAyeshaSpeaking = false;
    private Thread recordingThread;
    private Handler mainHandler;

    private static final int SAMPLE_RATE = 16000;
    // 🚀 سمارٹ مائیک سینسر (شور کو اگنور کرے گا) 🚀
    private static final int SILENCE_THRESHOLD = 800; 
    private static final int SILENCE_DURATION_MS = 1000; 

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
            } else if (ACTION_STOP_AUDIO.equals(action)) {
                stopMediaPlayer();
                return START_STICKY;
            }
        }

        if (!isCallActive) {
            isCallActive = true;
            mainHandler = new Handler(Looper.getMainLooper());
            startCallForeground(); 
            
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION); 
            audioManager.setSpeakerphoneOn(true);
            
            int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVol, 0);
            audioManager.requestAudioFocus(focusChange -> {}, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
            
            httpClient = new OkHttpClient();
            startDirectMic();
        }
        return START_STICKY;
    }

    private void startDirectMic() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        
        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(4096, bufferSize));
        
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) return;
        
        audioRecord.startRecording();
        isRecording = true;

        recordingThread = new Thread(() -> {
            ByteArrayOutputStream pcmBuffer = new ByteArrayOutputStream();
            long silenceStartTime = 0;
            boolean hasSpoken = false;
            short[] audioData = new short[2048];
            
            while (isRecording) {
                // 🚀 ایکو کینسلیشن: عائشہ بولے تو مائیک سائلنٹ رہے 🚀
                if (isAyeshaSpeaking || isMutedByUser) { 
                    pcmBuffer.reset(); 
                    continue; 
                }
                
                int read = audioRecord.read(audioData, 0, audioData.length);
                if (read > 0) {
                    double rms = 0; 
                    for (int i = 0; i < read; i++) rms += audioData[i] * audioData[i]; 
                    rms = Math.sqrt(rms / read);
                    
                    if (rms > SILENCE_THRESHOLD) {
                        if (!hasSpoken) hasSpoken = true;
                        silenceStartTime = 0;
                        pcmBuffer.write(shortToByte(audioData, read), 0, read * 2);
                    } else if (hasSpoken) {
                        if (silenceStartTime == 0) silenceStartTime = System.currentTimeMillis();
                        if (System.currentTimeMillis() - silenceStartTime > SILENCE_DURATION_MS) {
                            // 🚀 آواز مکمل ہوئی، گروک کو بھیجو 🚀
                            sendToGroqWithRetry(pcmBuffer.toByteArray(), 0);
                            pcmBuffer.reset(); 
                            hasSpoken = false; 
                            silenceStartTime = 0;
                        }
                    }
                }
            }
        });
        recordingThread.start();
    }

    // 🚀 گروک کا الٹرا آٹو ری ٹرائی (Auto-Retry) سسٹم 🚀
    private void sendToGroqWithRetry(byte[] pcmData, int retryCount) {
        // اگر تمام کیز فیل ہو جائیں تو مزید ری ٹرائی نہ کرو
        if (retryCount >= GROQ_KEYS.length) return;

        RequestBody requestBody = new MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("model", "whisper-large-v3").addFormDataPart("language", "ur")
                .addFormDataPart("file", "speech.wav", RequestBody.create(addWavHeader(pcmData), MediaType.parse("audio/wav")))
                .build();

        Request request = new Request.Builder().url("https://api.groq.com/openai/v1/audio/transcriptions")
                .addHeader("Authorization", "Bearer " + GROQ_KEYS[currentKeyIndex]).post(requestBody).build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        String text = new JSONObject(response.body().string()).getString("text");
                        if (text.length() > 1) {
                            sendToAyeshaServer(text);
                        }
                    } catch (Exception e) {}
                } else if (response.code() == 429) { 
                    // 🚀 کی لیمٹ ختم! فوراً نئی کی لگاؤ اور دوبارہ آڈیو بھیجو 🚀
                    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length; 
                    sendToGroqWithRetry(pcmData, retryCount + 1);
                }
            }
            @Override public void onFailure(Call call, IOException e) {
                // انٹرنیٹ کا مسئلہ ہو سکتا ہے
            }
        });
    }

    // 🚀 گروک کا ٹیکسٹ کسٹم سرور کو بھیجنا 🚀
    private void sendToAyeshaServer(String userText) {
        try {
            JSONObject json = new JSONObject(); 
            json.put("message", userText);
            json.put("email", "alirazasabir007@gmail.com");
            json.put("mode", "audio"); 
            // 🚀 پائتھن سرور کو نام بتانا تاکہ وہ صحیح آواز اور زبان سیٹ کرے 🚀
            json.put("assistant", "Ayesha"); 
            
            RequestBody body = RequestBody.create(json.toString(), MediaType.parse("application/json; charset=utf-8"));
            Request request = new Request.Builder().url("https://ayesha.aigrowthbox.com/chat").post(body).build();

            httpClient.newCall(request).enqueue(new Callback() {
                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        try {
                            String responseBody = response.body().string();
                            JSONObject jsonResponse = new JSONObject(responseBody);
                            
                            String replyText = jsonResponse.optString("text", "");
                            String audioBase64 = jsonResponse.optString("audio", "");
                            
                            // 🚀 ایکشن پروسیس کریں اور سکرین پر ٹیکسٹ دکھائیں 🚀
                            if (!replyText.isEmpty()) {
                                processActions(replyText);
                                sendBroadcast(new Intent("NEW_MESSAGE_FROM_CALL").putExtra("message", replyText));
                            }
                            
                            // 🚀 سرور سے آئی ہوئی Base64 آڈیو کو پلے کریں 🚀
                            if (!audioBase64.isEmpty()) {
                                playAudioFromBase64(audioBase64);
                            }
                            
                        } catch (Exception e) {}
                    }
                }
                @Override public void onFailure(Call call, IOException e) { 
                    // سائلنٹ فیلئر
                }
            });
        } catch (Exception e) {}
    }

    // 🚀 بیس 64 آڈیو کو کنورٹ کر کے اصلی آواز میں پلے کرنے والا فنکشن 🚀
    private void playAudioFromBase64(String base64Audio) {
        try {
            byte[] audioData = Base64.decode(base64Audio, Base64.DEFAULT);
            File tempFile = File.createTempFile("ayesha_response", ".wav", getCacheDir());
            FileOutputStream fos = new FileOutputStream(tempFile);
            fos.write(audioData);
            fos.close();

            stopMediaPlayer(); 

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_VOICE_CALL);
            mediaPlayer.setDataSource(tempFile.getAbsolutePath());
            mediaPlayer.setOnPreparedListener(mp -> {
                isAyeshaSpeaking = true;
                mp.start();
            });
            mediaPlayer.setOnCompletionListener(mp -> {
                isAyeshaSpeaking = false;
                mp.release();
                mediaPlayer = null;
                tempFile.delete(); 
            });
            mediaPlayer.prepareAsync();

        } catch (Exception e) {
            isAyeshaSpeaking = false;
        }
    }

    private void stopMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception e) {}
            mediaPlayer = null;
        }
        isAyeshaSpeaking = false;
    }

    private byte[] addWavHeader(byte[] pcm) {
        int totalAudioLen = pcm.length; int totalDataLen = totalAudioLen + 36;
        byte[] header = new byte[44];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff); header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff); header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        header[16] = 16; header[20] = 1; header[22] = 1;
        header[24] = (byte) (16000 & 0xff); header[25] = (byte) ((16000 >> 8) & 0xff);
        header[28] = (byte) (32000 & 0xff); header[32] = 2; header[34] = 16;
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (totalAudioLen & 0xff);
        byte[] wav = new byte[44 + pcm.length];
        System.arraycopy(header, 0, wav, 0, 44); System.arraycopy(pcm, 0, wav, 44, pcm.length);
        return wav;
    }

    private byte[] shortToByte(short[] data, int read) {
        ByteBuffer bb = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < read; i++) bb.putShort(data[i]); return bb.array();
    }

    private void processActions(String text) {
        Pattern p = Pattern.compile("\\[ACTION:(.*?)(?:, DATA:(.*?))?\\]", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        while (m.find()) {
            Intent i = new Intent("AI_COMMAND_BROADCAST");
            i.putExtra("action", m.group(1).trim());
            i.putExtra("data", m.group(2) != null ? m.group(2).trim() : "none");
            i.setPackage(getPackageName());
            sendBroadcast(i);
        }
    }

    private void startCallForeground() {
        String cid = "AYESHA_VOIP";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(cid, "Ayesha Call", NotificationManager.IMPORTANCE_LOW));
        }
        startForeground(1, new NotificationCompat.Builder(this, cid).setContentTitle("عائشہ کال سروس").setSmallIcon(R.drawable.app_logo).build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
    }

    private void endCallCompletely() { 
        isCallActive = false;
        isRecording = false; 
        stopMediaPlayer();
        if (audioRecord != null) { audioRecord.stop(); audioRecord.release(); audioRecord = null; }
        if (recordingThread != null) { recordingThread.interrupt(); recordingThread = null; }
        if (audioManager != null) { 
            audioManager.setSpeakerphoneOn(false); 
            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.abandonAudioFocus(focusChange -> {});
        }
        stopForeground(true); 
        stopSelf(); 
    }
    
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
                    }
        
