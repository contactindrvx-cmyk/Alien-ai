package com.raza.alienai;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
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

    // 🌟 جاوا سکرپٹ سے آنے والے آرڈرز کو سننے والا ایجنٹ 🌟
    private BroadcastReceiver videoControlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (mediaPlayer == null) return;
            if ("com.raza.alienai.PLAY_VIDEO".equals(intent.getAction())) {
                if (!mediaPlayer.isPlaying()) mediaPlayer.start();
            } else if ("com.raza.alienai.PAUSE_VIDEO".equals(intent.getAction())) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(100); // کالے فریم سے بچنے کے لیے
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Broadcast Receiver رجسٹر کرو
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
        params.x = 0; params.y = 100;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        windowManager.addView(bubbleView, params);

        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false); // 💡 کالے بیک گراؤنڈ کو ختم کرنے کی ٹرک

        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                mediaPlayer = new MediaPlayer();
                try {
                    SharedPreferences prefs = getSharedPreferences("AyeshaPrefs", MODE_PRIVATE);
                    String agent = prefs.getString("selectedAgent", "ayesha");
                    String videoFile = agent + "_video.mp4";

                    AssetFileDescriptor afd;
                    try {
                        afd = getAssets().openFd(videoFile);
                    } catch (Exception e) {
                        afd = getAssets().openFd("ayesha_video.mp4");
                    }

                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    mediaPlayer.setSurface(new Surface(surface));
                    mediaPlayer.setLooping(true);
                    
                    // 💡 کالا سکرین فکس: Async طریقہ استعمال کریں
                    mediaPlayer.setOnPreparedListener(mp -> {
                        mp.seekTo(100); 
                        // یہاں ویڈیو سٹارٹ نہیں کرنی، وہ جاوا سکرپٹ خود کروائے گی
                    });
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

        bubbleView.findViewById(R.id.floating_bubble).setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x; initialY = params.y;
                        initialTouchX = event.getRawX(); initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(bubbleView, params);
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (Math.abs(event.getRawX() - initialTouchX) < 10) {
                            Intent i = new Intent(FloatingBubbleService.this, MainActivity.class);
                            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(i);
                        }
                        return true;
                }
                return false;
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterReceiver(videoControlReceiver);
        if (mediaPlayer != null) mediaPlayer.release();
        if (bubbleView != null) windowManager.removeView(bubbleView);
    }
}
