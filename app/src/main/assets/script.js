window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; let isCallMuted = false; window.isAyeshaRecording = false;

const ICONS = {
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
};

function showToast(msg) {
    const t = document.getElementById('top-toast'); document.getElementById('toast-text').innerText = msg;
    t.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => t.classList.remove('opacity-100', 'translate-y-0'), 3000);
}

function stopAllAudio() { if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); window.AyeshaAudio.queue = []; }

function playVoice(btn) {
    if (window.AyeshaAudio.queue.length === 0) { btn.innerHTML = ICONS.play; return; }
    let chunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playVoice(btn); window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btn) {
    if (window.AyeshaAudio.currentBtn === btn && window.AyeshaAudio.audioObj && !window.AyeshaAudio.audioObj.paused) {
        window.AyeshaAudio.audioObj.pause(); btn.innerHTML = ICONS.play; return;
    }
    stopAllAudio(); window.AyeshaAudio.currentBtn = btn;
    let text = decodeURIComponent(btn.getAttribute('data-text'));
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
    window.AyeshaAudio.queue = text.match(/.{1,150}(\s|$)|.{1,150}/g).filter(p => p.trim().length > 0);
    btn.innerHTML = ICONS.pause; playVoice(btn);
};

window.addMessageFromJava = function(text) {
    let btn = addMessage(text, 'assistant');
    if(btn && isCallActive) setTimeout(() => window.toggleVoiceMessage(btn), 200);
};

function addMessage(text, sender) {
    const chatBox = document.getElementById('chat-box'); const msgDiv = document.createElement('div');
    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    } else {
        const enc = encodeURIComponent(text);
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p>
            <div class="flex items-center gap-3 mt-3">
                <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7] text-[#3a8ff7]" data-text="${enc}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                <button class="w-9 h-9 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all cursor-pointer" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}')); showToast('Copied');">${ICONS.copy}</button>
            </div></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        chatBox.scrollTop = chatBox.scrollHeight;
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); chatBox.scrollTop = chatBox.scrollHeight;
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input'); const sendBtn = document.getElementById('send-btn');
    const normalPill = document.getElementById('normal-pill'); const callPill = document.getElementById('call-active-pill');
    const btnMic = document.getElementById('btn-mic'); const btnCallStart = document.getElementById('btn-call-start');
    const btnCallEnd = document.getElementById('btn-call-end'); const muteCallBtn = document.getElementById('call-mute-btn');
    const scrollBtn = document.getElementById('scroll-bottom-btn'); const chatBox = document.getElementById('chat-box');
    const fileIn = document.getElementById('hidden-file-input'); const preview = document.getElementById('image-preview-container');
    let pendingImg = null;

    // 🚀 سکرول بٹن لاجک 🚀
    chatBox.addEventListener('scroll', () => {
        if (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight > 200) scrollBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
        else scrollBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
    });
    scrollBtn.onclick = () => chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });

    // 🚀 UI اپڈیٹ (جام ہونے کا حل) 🚀
    function refreshUI() {
        if(isCallActive) {
            normalPill.classList.replace('active-layer', 'hidden-layer');
            callPill.classList.replace('hidden-layer', 'active-layer');
            if(pendingImg) { 
                document.getElementById('call-unmuted').classList.add('hidden'); document.getElementById('call-muted').classList.add('hidden');
                document.getElementById('call-send-img').classList.remove('hidden'); 
            } else {
                document.getElementById('call-send-img').classList.add('hidden');
                if(isCallMuted) document.getElementById('call-muted').classList.remove('hidden'); else document.getElementById('call-unmuted').classList.remove('hidden');
            }
            return;
        }
        
        normalPill.classList.replace('hidden-layer', 'active-layer');
        callPill.classList.replace('active-layer', 'hidden-layer');

        const hasText = input.value.trim().length > 0 || pendingImg;
        if(hasText) {
            sendBtn.classList.remove('hidden', 'scale-0', 'opacity-0');
            btnCallStart.classList.add('hidden');
            if(input.value.trim().length > 0) btnMic.classList.add('hidden'); else btnMic.classList.remove('hidden');
        } else {
            sendBtn.classList.add('hidden');
            btnCallStart.classList.remove('hidden');
            btnMic.classList.remove('hidden');
        }
    }

    input.addEventListener('input', refreshUI);
    document.getElementById('btn-plus').onclick = () => fileIn.click();
    document.getElementById('call-plus').onclick = () => fileIn.click();

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); refreshUI();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; refreshUI(); };

    // 🎤 وائس ٹائپنگ
    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording=true; 
            document.getElementById('icon-mic-normal').classList.add('hidden'); document.getElementById('icon-mic-stop').classList.remove('hidden');
            input.placeholder='سن رہی ہوں...'; 
        };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=>sendBtn.click(), 500); };
        rec.onend = () => { window.isAyeshaRecording=false; document.getElementById('icon-mic-normal').classList.remove('hidden'); document.getElementById('icon-mic-stop').classList.add('hidden'); input.placeholder='Ask something...'; refreshUI(); };
    }
    btnMic.onclick = () => { if(window.isAyeshaRecording) rec.stop(); else rec.start(); };

    // 📞 کال کنٹرولز
    btnCallStart.onclick = () => { isCallActive = true; refreshUI(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); };
    btnCallEnd.onclick = () => { isCallActive = false; refreshUI(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); showToast("Voice chat ended"); };
    
    muteCallBtn.onclick = () => {
        if(pendingImg) sendBtn.click();
        else { isCallMuted = !isCallMuted; refreshUI(); if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted); }
    };

    sendBtn.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            addMessage(text || "تصویر بھیجی گئی", 'user');
            const data = { message: text, email: "alirazasabir007@gmail.com" };
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); refreshUI();
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
            .then(res => res.json()).then(d => { document.getElementById('thinking-indicator').classList.add('hidden'); window.addMessageFromJava(d.response); });
        }
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); };
});
            
