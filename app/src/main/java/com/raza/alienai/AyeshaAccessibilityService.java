package com.raza.alienai;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;

public class AyeshaAccessibilityService extends AccessibilityService {

    private String currentAction = "";
    private String actionData = "";

    // 🌟 سگنل ریسیور (یہاں دماغ سے آرڈر موصول ہوگا) 🌟
    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            currentAction = intent.getStringExtra("action");
            actionData = intent.getStringExtra("data"); 

            if ("OPEN_YOUTUBE".equals(currentAction)) {
                Toast.makeText(context, "عائشہ یوٹیوب کھول رہی ہے...", Toast.LENGTH_SHORT).show();
                
                try {
                    // 🚀 نیا اور سمارٹ طریقہ: ڈائریکٹ ڈیپ لنک کے ذریعے یوٹیوب سرچ کھولنا 🚀
                    Intent intentYt = new Intent(Intent.ACTION_VIEW);
                    
                    // اگر آپ نے کوئی گانا بولا ہے (مثلاً "DATA:دل دل پاکستان")، تو ڈائریکٹ وہی سرچ کر کے کھول دو!
                    if (actionData != null && !actionData.trim().isEmpty() && !actionData.equals("none")) {
                        intentYt.setData(Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(actionData)));
                    } else {
                        // اگر صرف "یوٹیوب کھولو" بولا ہے تو مین پیج کھلے گا
                        intentYt.setData(Uri.parse("https://www.youtube.com/"));
                    }
                    
                    intentYt.setPackage("com.google.android.youtube");
                    intentYt.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intentYt);
                    
                    // چونکہ ہم نے ڈائریکٹ سرچ کر لیا ہے، تو کام مکمل ہو گیا
                    currentAction = "";
                    
                } catch (Exception e) {
                    // اگر موبائل میں یوٹیوب انسٹال ہی نہیں ہے
                    Toast.makeText(context, "معذرت، موبائل میں یوٹیوب ایپ نہیں مل رہی!", Toast.LENGTH_SHORT).show();
                    currentAction = "";
                }
            }
        }
    };

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // یوٹیوب کے لیے اب ہمیں مینوئل کلک کرنے کی ضرورت نہیں، ڈیپ لنک نے ہمارا کام آسان کر دیا ہے۔
        // مستقبل میں واٹس ایپ کے لیے ہم یہاں لاجک لکھیں گے۔
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(commandReceiver, new IntentFilter("AI_COMMAND_BROADCAST"));
        }
        Toast.makeText(this, "عائشہ کے ہاتھ ایکٹو ہو گئے ہیں! 🦾", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(commandReceiver); } catch (Exception e) {}
    }
}
