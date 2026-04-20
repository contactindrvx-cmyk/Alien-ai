window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; let isCallMuted = false; window.isAyeshaRecording = false;

const ICONS = {
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
};

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
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { b.innerHTML = ICONS.play; b.classList.remove('bg-[#3a8ff7]', 'text-white'); });
    if(window.AndroidBridge && window.AndroidBridge.stopBubbleVideo) window.AndroidBridge.stopBubbleVideo();
};

function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) { btnElement.innerHTML = ICONS.play; btnElement.classList.remove('bg-[#3a8ff7]', 'text-white'); return; }
    let textChunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement); window.AyeshaAudio.audioObj.play();
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
    btnElement.innerHTML = ICONS.pause; btnElement.classList.add('bg-[#3a8ff7]', 'text-white'); playCloudQueue(btnElement);
};

document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('chat-wrapper');
    const btnPlus = document.getElementById('btn-plus');
    const centerArea = document.getElementById('center-area');
    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const callInnerUI = document.getElementById('call-inner-ui');
    const btnMic = document.getElementById('btn-mic');
    const callSendBtn = document.getElementById('call-send-btn'); // لائیو کال کے دوران جہاز والا بٹن
    const btnCall = document.getElementById('btn-call');
    const btnEnd = document.getElementById('btn-end');

    const iconMicNormal = document.getElementById('icon-mic-normal');
    const iconMicStop = document.getElementById('icon-mic-stop');
    const iconMicMuted = document.getElementById('icon-mic-muted');

    const fileInput = document.getElementById('hidden-file-input'); 
    const preview = document.getElementById('image-preview-container');
    const chatBox = document.getElementById('chat-box'); const thinking = document.getElementById('thinking-indicator');
    let pendingImageFile = null;

    // 🚀 فکسڈ: Pill کی گولائی اور اینیمیشن 🚀
    function updateTypingUI() {
        if(isCallActive) return;
        const hasText = input.value.trim().length > 0 || pendingImageFile;
        if (hasText || window.isAyeshaRecording) {
            btnMic.classList.add('hide-call-btn'); btnCall.classList.add('hide-call-btn');
            centerArea.classList.add('rounded-r-full'); // 👈 دائیں طرف سے ہمیشہ گول رہے گا
            if(hasText && !window.isAyeshaRecording) {
                sendBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
            }
        } else {
            btnMic.classList.remove('hide-call-btn'); btnCall.classList.remove('hide-call-btn');
            centerArea.classList.remove('rounded-r-full');
            sendBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        }
    }
    input.addEventListener('input', updateTypingUI);

    // 🚀 فکسڈ: امیج پریویو اور لائیو کال میں سینڈ بٹن دکھانا 🚀
    btnPlus.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImageFile = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImageFile);
            preview.classList.remove('hidden');
            
            if(isCallActive) {
                // کال چل رہی ہے تو میوٹ غائب کر کے سینڈ (جہاز) بٹن شو کرو
                btnMic.classList.add('hidden');
                callSendBtn.classList.remove('hidden');
            } else {
                updateTypingUI();
            }
        }
    };
    
    document.getElementById('remove-img-btn').onclick = () => { 
        pendingImageFile = null; preview.classList.add('hidden'); fileInput.value=''; 
        if(isCallActive) {
            btnMic.classList.remove('hidden');
            callSendBtn.classList.add('hidden');
        } else {
            updateTypingUI(); 
        }
    };

    // وائس ٹائپنگ
    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording = true; updateTypingUI();
            btnMic.classList.remove('hide-call-btn'); iconMicNormal.classList.add('hidden'); iconMicStop.classList.remove('hidden');
            btnMic.classList.add('bg-red-500/20'); input.placeholder='سن رہی ہوں...'; 
        };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=> sendBtn.click(), 600); };
        rec.onend = () => { 
            window.isAyeshaRecording = false; 
            iconMicNormal.classList.remove('hidden'); iconMicStop.classList.add('hidden');
            btnMic.classList.remove('bg-red-500/20'); input.placeholder='Ask something...'; updateTypingUI(); 
        };
    }
    
    btnMic.onclick = () => {
        if(isCallActive) {
            isCallMuted = !isCallMuted;
            iconMicNormal.classList.toggle('hidden', isCallMuted); iconMicMuted.classList.toggle('hidden', !isCallMuted);
            btnMic.classList.toggle('bg-red-500/20', isCallMuted);
            if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted);
        } else {
            if(window.isAyeshaRecording) rec.stop(); else rec.start();
        }
    };

    // 🚀 کال اینیمیشن (Pill Split Animation) 🚀
    btnCall.onclick = () => {
        isCallActive = true; isCallMuted = false;
        
        wrapper.classList.remove('gap-0'); wrapper.classList.add('gap-2', 'md:gap-3');
        btnPlus.classList.replace('merged-left', 'split-btn');
        btnCall.classList.add('hide-call-btn');
        
        btnMic.classList.replace('merged-mic', 'split-btn');
        iconMicNormal.classList.remove('hidden'); iconMicMuted.classList.add('hidden');
        btnMic.classList.remove('bg-red-500/20');

        centerArea.classList.replace('merged-center', 'split-btn');
        input.classList.add('opacity-0', 'pointer-events-none'); 
        
        setTimeout(() => {
            callInnerUI.classList.remove('translate-y-14', 'opacity-0', 'pointer-events-none');
            callInnerUI.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }, 150);

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);
    };

    btnEnd.onclick = () => {
        isCallActive = false;
        callInnerUI.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        callInnerUI.classList.add('translate-y-14', 'opacity-0', 'pointer-events-none');
        
        btnMic.classList.remove('hidden'); callSendBtn.classList.add('hidden'); // ری سیٹ
        
        setTimeout(() => {
            wrapper.classList.remove('gap-2', 'md:gap-3'); wrapper.classList.add('gap-0');
            btnPlus.classList.replace('split-btn', 'merged-left');
            btnMic.classList.replace('split-btn', 'merged-mic');
            centerArea.classList.replace('split-btn', 'merged-center');
            btnCall.classList.remove('hide-call-btn');
            
            input.classList.remove('opacity-0', 'pointer-events-none');
            updateTypingUI();
        }, 300);

        showToast("Voice chat ended");
        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false);
    };

    // 🚀 فکسڈ: کاپی بٹن اور سپیکر بٹن کی پرفیکٹ الائنمنٹ 🚀
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        let cleanText = text ? `<p dir="auto" style="white-space: pre-wrap;">${text}</p>` : '';
        
        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${cleanText}</div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative group';
            // 👈 یہاں flex items-center justify-start لگایا گیا ہے تاکہ دونوں بٹن برابر رہیں
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${cleanText}
                <div class="flex items-center justify-start gap-3 mt-3">
                    <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full bg-[#3a8ff7]/10 text-[#3a8ff7] border border-[#3a8ff7] transition-all hover:bg-[#3a8ff7] hover:text-white flex-shrink-0" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                    <button class="w-9 h-9 flex items-center justify-center rounded-full bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-gray-400 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedText}')); showToast('Message copied');">${ICONS.copy}</button>
                </div></div>`;
            
            return msgDiv.querySelector('.gemini-speaker-btn'); // 👈 آٹو پلے کے لیے بٹن واپس بھیجو
        }
        chatBox.insertBefore(msgDiv, thinking); chatBox.scrollTop = chatBox.scrollHeight;
        return null;
    }

    // 🚀 فکسڈ: لائیو کال کے دوران تصویر بھیجنے کا فنکشن 🚀
    callSendBtn.onclick = (e) => {
        e.preventDefault();
        if(pendingImageFile) {
            sendBtn.click(); // مین سینڈ بٹن کو دباؤ
            btnMic.classList.remove('hidden'); callSendBtn.classList.add('hidden'); // واپس میوٹ بٹن لاؤ
        }
    };

    sendBtn.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImageFile) {
            executeHardwareCommandLocally(text); addMessage(text, 'user');
            input.value = ''; pendingImageFile = null; preview.classList.add('hidden'); 
            if(!isCallActive) updateTypingUI();
            
            thinking.classList.remove('hidden'); thinking.classList.add('flex');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) })
            .then(res => res.json()).then(data => {
                thinking.classList.add('hidden'); thinking.classList.remove('flex'); 
                
                // 🚀 فکسڈ: عائشہ اب خود بخود بولے گی 🚀
                let speakerBtn = addMessage(data.response, 'assistant');
                if(speakerBtn && !isCallActive) {
                    setTimeout(() => { window.toggleVoiceMessage(speakerBtn); }, 300);
                }
            }).catch(e => { thinking.classList.add('hidden'); thinking.classList.remove('flex'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); };
});
        
