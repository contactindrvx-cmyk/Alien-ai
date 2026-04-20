window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; let isCallMuted = false; window.isAyeshaRecording = false;

const ICONS = {
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
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
    const btnCall = document.getElementById('btn-call');
    const btnEnd = document.getElementById('btn-end');

    const iconMicNormal = document.getElementById('icon-mic-normal');
    const iconMicStop = document.getElementById('icon-mic-stop');
    const iconMicMuted = document.getElementById('icon-mic-muted');

    const fileInput = document.getElementById('hidden-file-input'); 
    const preview = document.getElementById('image-preview-container');
    const chatBox = document.getElementById('chat-box'); const thinking = document.getElementById('thinking-indicator');
    let pendingImageFile = null;

    // 🚀 نارمل ٹائپنگ اینیمیشن (سینڈ بٹن آئے گا، مائیک اور کال ہائیڈ ہوں گے)
    function updateTypingUI() {
        if(isCallActive) return;
        const hasText = input.value.trim().length > 0 || pendingImageFile;
        if (hasText || window.isAyeshaRecording) {
            btnMic.classList.add('hide-call-btn'); btnCall.classList.add('hide-call-btn'); // مائیک اور کال غائب
            centerArea.classList.replace('merged-center', 'merged-right'); // کونا گول
            if(hasText && !window.isAyeshaRecording) {
                sendBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none'); // سینڈ بٹن ظاہر
            }
        } else {
            btnMic.classList.remove('hide-call-btn'); btnCall.classList.remove('hide-call-btn');
            centerArea.classList.replace('merged-right', 'merged-center');
            sendBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        }
    }
    input.addEventListener('input', updateTypingUI);

    // 🚀 پلس بٹن لاجک
    btnPlus.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImageFile = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImageFile);
            preview.classList.remove('hidden'); updateTypingUI();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImageFile = null; preview.classList.add('hidden'); fileInput.value=''; updateTypingUI(); };

    // 🚀 وائس ٹائپنگ لاجک (آٹو سینڈ کے ساتھ) 🚀
    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording = true; updateTypingUI();
            btnMic.classList.remove('hide-call-btn'); // مائیک بٹن کو زبردستی روکو
            iconMicNormal.classList.add('hidden'); iconMicStop.classList.remove('hidden'); // سٹاپ آئیکن
            btnMic.classList.add('bg-red-500/20'); input.placeholder='سن رہی ہوں...'; 
        };
        rec.onresult = (e) => { 
            input.value = e.results[0][0].transcript; 
            // 🚀 رضا بھائی کا فیچر: تھوڑی دیر بعد آٹو سینڈ 🚀
            setTimeout(()=> { if(input.value.trim().length > 0) sendBtn.click(); }, 600); 
        };
        rec.onend = () => { 
            window.isAyeshaRecording = false; 
            iconMicNormal.classList.remove('hidden'); iconMicStop.classList.add('hidden');
            btnMic.classList.remove('bg-red-500/20'); input.placeholder='Ask something...'; updateTypingUI(); 
        };
    }
    btnMic.onclick = () => {
        if(isCallActive) {
            // کال کے دوران یہ میوٹ بٹن بن جاتا ہے
            isCallMuted = !isCallMuted;
            iconMicNormal.classList.toggle('hidden', isCallMuted); iconMicMuted.classList.toggle('hidden', !isCallMuted);
            btnMic.classList.toggle('bg-red-500/20', isCallMuted);
            if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted);
        } else {
            // نارمل حالت میں یہ وائس ٹائپنگ کرتا ہے
            if(window.isAyeshaRecording) rec.stop(); else rec.start();
        }
    };

    // 🚀 کال اینیمیشن (Pill Split Animation) 🚀
    btnCall.onclick = () => {
        isCallActive = true; isCallMuted = false;
        
        // 1. ڈبے کو توڑو
        wrapper.classList.remove('gap-0'); wrapper.classList.add('gap-2', 'md:gap-3');
        
        // 2. پلس بٹن الگ گول ہو جائے گا
        btnPlus.classList.replace('merged-left', 'split-btn');
        
        // 3. کال بٹن غائب
        btnCall.classList.add('hide-call-btn');
        
        // 4. مائیک بٹن الگ گول ہو جائے گا (Mute بننے کے لیے تیار)
        btnMic.classList.replace('merged-mic', 'split-btn');
        iconMicNormal.classList.remove('hidden'); iconMicMuted.classList.add('hidden');
        btnMic.classList.remove('bg-red-500/20');

        // 5. سینٹر ایریا بڑا ڈبہ بنے گا اور ویوز ظاہر ہوں گی
        centerArea.classList.replace('merged-center', 'split-btn');
        input.classList.add('opacity-0', 'pointer-events-none'); // ان پٹ چھپاؤ
        
        setTimeout(() => {
            callInnerUI.classList.remove('translate-y-14', 'opacity-0', 'pointer-events-none');
            callInnerUI.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }, 150);

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);
    };

    // 🚀 کال اینڈ اینیمیشن (Pill Merge Animation) 🚀
    btnEnd.onclick = () => {
        isCallActive = false;
        
        // 1. ویوز چھپاؤ
        callInnerUI.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        callInnerUI.classList.add('translate-y-14', 'opacity-0', 'pointer-events-none');
        
        setTimeout(() => {
            // 2. ڈبے کو واپس جوڑو
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

    // 🚀 کاپی بٹن اور میسج پرنٹ 🚀
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]"><p dir="auto" style="white-space: pre-wrap;">${text}</p></div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative group';
            // 🚀 پلے اور کاپی بٹن 🚀
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
            input.value = ''; pendingImageFile = null; preview.classList.add('hidden'); updateTypingUI();
            
            thinking.classList.remove('hidden'); thinking.classList.add('flex');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) })
            .then(res => res.json()).then(data => {
                thinking.classList.add('hidden'); thinking.classList.remove('flex'); addMessage(data.response, 'assistant');
            }).catch(e => { thinking.classList.add('hidden'); thinking.classList.remove('flex'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); };
});
                
