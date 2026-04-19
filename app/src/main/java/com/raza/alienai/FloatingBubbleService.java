package com.raza.alienai;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.AssetFileDescriptor;
import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;

public class FloatingBubbleService extends Service {

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams params;
    private MediaPlayer mediaPlayer;

    private BroadcastReceiver videoControlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (mediaPlayer == null) return;
            if ("com.raza.alienai.PLAY_VIDEO".equals(intent.getAction())) {
                if (!mediaPlayer.isPlaying()) mediaPlayer.start();
            } else if ("com.raza.alienai.PAUSE_VIDEO".equals(intent.getAction())) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(0); // سٹارٹ سے سیٹ کر دیا
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raza.alienai.PLAY_VIDEO");
        filter.addAction("com.raza.alienai.PAUSE_VIDEO");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(videoControlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(videoControlReceiver, filter);
        }

        bubbleView = LayoutInflater.from(this).inflate(R.layout.bubble_layout, null);
        int layoutFlag = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? 
                         WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : 
                         WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        windowManager.addView(bubbleView, params);

        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false);

        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                mediaPlayer = new MediaPlayer();
                try {
                    // 💡 صرف ayesha_video.mp4 کو ہی لوڈ کرے گا
                    AssetFileDescriptor afd = getAssets().openFd("ayesha_video.mp4");
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    mediaPlayer.setSurface(new Surface(surface));
                    mediaPlayer.setLooping(true);
                    mediaPlayer.prepareAsync();
                } catch (Exception e) { e.printStackTrace(); }
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) {
                if (mediaPlayer != null) { mediaPlayer.release(); mediaPlayer = null; }
                return true;
            }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterReceiver(videoControlReceiver);
        if (mediaPlayer != null) { mediaPlayer.release(); }
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
}
