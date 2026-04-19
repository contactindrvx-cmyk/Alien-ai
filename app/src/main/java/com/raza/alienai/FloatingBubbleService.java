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

    // 🌟 عائشہ کے بولنے اور چپ ہونے پر ویڈیو کنٹرول کرنے والا ریسیور
    private BroadcastReceiver videoControlReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (mediaPlayer == null) return;
            if ("com.raza.alienai.PLAY_VIDEO".equals(intent.getAction())) {
                if (!mediaPlayer.isPlaying()) mediaPlayer.start();
            } else if ("com.raza.alienai.PAUSE_VIDEO".equals(intent.getAction())) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    // کالے پن سے بچنے کے لیے ویڈیو کو شروع کے تھوڑے سے حصے پر روک دیں
                    mediaPlayer.seekTo(100); 
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. ریسیور رجسٹر کریں (تاکہ جاوا سکرپٹ کے سگنل مل سکیں)
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raza.alienai.PLAY_VIDEO");
        filter.addAction("com.raza.alienai.PAUSE_VIDEO");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(videoControlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(videoControlReceiver, filter);
        }

        // 2. ببل کو سکرین پر دکھانے کی سیٹنگ
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
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

        // ببل کہاں نظر آئے گا (شروع میں)
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 50; 
        params.y = 200;

        windowManager.addView(bubbleView, params);

        // 3. ویڈیو کو لوڈ کرنے کا پرفیکٹ طریقہ (کالے پن کے بغیر)
        TextureView textureView = bubbleView.findViewById(R.id.bubbleVideoView);
        textureView.setOpaque(false); // یہ بہت ضروری تھا! اس سے ویڈیو کالی نہیں ہوگی

        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                mediaPlayer = new MediaPlayer();
                try {
                    // یہ سیدھا آپ کی ayesha_video.mp4 کو ہی اٹھائے گا
                    AssetFileDescriptor afd = getAssets().openFd("ayesha_video.mp4");
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    mediaPlayer.setSurface(new Surface(surface));
                    mediaPlayer.setLooping(true);
                    
                    mediaPlayer.setOnPreparedListener(mp -> {
                        // ویڈیو لوڈ ہوتے ہی اسے پہلے فریم پر لا کر دکھا دو (تاکہ کالا نہ رہے)
                        mp.seekTo(100); 
                    });
                    mediaPlayer.prepareAsync();
                    
                } catch (Exception e) { 
                    e.printStackTrace(); 
                }
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture s) {
                if (mediaPlayer != null) { mediaPlayer.release(); mediaPlayer = null; }
                return true;
            }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });

        // 4. 🚀 ببل کو ہر سمت موو کرنے کا 100% ٹیسٹڈ لاجک 🚀
        // آپ کی ایکس ایم ایل (XML) کے مطابق ہم floating_bubble (CardView) پر ٹچ لگا رہے ہیں
        View touchTarget = bubbleView.findViewById(R.id.floating_bubble);
        touchTarget.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isMoving = false; // کلک اور موو میں فرق کرنے کے لیے

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isMoving = false;
                        return true;
                        
                    case MotionEvent.ACTION_MOVE:
                        // ہلکی سی موومنٹ کو کلک سمجھنے سے روکنے کے لیے
                        if (Math.abs(event.getRawX() - initialTouchX) > 10 || Math.abs(event.getRawY() - initialTouchY) > 10) {
                            isMoving = true;
                            params.x = initialX + (int) (event.getRawX() - initialTouchX);
                            params.y = initialY + (int) (event.getRawY() - initialTouchY);
                            windowManager.updateViewLayout(bubbleView, params);
                        }
                        return true;
                        
                    case MotionEvent.ACTION_UP:
                        // اگر ببل کو موو نہیں کیا، تو اس کا مطلب ہے یوزر نے کلک کیا ہے (ایپ اوپن کرو)
                        if (!isMoving) {
                            Intent openAppIntent = new Intent(FloatingBubbleService.this, MainActivity.class);
                            openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(openAppIntent);
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
