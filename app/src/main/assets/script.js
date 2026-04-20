// =========================================================================
// 1. گلوبل ویری ایبلز اور آئیکنز
// =========================================================================
window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; 
let isCallMuted = false;
window.isAyeshaRecording = false;

const ICONS = {
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
};

// =========================================================================
// 2. فنکشنز
// =========================================================================
function showToast(msg) {
    const t = document.getElementById('top-toast'); document.getElementById('toast-text').innerText = msg;
    t.classList.remove('opacity-0', '-translate-y-10', 'pointer-events-none'); t.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => { t.classList.remove('opacity-100', 'translate-y-0'); t.classList.add('opacity-0', '-translate-y-10', 'pointer-events-none'); }, 3000);
}

function executeHardwareCommandLocally(text) {
    let cmd = text.toLowerCase();
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) { if (navigator.vibrate) navigator.vibrate([300, 100, 400]); }
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) window.open("https://www.youtube.com", '_blank');
}

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { b.innerHTML = ICONS.play; b.classList.remove('bg-[#3a8ff7]', 'text-white'); });
    if(window.AndroidBridge && window.AndroidBridge.stopBubbleVideo) window.AndroidBridge.stopBubbleVideo();
};

function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) { btnElement.innerHTML = ICONS.play; btnElement.classList.remove('bg-[#3a8ff7]', 'text-white'); return; }
    let textChunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btnElement) {
    if (window.AyeshaAudio.currentBtn === btnElement && window.AyeshaAudio.audioObj) {
        if (!window.AyeshaAudio.audioObj.paused) { window.AyeshaAudio.audioObj.pause(); btnElement.innerHTML = ICONS.play; btnElement.classList.remove('bg-[#3a8ff7]', 'text-white'); } 
        else { window.AyeshaAudio.audioObj.play(); btnElement.innerHTML = ICONS.pause; btnElement.classList.add('bg-[#3a8ff7]', 'text-white'); } return;
    }
    window.stopAyeshaCompletely(); window.AyeshaAudio.currentBtn = btnElement;
    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(rawText) ? 'ur' : 'en';
    window.AyeshaAudio.queue = rawText.match(/.{1,150}(\s|$)|.{1,150}/g).filter(p => p.trim().length > 0);
    btnElement.innerHTML = ICONS.pause; btnElement.classList.add('bg-[#3a8ff7]', 'text-white');
    playCloudQueue(btnElement);
};

// =========================================================================
// 3. مین UI اور اینیمیشن کنٹرولر
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input'); const mainPill = document.getElementById('main-pill');
    const pillPlus = document.getElementById('pill-plus'); const pillMic = document.getElementById('pill-mic');
    const pillCall = document.getElementById('pill-call'); const pillEnd = document.getElementById('pill-end');
    const sendBtn = document.getElementById('send-btn'); const waves = document.getElementById('call-waves-container');
    const standalonePlus = document.getElementById('standalone-plus'); const standaloneMute = document.getElementById('standalone-mute');
    
    const fileInput = document.getElementById('hidden-file-input'); const preview = document.getElementById('image-preview-container');
    const chatBox = document.getElementById('chat-box'); const thinking = document.getElementById('thinking-indicator');
    let pendingImageFile = null;

    // 🚀 نارمل چیٹ اور وائس نوٹ اینیمیشن 🚀
    function updateNormalUI() {
        if(isCallActive) return;
        const hasText = input.value.trim().length > 0 || pendingImageFile;
        const isTyping = document.activeElement === input || hasText;

        if (isTyping || window.isAyeshaRecording) {
            pillPlus.classList.add('slide-hide'); mainPill.classList.add('gemini-glow');
            mainPill.style.paddingLeft = '8px';
            pillCall.classList.add('slide-hide'); // کال بٹن غائب
            if(hasText && !window.isAyeshaRecording) {
                sendBtn.classList.remove('slide-hide'); pillMic.classList.add('slide-hide');
            }
        } else {
            pillPlus.classList.remove('slide-hide'); mainPill.classList.remove('gemini-glow');
            mainPill.style.paddingLeft = '4px';
            pillCall.classList.remove('slide-hide'); // کال بٹن واپس
            sendBtn.classList.add('slide-hide'); pillMic.classList.remove('slide-hide');
        }
    }
    input.addEventListener('input', updateNormalUI); input.addEventListener('focus', updateNormalUI); input.addEventListener('blur', updateNormalUI);

    // 🚀 پلس بٹن لاجک 🚀
    const handlePlusClick = () => fileInput.click();
    pillPlus.onclick = handlePlusClick; standalonePlus.onclick = handlePlusClick;

    fileInput.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImageFile = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImageFile);
            preview.classList.remove('hidden'); updateNormalUI();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImageFile = null; preview.classList.add('hidden'); fileInput.value=''; updateNormalUI(); };

    // 🚀 مائیک (Voice Note) لاجک 🚀
    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording = true; updateNormalUI();
            document.getElementById('mic-icon').classList.add('hidden'); document.getElementById('stop-icon').classList.remove('hidden');
            pillMic.classList.add('bg-red-500/20'); input.placeholder='سن رہی ہوں...'; 
        };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=> sendBtn.click(), 300); };
        rec.onend = () => { 
            window.isAyeshaRecording = false; 
            document.getElementById('mic-icon').classList.remove('hidden'); document.getElementById('stop-icon').classList.add('hidden');
            pillMic.classList.remove('bg-red-500/20'); input.placeholder='Ask something...'; updateNormalUI(); 
        };
    }
    pillMic.onclick = () => { if(window.isAyeshaRecording) rec.stop(); else rec.start(); };

    // 🚀 لائیو کال کی زبردست اینیمیشن (ChatGPT Style) 🚀
    pillCall.onclick = () => {
        isCallActive = true; isCallMuted = false;
        
        // 1. اندر والے بٹن اور ان پٹ غائب
        pillPlus.classList.add('slide-hide'); input.classList.remove('slide-show-flex'); input.classList.add('slide-hide');
        pillMic.classList.add('slide-hide'); pillCall.classList.add('slide-hide');
        
        // 2. باہر والے بٹن ظاہر
        setTimeout(() => {
            standalonePlus.classList.replace('slide-hide', 'slide-show-circle');
            standaloneMute.classList.replace('slide-hide', 'slide-show-circle');
            document.getElementById('call-unmuted-icon').classList.remove('hidden'); document.getElementById('call-muted-icon').classList.add('hidden');
            standaloneMute.classList.remove('bg-red-500/20', 'text-red-500'); standaloneMute.classList.add('text-white');
            
            // 3. ڈبے کے اندر ویوز اور اینڈ بٹن
            waves.classList.remove('slide-hide'); waves.classList.add('slide-show-flex');
            pillEnd.classList.remove('slide-hide'); pillEnd.classList.add('opacity-100', 'px-5');
        }, 100);

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);
    };

    // 🚀 کال اینڈ کرنے کی اینیمیشن 🚀
    pillEnd.onclick = () => {
        isCallActive = false;
        
        // 1. باہر والے بٹن غائب اور اندر والے غائب چیزیں واپس
        standalonePlus.classList.replace('slide-show-circle', 'slide-hide');
        standaloneMute.classList.replace('slide-show-circle', 'slide-hide');
        waves.classList.replace('slide-show-flex', 'slide-hide');
        pillEnd.classList.add('slide-hide'); pillEnd.classList.remove('opacity-100', 'px-5');
        
        setTimeout(() => {
            pillPlus.classList.remove('slide-hide'); input.classList.replace('slide-hide', 'slide-show-flex');
            pillMic.classList.remove('slide-hide'); pillCall.classList.remove('slide-hide');
            updateNormalUI();
        }, 200);

        showToast("Voice chat ended");
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false);
    };

    standaloneMute.onclick = () => {
        isCallMuted = !isCallMuted;
        document.getElementById('call-unmuted-icon').classList.toggle('hidden', isCallMuted);
        document.getElementById('call-muted-icon').classList.toggle('hidden', !isCallMuted);
        standaloneMute.classList.toggle('bg-red-500/20', isCallMuted); standaloneMute.classList.toggle('text-red-500', isCallMuted);
        standaloneMute.classList.toggle('text-white', !isCallMuted);
        if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted);
    };

    // 🚀 میسج پرنٹ کرنا اور کاپی بٹن 🚀
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]"><p dir="auto" style="white-space: pre-wrap;">${text}</p></div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative group';
            // 🚀 یہاں Play کے ساتھ Copy بٹن ڈالا گیا ہے 🚀
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10"><p dir="auto" style="white-space: pre-wrap;">${text}</p>
                <div class="flex items-center gap-2 mt-3">
                    <button class="gemini-speaker-btn w-8 h-8 flex items-center justify-center rounded-full bg-[#3a8ff7]/10 text-[#3a8ff7] border border-[#3a8ff7] transition-all hover:bg-[#3a8ff7] hover:text-white" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                    <button class="w-8 h-8 flex items-center justify-center rounded-full bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-gray-400 transition-all opacity-0 group-hover:opacity-100" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedText}')); showToast('Message copied');">${ICONS.copy}</button>
                </div></div>`;
        }
        chatBox.insertBefore(msgDiv, thinking); chatBox.scrollTop = chatBox.scrollHeight;
    }

    sendBtn.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImageFile) {
            executeHardwareCommandLocally(text); addMessage(text, 'user');
            input.value = ''; pendingImageFile = null; preview.classList.add('hidden'); updateNormalUI();
            
            thinking.classList.remove('hidden'); thinking.classList.add('flex');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) })
            .then(res => res.json()).then(data => {
                thinking.classList.add('hidden'); thinking.classList.remove('flex');
                addMessage(data.response, 'assistant');
            }).catch(e => { thinking.classList.add('hidden'); thinking.classList.remove('flex'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); };
});
        
