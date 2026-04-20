// گلوبل ویری ایبلز اور اوریجنل آئیکنز
window.AyeshaAudio = {
    audioObj: null, queue: [], lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null
};

window.isAyeshaRecording = false; // وائس ٹائپنگ کے لیے
let isCallActive = false; // لائیو کال کے لیے
let isCallMuted = false;

// عائشہ کو خاموش کرنا
window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon;
        b.classList.remove('playing-audio');
    });
    window.AyeshaAudio.currentBtn = null;
    if(window.AndroidBridge && window.AndroidBridge.stopBubbleVideo) window.AndroidBridge.stopBubbleVideo();
};

// ٹاپ نوٹیفکیشن (Voice chat ended)
function showToast(message) {
    const toast = document.getElementById('top-toast');
    document.getElementById('toast-text').innerText = message;
    toast.classList.remove('opacity-0', '-translate-y-10', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-10', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

// ہارڈویئر کمانڈز (ٹارچ، وائبریٹ، یوٹیوب)
function executeHardwareCommandLocally(text) {
    let cmd = text.toLowerCase();
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) { if (navigator.vibrate) navigator.vibrate([300, 100, 400]); }
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) window.open("https://www.youtube.com", '_blank');
}

// کلاؤڈ پلے بیک لاجک
function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) {
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('playing-audio');
        return;
    }
    let textChunk = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btnElement) {
    if (window.AyeshaAudio.currentBtn === btnElement && window.AyeshaAudio.audioObj) {
        if (!window.AyeshaAudio.audioObj.paused) {
            window.AyeshaAudio.audioObj.pause();
            btnElement.innerHTML = window.AyeshaAudio.playIcon;
            btnElement.classList.remove('playing-audio');
        } else {
            window.AyeshaAudio.audioObj.play();
            btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
            btnElement.classList.add('playing-audio');
        }
        return;
    }
    window.stopAyeshaCompletely();
    window.AyeshaAudio.currentBtn = btnElement;
    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(cleanText) ? 'ur' : 'en';
    let safeParts = cleanText.match(/.{1,150}(\s|$)|.{1,150}/g) || [cleanText];
    window.AyeshaAudio.queue = safeParts.filter(p => p.trim().length > 0);
    btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
    btnElement.classList.add('playing-audio');
    playCloudQueue(btnElement);
};

// =========================================================================
// مین UI لاجک (اوریجنل اینیمیشنز بحال)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const fileInput = document.getElementById('hidden-file-input');
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const startCallBtn = document.getElementById('start-call-btn');
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon'); // اوریجنل سٹاپ بٹن واپس بحال
    
    // Call UI Elements (الگ الگ بٹنز)
    const callPlusBtn = document.getElementById('call-plus-btn');
    const muteCallBtn = document.getElementById('mute-call-btn');
    const callEndPill = document.getElementById('call-end-pill');
    const endCallBtn = document.getElementById('end-call-btn');
    const callStatusSpan = callEndPill.querySelector('span');
    const unmutedIcon = document.getElementById('unmuted-icon-call');
    const mutedIcon = document.getElementById('muted-icon-call');

    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const removeImgBtn = document.getElementById('remove-img-btn');
    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');

    let pendingImageFile = null; 

    // 🚀 اوریجنل UI اینیمیشن (ٹیکسٹ لکھنے پر پلس بٹن غائب) بحال 🚀
    function updateUI() {
        if(isCallActive) return; // اگر کال چل رہی ہے تو نارمل UI مت چھیڑو

        const hasText = input.value.trim().length > 0;
        
        if (isActiveInputField()) {
            // پلس بٹن کو باہر کی طرف موو (Move) کرو (اوریجنل لاجک)
            plusBtn.style.opacity = '0'; plusBtn.style.pointerEvents = 'none'; plusBtn.style.transform = 'translateX(-20px)';
            inputPill.style.paddingLeft = '10px'; inputPill.classList.add('gemini-glow');
            startCallBtn.classList.add('hidden'); // کال بٹن غائب
        } else {
            // پلس بٹن واپس اندر آئے گا
            plusBtn.style.opacity = '1'; plusBtn.style.pointerEvents = 'auto'; plusBtn.style.transform = 'translateX(0)';
            inputPill.style.paddingLeft = '56px'; inputPill.classList.remove('gemini-glow');
            startCallBtn.classList.remove('hidden'); // کال بٹن واپس
        }
        
        if (hasText) {
            sendActionBtn.classList.remove('hidden'); micActionBtn.classList.add('hidden');
        } else {
            sendActionBtn.classList.add('hidden'); micActionBtn.classList.remove('hidden');
        }
    }

    function isActiveInputField() {
        return (document.activeElement === input) || (input.value.trim().length > 0) || window.isAyeshaRecording;
    }

    input.addEventListener('input', updateUI);
    input.addEventListener('focus', updateUI);
    input.addEventListener('blur', updateUI);

    // پلس بٹن (فائل سلیکٹر)
    const handlePlusClick = () => fileInput.click();
    plusBtn.onclick = handlePlusClick;
    callPlusBtn.onclick = handlePlusClick; 

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewContainer.classList.remove('hidden'); // 🚀 پریویو کنٹینر اب شو ہوگا (Fixed) 🚀
                updateUI(); 
            };
            reader.readAsDataURL(file);
        }
    };

    removeImgBtn.onclick = () => {
        pendingImageFile = null; previewImg.src = "";
        previewContainer.classList.add('hidden'); fileInput.value = ""; updateUI();
    };

    // میسج ایڈ کرنا
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        let cleanText = text ? `<p dir="auto" style="white-space: pre-wrap;">${text}</p>` : '';
        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${cleanText}</div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative';
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${cleanText}<button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button></div>`;
        }
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // میسج بھیجنا
    sendActionBtn.onclick = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text || pendingImageFile) {
            executeHardwareCommandLocally(text);
            addMessage(text, 'user');
            
            // Hugging Face ریکویسٹ
            thinkingIndicator.classList.remove('hidden'); thinkingIndicator.classList.add('flex');
            const payload = { message: text, email: "alirazasabir007@gmail.com" };
            
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then(res => res.json()).then(data => {
                thinkingIndicator.classList.add('hidden'); thinkingIndicator.classList.remove('flex');
                const reply = data.response || "میں سمجھ نہیں سکی۔";
                addMessage(reply, 'assistant');
                setTimeout(() => {
                    const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                    if(allBtns.length > 0) window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
                }, 300);
            }).catch(e => {
                thinkingIndicator.classList.add('hidden'); thinkingIndicator.classList.remove('flex');
                addMessage("سرور آف لائن ہے۔", 'assistant');
            });

            input.value = ''; pendingImageFile = null;
            previewContainer.classList.add('hidden');
            updateUI(); 
        }
    };

    // =========================================================================
    // 🎤 سپیچ ریکگنیشن (اوریجنل سٹاپ بٹن بحال)
    // =========================================================================
    let recognition;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; recognition.interimResults = false;
        recognition.lang = 'ur-PK'; 

        recognition.onstart = () => {
            window.stopAyeshaCompletely();
            window.isAyeshaRecording = true;
            input.value = ''; updateUI();
            micIcon.classList.add('hidden'); stopIcon.classList.remove('hidden'); // 🚀 سٹاپ بٹن واپس لایا گیا ہے (Fixed) 🚀
            input.placeholder = "سن رہی ہوں...";
        };

        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            input.value = transcript;
            setTimeout(() => { if(input.value.trim().length > 0) sendActionBtn.click(); }, 300); // بات ختم ہوتے ہی خودکار بھیجو
        };

        recognition.onend = () => {
            window.isAyeshaRecording = false;
            stopIcon.classList.add('hidden'); micIcon.classList.remove('hidden'); // 🚀 واپس مائیک لایا گیا ہے 🚀
            input.placeholder = "Ask something...";
            updateUI();
        };

        recognition.onerror = () => { stopRecording(); };
    }

    function stopRecording() { if (recognition) recognition.stop(); }

    micActionBtn.onclick = () => {
        if (window.isAyeshaRecording) recognition.stop();
        else { window.stopAyeshaCompletely(); recognition.start(); }
    };

    // =========================================================================
    // 🚀 کال اینیمیشن اور لاجک (Pill سے "پاپ آؤٹ" بحال) 🚀
    // ==========================================
    startCallBtn.onclick = (e) => {
        e.preventDefault();
        isCallActive = true;
        isCallMuted = false;

        // جاوا کو کال سٹارٹ کا سگنل
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);

        // نارمل UI کو ہائیڈ کرو
        inputPill.style.transition = 'all 0.4s ease';
        inputPill.style.opacity = '0'; inputPill.style.transform = 'scale(0.8)'; inputPill.style.pointerEvents = 'none';
        plusBtn.style.opacity = '0'; plusBtn.style.pointerEvents = 'none';

        // کالنگ کے 3 بٹنز کو سموتھلی "پاپ آؤٹ" (Pop-out) کرو
        // 🚀 کال پلس بٹن 🚀
        callPlusBtn.style.left = '0%'; callPlusBtn.classList.add('active');
        
        // 🚀 کال میوٹ بٹن 🚀
        muteCallBtn.style.left = 'calc(0% + 64px)'; muteCallBtn.classList.add('active');

        // 🚀 کال اینڈ پیل (لمبا ڈبہ) 🚀
        callEndPill.style.left = 'calc(0% + 128px)'; callEndPill.style.right = '0%';
        callEndPill.classList.remove('scale-50', 'opacity-0');
        callEndPill.classList.add('scale-100', 'opacity-100', 'active', 'pointer-events-auto');
        
        unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
        callStatusSpan.innerText = "Connecting...";

        setTimeout(() => { if(isCallActive) callStatusSpan.innerText = "Listening..."; }, 2500);
    };

    // 🚀 کال اینڈ کرنے کی اینیمیشن 🚀
    endCallBtn.onclick = () => {
        isCallActive = false;

        // کال UI ہائیڈ کرو (واپس پاپ ان کرو)
        callPlusBtn.classList.remove('active');
        muteCallBtn.classList.remove('active');
        callEndPill.classList.add('scale-50', 'opacity-0');
        callEndPill.classList.remove('scale-100', 'opacity-100', 'active', 'pointer-events-auto');

        // نارمل چیٹ UI واپس لاؤ
        setTimeout(() => {
            inputPill.style.opacity = '1'; inputPill.style.transform = 'scale(1)'; inputPill.style.pointerEvents = 'auto';
            plusBtn.style.opacity = '1'; plusBtn.style.pointerEvents = 'auto';
            updateUI();
        }, 300);

        showToast("Voice chat ended");
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false);
    };

    // کال کے دوران میوٹ کنٹرول
    muteCallBtn.onclick = () => {
        isCallMuted = !isCallMuted;
        if(isCallMuted) {
            unmutedIcon.classList.add('hidden'); mutedIcon.classList.remove('hidden');
            muteCallBtn.classList.add('bg-red-500/20', 'text-red-500');
        } else {
            unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
            muteCallBtn.classList.remove('bg-red-500/20', 'text-red-500');
        }
        if (window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted);
    };

    // سائیڈ بار کنٹرول
    document.getElementById('menu-btn').onclick = () => { 
        document.getElementById('sidebar').classList.remove('-translate-x-full'); 
        document.getElementById('sidebar-overlay').classList.remove('hidden'); 
    };
    document.getElementById('sidebar-overlay').onclick = () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    };
});
            
