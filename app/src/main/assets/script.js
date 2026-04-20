window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; 
let isCallMuted = false; 
window.isAyeshaRecording = false;

// UI Elements
let input, outPlus, outMute, mainPill, inPlus, waveArea, inSend, inMic, inCall, inEnd;
let iMicNormal, iMicStop, iUnmuted, iMuted, iCallSend;
let fileIn, preview, pendingImg = null, voiceTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // Elements کو متغیرات میں محفوظ کریں
    input = document.getElementById('user-input'); 
    outPlus = document.getElementById('out-plus'); 
    outMute = document.getElementById('out-mute');
    mainPill = document.getElementById('main-pill');
    inPlus = document.getElementById('in-plus'); 
    waveArea = document.getElementById('wave-area');
    inSend = document.getElementById('in-send'); 
    inMic = document.getElementById('in-mic');
    inCall = document.getElementById('in-call'); 
    inEnd = document.getElementById('in-end');
    
    iMicNormal = document.getElementById('icon-mic-normal'); 
    iMicStop = document.getElementById('icon-mic-stop');
    iUnmuted = document.getElementById('icon-unmuted'); 
    iMuted = document.getElementById('icon-muted');
    iCallSend = document.getElementById('icon-call-send');
    
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    // 🌟 جادوئی سٹیٹ مینیجر: آپ کے بتائے ہوئے ڈیزائن کے مطابق 🌟
    function updateUIState() {
        // پہلے سب کچھ ری سیٹ کریں (Hide All)
        outPlus.classList.add('btn-collapse'); outMute.classList.add('btn-collapse');
        inPlus.classList.add('btn-collapse'); inSend.classList.add('btn-collapse');
        inMic.classList.add('btn-collapse'); inCall.classList.add('btn-collapse');
        waveArea.classList.add('btn-collapse'); inEnd.classList.add('btn-collapse');
        mainPill.classList.remove('gemini-glow'); input.classList.remove('btn-collapse');

        if (isCallActive) {
            // 4. لائیو کال سٹیٹ
            outPlus.classList.remove('btn-collapse'); // پلس باہر
            outPlus.classList.add('btn-expand');
            outMute.classList.remove('btn-collapse'); // میوٹ باہر
            outMute.classList.add('btn-expand');
            input.classList.add('btn-collapse'); // ٹیکسٹ ہائیڈ
            waveArea.classList.remove('btn-collapse'); // لہریں شو
            inEnd.classList.remove('btn-collapse'); // اینڈ بٹن شو
            inEnd.classList.add('btn-expand-auto');

            if (pendingImg) {
                // اگر کال میں تصویر اپلوڈ کی ہے تو میوٹ بٹن جہاز بن جائے گا
                iCallSend.classList.remove('hidden'); iUnmuted.classList.add('hidden'); iMuted.classList.add('hidden');
                outMute.classList.remove('bg-red-500/20');
            } else {
                iCallSend.classList.add('hidden');
                iUnmuted.classList.toggle('hidden', isCallMuted); iMuted.classList.toggle('hidden', !isCallMuted);
                outMute.classList.toggle('bg-red-500/20', isCallMuted);
            }
        } 
        else if (window.isAyeshaRecording) {
            // 2. مائیک ریکارڈنگ سٹیٹ
            outPlus.classList.remove('btn-collapse'); // پلس باہر
            outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inMic.classList.remove('btn-collapse'); // مائیک (سٹاپ بٹن بن کر) اندر
            iMicNormal.classList.add('hidden'); iMicStop.classList.remove('hidden');
            inMic.classList.add('bg-red-500/20'); // سرخ رنگ
        } 
        else if (input.value.trim().length > 0 || pendingImg) {
            // 3. ٹائپنگ یا تصویر سلیکٹ سٹیٹ
            outPlus.classList.remove('btn-collapse'); // پلس باہر
            outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inSend.classList.remove('btn-collapse'); // سینڈ (جہاز) اندر
            inSend.classList.add('btn-expand');
        } 
        else {
            // 1. نارمل سٹیٹ (سب اندر)
            inPlus.classList.remove('btn-collapse');
            inMic.classList.remove('btn-collapse');
            inCall.classList.remove('btn-collapse');
            iMicNormal.classList.remove('hidden'); iMicStop.classList.add('hidden');
            inMic.classList.remove('bg-red-500/20');
        }
    }

    input.addEventListener('input', updateUIState);

    // پلس بٹن فنکشن (گیلری کھولنا)
    const handlePlusClick = (e) => {
        e.preventDefault();
        if(window.AndroidBridge && window.AndroidBridge.openGallery) { window.AndroidBridge.openGallery(); } 
        else { fileIn.click(); }
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick;

    // تصویر سلیکٹ ہونے پر
    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); updateUIState();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; updateUIState(); };

    // مائیکروفون اور آٹو سینڈ لاجک
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec; 
    if(SpeechRecognition) {
        rec = new SpeechRecognition(); 
        rec.lang='ur-PK';
        rec.continuous = false;
        
        rec.onstart = () => { window.isAyeshaRecording = true; input.placeholder='سن رہی ہوں...'; updateUIState(); };
        
        rec.onresult = (e) => { 
            input.value = e.results[0][0].transcript; 
            updateUIState();
            
            // آٹو سینڈ: بات مکمل ہونے کے بعد 2 سیکنڈ کا ڈیلے
            clearTimeout(voiceTimeout);
            voiceTimeout = setTimeout(() => {
                if(window.isAyeshaRecording) { rec.stop(); }
                inSend.click(); // آٹو سینڈ
            }, 2000); 
        };
        
        rec.onend = () => { window.isAyeshaRecording = false; input.placeholder='Ask something...'; updateUIState(); };
    }
    
    inMic.onclick = () => { 
        if(window.AndroidBridge && window.AndroidBridge.startVoiceRecognition) {
            window.AndroidBridge.startVoiceRecognition();
        } else if(rec) {
            if(window.isAyeshaRecording) { rec.stop(); clearTimeout(voiceTimeout); } else { rec.start(); }
        } else {
            showToast("وائس ٹائپنگ سپورٹ نہیں ہے۔");
        }
    };

    // لائیو کال کنٹرولز
    inCall.onclick = () => { isCallActive = true; isCallMuted = false; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); };
    inEnd.onclick = () => { isCallActive = false; updateUIState(); showToast("Voice chat ended"); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); };
    
    outMute.onclick = () => {
        if(pendingImg) { 
            // اگر تصویر ہے تو یہ بٹن سینڈ کا کام کرے گا
            inSend.click(); 
        } else { 
            // ورنہ میوٹ کا کام کرے گا
            isCallMuted = !isCallMuted; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted); 
        }
    };

    // میسج سینڈ کرنا
    inSend.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            // آپ کے اوریجنل کوڈ کے مطابق سینڈ لاجک
            addMessage(text || "تصویر بھیجی گئی", 'user');
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); updateUIState();
            
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) 
            })
            .then(res => res.json()).then(d => { 
                document.getElementById('thinking-indicator').classList.add('hidden'); 
                addMessage(d.response, 'assistant');
            }).catch(e => { document.getElementById('thinking-indicator').classList.add('hidden'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };
});

// Helper Function for messages (آپ کا اوریجنل لاجک)
function addMessage(text, sender) {
    const chatBox = document.getElementById('chat-box'); const msgDiv = document.createElement('div');
    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    } else {
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
                       }
