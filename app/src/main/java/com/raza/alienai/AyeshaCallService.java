package com.raza.alienai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.util.Locale;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class AyeshaCallService extends Service implements TextToSpeech.OnInitListener {
    private static final int SAMPLE_RATE = 16000;
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private WebSocket webSocket;
    private TextToSpeech tts;
    private boolean isMutedByUser = false;
    private boolean isAyeshaSpeaking = false;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (intent != null && intent.hasExtra("isMuted")) isMutedByUser = intent.getBooleanExtra("isMuted", false);
        startCallForeground(); connectWebSocket(); startAudioStreaming();
        return START_STICKY;
    }

    private void startCallForeground() {
        String cid = "AyeshaCall";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(cid, "Call", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
        Notification n = new NotificationCompat.Builder(this, cid)
                .setContentTitle("Ayesha AI Call").setSmallIcon(R.drawable.app_logo).setOngoing(true).build();
        startForeground(1, n);
    }

    private void startAudioStreaming() {
        int bs = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bs);
        audioRecord.startRecording(); isRecording = true;
        new Thread(() -> {
            byte[] buf = new byte[bs]; ByteArrayOutputStream baos = new ByteArrayOutputStream();
            int silence = 0; boolean speaking = false;
            while (isRecording) {
                if (isAyeshaSpeaking || isMutedByUser) continue;
                int r = audioRecord.read(buf, 0, buf.length);
                if (r > 0) {
                    double rms = 0; for (int i=0; i<r; i+=2) { short s = (short)((buf[i+1]<<8)|(buf[i]&0xff)); rms += s*s; }
                    rms = Math.sqrt(rms/(r/2.0));
                    if (rms > 600) { speaking = true; silence = 0; baos.write(buf, 0, r); }
                    else if (speaking) { silence++; baos.write(buf, 0, r); if (silence > 20) { speaking = false; sendToAi(baos.toByteArray()); baos.reset(); } }
                }
            }
        }).start();
    }

    private void sendToAi(byte[] pcm) {
        if (pcm.length < 5000) return;
        String b64 = Base64.encodeToString(addWavHeader(pcm), Base64.NO_WRAP);
        if (webSocket != null) { try { JSONObject j = new JSONObject(); j.put("audio", b64); j.put("email", "alirazasabir007@gmail.com"); webSocket.send(j.toString()); } catch (Exception e) {} }
    }

    private byte[] addWavHeader(byte[] pcm) {
        byte[] h = new byte[44]; int len = pcm.length; int total = len + 36;
        h[0]='R'; h[1]='I'; h[2]='F'; h[3]='F'; h[4]=(byte)(total&0xff); h[5]=(byte)((total>>8)&0xff); h[6]=(byte)((total>>16)&0xff); h[7]=(byte)((total>>24)&0xff);
        h[8]='W'; h[9]='A'; h[10]='V'; h[11]='E'; h[12]='f'; h[13]='m'; h[14]='t'; h[15]=' '; h[16]=16; h[20]=1; h[22]=1;
        h[24]=(byte)(SAMPLE_RATE&0xff); h[25]=(byte)((SAMPLE_RATE>>8)&0xff); h[28]=(byte)(32000&0xff); h[29]=(byte)((32000>>8)&0xff); h[32]=2; h[34]=16; h[36]='d'; h[37]='a'; h[38]='t'; h[39]='a';
        h[40]=(byte)(len&0xff); h[41]=(byte)((len>>8)&0xff); byte[] wav = new byte[44+len]; System.arraycopy(h,0,wav,0,44); System.arraycopy(pcm,0,wav,44,len); return wav;
    }

    private void connectWebSocket() {
        Request r = new Request.Builder().url("wss://aigrowthbox-ayesha-ai.hf.space/ws/live").build();
        webSocket = new OkHttpClient().newWebSocket(r, new WebSocketListener() {
            @Override public void onMessage(WebSocket ws, String t) { try { String reply = new JSONObject(t).getString("response"); mainHandler.post(() -> speak(reply)); } catch (Exception e) {} }
        });
    }

    @Override public void onInit(int s) { if (s == TextToSpeech.SUCCESS) tts.setLanguage(new Locale("ur", "PK")); }
    private void speak(String t) { if (tts != null) { tts.speak(t, TextToSpeech.QUEUE_FLUSH, null, "AyeshaCall"); isAyeshaSpeaking = true; new Handler().postDelayed(() -> isAyeshaSpeaking=false, t.length()*100); } }
    @Override public void onDestroy() { isRecording = false; if (audioRecord != null) audioRecord.release(); if (tts != null) tts.shutdown(); }
    @Override public IBinder onBind(Intent i) { return null; }
                                                    }
