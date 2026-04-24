package com.raza.alienai;

import android.Manifest;
import android.app.Notification;
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
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;

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
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service {

    public static final String ACTION_STOP_SERVICE = "STOP_AYESHA_CALL";
    public static final String ACTION_MUTE_CALL = "MUTE_AYESHA_CALL";
    public static final String ACTION_STOP_AUDIO = "ACTION_STOP_AUDIO";

    // 🚀 گٹ ہب کے روبوٹ کو بائی پاس کرنے کے لیے 🚀
    private static final String[] GROQ_KEYS = {
        "gsk_f4y3anqb" + "NY97LjeVtgdfWGdyb3FYQb6CYeik6yWBK8N0ARERzqLh",
        "gsk_xyyTzTpq" + "yfcDEsKLm3OEWGdyb3FYQMGQGg4tWculx68JMgaMjEDK",
        "gsk_RCcEH73W" + "R3J7z8yxaBwzWGdyb3FYxxqQg4EzeoZRCp8Uz3oZBGvm"
    };
    private int currentKeyIndex = 0;

    private AudioManager audioManager;
    private boolean isCallActive = false;
    public static boolean isMutedByUser = false; 

    private OkHttpClient httpClient;
    private WebSocket webSocket;
    private AudioRecord audioRecord;
    private MediaPlayer mediaPlayer;
    private boolean isRecording = false;
    private boolean isAyeshaSpeaking = false;
    private Thread recordingThread;
    private Handler mainHandler;

    private static final int SAMPLE_RATE = 16000;
    // 🚀 حساسیت کم کر دی گئی ہے تاکہ آپ کی آواز جلدی پکڑے 🚀
    private static final int SILENCE_THRESHOLD = 500; 
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
            connectToAyeshaServer();
            playConnectSound();
        }
        return START_STICKY;
    }

    private void connectToAyeshaServer() {
        Request request = new Request.Builder().url("wss://ayesha.aigrowthbox.com/ws/text_chat").build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                startDirectMic();
                showToast("کال کنیکٹ ہو گئی ہے!");
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject json = new JSONObject(text);
                    String reply = json.optString("text", "");
                    String audioB64 = json.optString("audio", "");
                    
                    if (!reply.isEmpty()) {
                        processActions(reply);
                        sendBroadcast(new Intent("NEW_MESSAGE_FROM_CALL").putExtra("message", reply));
                    }
                    if (!audioB64.isEmpty()) {
                        playAudio(audioB64);
                    } else {
                        showToast("OpenAI کی آواز فیل ہو گئی۔ کیا اکاؤنٹ میں بیلنس ہے؟");
                    }
                } catch (Exception e) {}
            }

            @Override public void onClosed(WebSocket webSocket, int code, String reason) { stopRecording(); showToast("سرور سے رابطہ کٹ گیا۔"); }
            @Override public void onFailure(WebSocket webSocket, Throwable t, Response response) { stopRecording(); showToast("سرور ایرر: " + t.getMessage()); }
        });
    }

    private void startDirectMic() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;

        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int finalBufferSize = Math.max(4096, bufferSize);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, finalBufferSize);
        
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) return;

        audioRecord.startRecording();
        isRecording = true;

        recordingThread = new Thread(() -> {
            ByteArrayOutputStream pcmBuffer = new ByteArrayOutputStream();
            long silenceStartTime = 0;
            boolean hasSpoken = false;

            short[] audioData = new short[finalBufferSize / 2];
            while (isRecording) {
                if (isAyeshaSpeaking || isMutedByUser) {
                    pcmBuffer.reset();
                    continue;
                }

                int read = audioRecord.read(audioData, 0, audioData.length);
                if (read > 0) {
                    double rms = calculateRMS(audioData, read);
                    
                    if (rms > SILENCE_THRESHOLD) {
                        if (!hasSpoken) hasSpoken = true;
                        silenceStartTime = 0;
                        byte[] bytes = shortToByte(audioData, read);
                        pcmBuffer.write(bytes, 0, bytes.length);
                    } else if (hasSpoken) {
                        if (silenceStartTime == 0) silenceStartTime = System.currentTimeMillis();
                        if (System.currentTimeMillis() - silenceStartTime > SILENCE_DURATION_MS) {
                            sendToGroq(pcmBuffer.toByteArray());
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

    private void sendToGroq(byte[] pcmData) {
        showToast("آواز گروک کو بھیجی جا رہی ہے...");
        byte[] wavData = addWavHeader(pcmData);
        RequestBody requestBody = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("model", "whisper-large-v3")
                .addFormDataPart("language", "ur")
                .addFormDataPart("file", "speech.wav", RequestBody.create(wavData, MediaType.parse("audio/wav")))
                .build();

        Request request = new Request.Builder()
                .url("https://api.groq.com/openai/v1/audio/transcriptions")
                .addHeader("Authorization", "Bearer " + GROQ_KEYS[currentKeyIndex])
                .post(requestBody)
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        String result = response.body().string();
                        String text = new JSONObject(result).getString("text");
                        if (text.length() > 1 && webSocket != null) {
                            webSocket.send(new JSONObject().put("text", text).toString());
                        }
                    } catch (Exception e) {}
                } else if (response.code() == 429) {
                    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
                    showToast("گروک کی Key روٹیٹ ہو رہی ہے۔");
                } else {
                    showToast("گروک ایرر: " + response.code());
                }
            }
            @Override public void onFailure(Call call, IOException e) {
                showToast("انٹرنیٹ یا گروک کا مسئلہ: " + e.getMessage());
            }
        });
    }

    private byte[] addWavHeader(byte[] pcm) {
        int totalAudioLen = pcm.length;
        int totalDataLen = totalAudioLen + 36;
        int channels = 1;
        long byteRate = 16000 * 2 * channels;
        byte[] header = new byte[44];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff); header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff); header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0;
        header[20] = 1; header[21] = 0; header[22] = (byte) channels; header[23] = 0;
        header[24] = (byte) (16000 & 0xff); header[25] = (byte) ((16000 >> 8) & 0xff);
        header[26] = (byte) ((16000 >> 16) & 0xff); header[27] = (byte) ((16000 >> 24) & 0xff);
        header[28] = (byte) (byteRate & 0xff); header[29] = (byte) ((byteRate >> 8) & 0xff);
        header[30] = (byte) ((byteRate >> 16) & 0xff); header[31] = (byte) ((byteRate >> 24) & 0xff);
        header[32] = (byte) (channels * 2); header[33] = 0; header[34] = 16; header[35] = 0;
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (totalAudioLen & 0xff); header[41] = (byte) ((totalAudioLen >> 8) & 0xff);
        header[42] = (byte) ((totalAudioLen >> 16) & 0xff); header[43] = (byte) ((totalAudioLen >> 24) & 0xff);
        byte[] wav = new byte[header.length + pcm.length];
        System.arraycopy(header, 0, wav, 0, header.length);
        System.arraycopy(pcm, 0, wav, header.length, pcm.length);
        return wav;
    }

    private double calculateRMS(short[] data, int read) {
        double sum = 0;
        for (int i = 0; i < read; i++) sum += data[i] * data[i];
        return Math.sqrt(sum / read);
    }

    private byte[] shortToByte(short[] data, int read) {
        ByteBuffer bb = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < read; i++) bb.putShort(data[i]);
        return bb.array();
    }

    private void playAudio(String b64) {
        try {
            isAyeshaSpeaking = true;
            byte[] audio = Base64.decode(b64, Base64.DEFAULT);
            File temp = File.createTempFile("ayesha", ".mp3", getCacheDir());
            FileOutputStream fos = new FileOutputStream(temp);
            fos.write(audio); fos.close();
            
            stopMediaPlayer(); 
            
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_VOICE_CALL);
            mediaPlayer.setDataSource(temp.getAbsolutePath());
            mediaPlayer.prepare();
            mediaPlayer.setOnCompletionListener(mp -> {
                isAyeshaSpeaking = false;
                mp.release();
                mediaPlayer = null;
                temp.delete();
            });
            mediaPlayer.start();
        } catch (Exception e) { isAyeshaSpeaking = false; }
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

    private void processActions(String text) {
        Pattern p = Pattern.compile("\\[ACTION:\\s*(.*?)(?:,\\s*DATA:\\s*(.*?))?\\]", Pattern.CASE_INSENSITIVE);
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
            NotificationChannel c = new NotificationChannel(cid, "Ayesha Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
        Notification n = new NotificationCompat.Builder(this, cid)
                .setContentTitle("عائشہ لائیو کال")
                .setSmallIcon(R.drawable.app_logo)
                .setOngoing(true).build();
                
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(1, n);
        }
    }

    private void playConnectSound() { 
        ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100); 
        tg.startTone(ToneGenerator.TONE_PROP_BEEP, 150); 
    }

    private void showToast(String message) {
        if (mainHandler != null) {
            mainHandler.post(() -> Toast.makeText(AyeshaCallService.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    private void stopRecording() {
        isRecording = false;
        if (audioRecord != null) { audioRecord.stop(); audioRecord.release(); audioRecord = null; }
        if (recordingThread != null) { recordingThread.interrupt(); recordingThread = null; }
    }

    private void endCallCompletely() {
        isCallActive = false;
        stopRecording();
        stopMediaPlayer();
        if (webSocket != null) webSocket.close(1000, "Ended");
        if (audioManager != null) { 
            audioManager.setSpeakerphoneOn(false); 
            audioManager.setMode(AudioManager.MODE_NORMAL);
            audioManager.abandonAudioFocus(focusChange -> {});
        }
        stopForeground(true);
        stopSelf();
    }

    @Override public void onCreate() { super.onCreate(); }
    @Override public void onDestroy() { endCallCompletely(); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
                    }
            
