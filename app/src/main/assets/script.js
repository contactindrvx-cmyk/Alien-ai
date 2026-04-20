// =========================================================================
// 1. آڈیو انجن، ہارڈویئر کمانڈز اور گلوبل ویری ایبلز
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    queue: [],
    lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null,
    torchStream: null
};

window.isAyeshaRecording = false;
let isCallActive = false;
let isCallMuted = false;

// عائشہ کی آواز اور ویڈیو مکمل بند کرنا
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

// 🔦 ہارڈویئر کمانڈ: ٹارچ کنٹرول
async function toggleTorch(state) {
    try {
        if (state) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const track = stream.getVideoTracks()[0];
            await track.applyConstraints({ advanced: [{ torch: true }] });
            window.AyeshaAudio.torchStream = stream;
        } else {
            if (window.AyeshaAudio.torchStream) {
                const track = window.AyeshaAudio.torchStream.getVideoTracks()[0];
                await track.applyConstraints({ advanced: [{ torch: false }] });
                window.AyeshaAudio.torchStream.getTracks().forEach(t => t.stop());
            }
        }
    } catch (e) { console.log("Torch not supported on this device."); }
}

// 🛠️ مقامی کمانڈز ایگزیکیوٹ کرنا (ٹارچ، وائبریٹ، ایپس)
function executeHardwareCommandLocally(text) {
    let cmd = text.toLowerCase();
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) {
        if (navigator.vibrate) navigator.vibrate([300, 100, 400]); 
    }
    if (cmd.includes("ٹارچ آن") || cmd.includes("لائٹ جلاؤ") || cmd.includes("torch on")) toggleTorch(true);
    if (cmd.includes("ٹارچ آف") || cmd.includes("لائٹ بند") || cmd.includes("torch off")) toggleTorch(false);
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) window.open("https://www.youtube.com", '_blank');
    if (cmd.includes("پلے سٹور") || cmd.includes("play store")) window.open("https://play.google.com", '_blank');
    if (cmd.includes("سرچ") || cmd.includes("search")) {
        let query = text.split("سرچ")[1] || text.split("search")[1];
        if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
    }
}

// =========================================================================
// 2. ٹیکسٹ ٹو سپیچ (TTS) پلے بیک لاجک
// =========================================================================
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
// 3. مین UI اور انٹرایکشن لاجک
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const fileInput = document.getElementById('hidden-file-input');
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const callActionBtn = document.getElementById('call-action-btn'); 
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const removeImgBtn = document.getElementById('remove-img-btn');
    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');
    
    // Call UI Elements
    const callOverlay = document.getElementById('call-overlay');
    const callStatusText = document.getElementById('call-status-text');
    const callEndBtn = document.getElementById('call-end-btn');
    const callMuteBtn = document.getElementById('call-mute-btn');
    const unmutedIcon = document.getElementById('unmuted-icon');
    const mutedIcon = document.getElementById('muted-icon');

    let pendingImageFile = null; 

    function updateUI() {
        const hasText = input.value.trim().length > 0;
        const isActive = (document.activeElement === input) || hasText || window.isAyeshaRecording;
        
        if (isActive) {
            plusBtn.classList.add('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "64px"; inputPill.style.paddingLeft = "10px";
        } else {
            plusBtn.classList.remove('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "0px"; inputPill.style.paddingLeft = "56px";
        }
        
        if (window.isAyeshaRecording) {
            micIcon.classList.add('hidden'); stopIcon.classList.remove('hidden');
            micActionBtn.classList.add('recording-pulse');
            callActionBtn.classList.add('hidden', 'scale-0');
        } else {
            stopIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
            micActionBtn.classList.remove('recording-pulse');
            if (hasText) {
                sendActionBtn.classList.remove('hidden'); 
                micActionBtn.classList.add('hidden');
                callActionBtn.classList.add('hidden');
            } else {
                sendActionBtn.classList.add('hidden'); 
                micActionBtn.classList.remove('hidden');
                callActionBtn.classList.remove('hidden', 'scale-0');
            }
        }
    }

    input.addEventListener('input', updateUI);
    plusBtn.onclick = () => fileInput.click(); 

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewContainer.classList.remove('hidden');
                updateUI(); 
            };
            reader.readAsDataURL(file);
        }
    };

    removeImgBtn.onclick = () => {
        pendingImageFile = null; previewImg.src = "";
        previewContainer.classList.add('hidden'); fileInput.value = ""; updateUI();
    };

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7]">` : '';
        let cleanText = text ? `<p dir="auto" style="white-space: pre-wrap;">${text}</p>` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${imgHtml}${cleanText}</div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative';
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${imgHtml}${cleanText}<button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button></div>`;
        }
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function sendToHuggingFace(text, file) {
        thinkingIndicator.classList.remove('hidden'); thinkingIndicator.classList.add('flex');
        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = { message: text || "", email: "alirazasabir007@gmail.com", local_time: new Date().toLocaleTimeString() };
        
        try {
            if (file) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                payload.image = await new Promise(res => { reader.onload = () => res(reader.result); });
            }
            
            const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();
            thinkingIndicator.classList.add('hidden');
            
            const replyText = data.response || "معاف کیجیے، میں سمجھ نہیں سکی۔";
            addMessage(replyText, 'assistant');
            
            // خودکار طور پر آواز پلے کریں
            setTimeout(() => {
                const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                if(allBtns.length > 0) window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
            }, 300);
            
        } catch (err) {
            thinkingIndicator.classList.add('hidden');
            addMessage("سرور آف لائن ہے۔", 'assistant');
        }
    }

    // =========================================================================
    // 🎤 سپیچ ریکگنیشن (Speech Recognition)
    // =========================================================================
    let recognition;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = true;
        recognition.lang = 'ur-PK'; 

        recognition.onstart = () => {
            window.stopAyeshaCompletely();
            window.isAyeshaRecording = true;
            input.value = ''; updateUI();
            input.placeholder = "سن رہی ہوں...";
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            input.value = transcript;
        };

        recognition.onend = () => {
            window.isAyeshaRecording = false;
            input.placeholder = "Ask something...";
            updateUI();
            if (input.value.trim().length > 0) sendActionBtn.click();
        };
    }

    micActionBtn.onclick = () => {
        if (window.isAyeshaRecording) recognition.stop();
        else recognition.start();
    };

    sendActionBtn.onclick = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        const imageSrc = pendingImageFile ? previewImg.src : null;
        if (text || pendingImageFile) {
            executeHardwareCommandLocally(text);
            addMessage(text, 'user', imageSrc);
            sendToHuggingFace(text, pendingImageFile);
            input.value = ''; pendingImageFile = null;
            previewContainer.classList.add('hidden');
            updateUI();
        }
    };

    // =========================================================================
    // 🚀 کال سکرین لاجک (ChatGPT Call Style)
    // =========================================================================
    callActionBtn.onclick = (e) => {
        e.preventDefault();
        isCallActive = true;
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);

        callOverlay.classList.remove('hidden');
        callOverlay.classList.add('flex');
        callStatusText.innerText = "Connecting...";
        
        unmutedIcon.classList.remove('hidden');
        mutedIcon.classList.add('hidden');

        setTimeout(() => { if(isCallActive) callStatusText.innerText = "Start talking"; }, 2000);
    };

    callEndBtn.onclick = () => {
        isCallActive = false;
        callOverlay.classList.add('hidden');
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false);
    };

    callMuteBtn.onclick = () => {
        isCallMuted = !isCallMuted;
        if(isCallMuted) {
            unmutedIcon.classList.add('hidden'); mutedIcon.classList.remove('hidden');
            callMuteBtn.classList.add('bg-[#3a8ff7]/20', 'text-[#3a8ff7]');
        } else {
            unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
            callMuteBtn.classList.remove('bg-[#3a8ff7]/20', 'text-[#3a8ff7]');
        }
        if (window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted);
    };

    document.getElementById('menu-btn').onclick = () => { 
        document.getElementById('sidebar').classList.toggle('-translate-x-full'); 
        document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
    };
    
    document.getElementById('sidebar-overlay').onclick = () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    };
});
                              
