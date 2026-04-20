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

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); window.AyeshaAudio.queue = []; 
};

function playCloudQueue(btn) {
    if (window.AyeshaAudio.queue.length === 0) { btn.innerHTML = ICONS.play; return; }
    let chunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btn); window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btn) {
    if (window.AyeshaAudio.currentBtn === btn && window.AyeshaAudio.audioObj && !window.AyeshaAudio.audioObj.paused) {
        window.AyeshaAudio.audioObj.pause(); btn.innerHTML = ICONS.play; return;
    }
    window.stopAyeshaCompletely(); window.AyeshaAudio.currentBtn = btn;
    let text = decodeURIComponent(btn.getAttribute('data-text'));
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
    window.AyeshaAudio.queue = text.match(/.{1,150}(\s|$)|.{1,150}/g).filter(p => p.trim().length > 0);
    btn.innerHTML = ICONS.pause; playCloudQueue(btn);
};

window.addMessageFromJava = function(text) {
    let btn = addMessage(text, 'assistant');
    if(btn && isCallActive) setTimeout(() => window.toggleVoiceMessage(btn), 200);
};

function addMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    } else {
        const enc = encodeURIComponent(text);
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p>
            <div class="flex items-center gap-3 mt-3">
                <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7]" data-text="${enc}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                <button class="w-9 h-9 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}')); showToast('Copied');">${ICONS.copy}</button>
            </div></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        chatBox.scrollTop = chatBox.scrollHeight;
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
    chatBox.scrollTop = chatBox.scrollHeight;
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input'); const wrapper = document.getElementById('chat-wrapper');
    const btnPlus = document.getElementById('btn-plus'); const center = document.getElementById('center-area');
    const btnMic = document.getElementById('btn-mic'); const btnCall = document.getElementById('btn-call');
    const sendBtn = document.getElementById('send-btn'); const callInner = document.getElementById('call-inner-ui');
    const callPlus = document.getElementById('call-plus-btn'); const muteCall = document.getElementById('mute-call-btn');
    const btnEnd = document.getElementById('btn-end'); const preview = document.getElementById('image-preview-container');
    const fileIn = document.getElementById('hidden-file-input');
    let pendingImg = null;

    function updateUI() {
        if(isCallActive) return;
        const hasText = input.value.trim().length > 0 || pendingImg;
        if (hasText || window.isAyeshaRecording) {
            btnMic.classList.add('hide-call-btn'); btnCall.classList.add('hide-call-btn');
            center.classList.add('rounded-r-full', 'border-r');
            if(hasText && !window.isAyeshaRecording) sendBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
        } else {
            btnMic.classList.remove('hide-call-btn'); btnCall.classList.remove('hide-call-btn');
            center.classList.remove('rounded-r-full', 'border-r');
            sendBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        }
    }
    input.addEventListener('input', updateUI);
    btnPlus.onclick = () => fileIn.click(); callPlus.onclick = () => fileIn.click();

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden');
            if(isCallActive) {
                document.getElementById('icon-call-unmuted').classList.add('hidden');
                document.getElementById('icon-call-send').classList.remove('hidden');
            } else updateUI();
        }
    };

    document.getElementById('remove-img-btn').onclick = () => {
        pendingImg = null; preview.classList.add('hidden');
        if(isCallActive) {
            document.getElementById('icon-call-send').classList.add('hidden');
            document.getElementById('icon-call-unmuted').classList.remove('hidden');
        } else updateUI();
    };

    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { window.isAyeshaRecording=true; updateUI(); btnMic.classList.remove('hide-call-btn'); document.getElementById('icon-mic-normal').classList.add('hidden'); document.getElementById('icon-mic-stop').classList.remove('hidden'); };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=>sendBtn.click(), 500); };
        rec.onend = () => { window.isAyeshaRecording=false; document.getElementById('icon-mic-normal').classList.remove('hidden'); document.getElementById('icon-mic-stop').classList.add('hidden'); updateUI(); };
    }
    btnMic.onclick = () => { if(window.isAyeshaRecording) rec.stop(); else rec.start(); };

    btnCall.onclick = () => {
        isCallActive = true; wrapper.classList.add('gap-3');
        btnPlus.style.width='0'; btnMic.style.width='0'; btnCall.style.width='0';
        center.classList.add('rounded-full', 'border-x'); input.classList.add('opacity-0');
        setTimeout(() => { callPlus.classList.add('active'); muteCall.classList.add('active'); callInner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto'); }, 150);
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(true);
    };

    btnEnd.onclick = () => {
        isCallActive = false; callInner.classList.remove('translate-y-0', 'opacity-100');
        callPlus.classList.remove('active'); muteCall.classList.remove('active');
        setTimeout(() => { wrapper.classList.remove('gap-3'); btnPlus.style.width='56px'; btnMic.style.width='56px'; btnCall.style.width='56px'; center.classList.remove('rounded-full', 'border-x'); input.classList.remove('opacity-0'); updateUI(); }, 300);
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); showToast("Voice chat ended");
    };

    muteCall.onclick = () => {
        if(pendingImg) { sendBtn.click(); document.getElementById('icon-call-send').classList.add('hidden'); document.getElementById('icon-call-unmuted').classList.remove('hidden'); }
        else { isCallMuted = !isCallMuted; document.getElementById('icon-call-unmuted').classList.toggle('hidden', isCallMuted); document.getElementById('icon-call-muted').classList.toggle('hidden', !isCallMuted); if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted); }
    };

    sendBtn.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            addMessage(text || "تصویر بھیجی گئی", 'user');
            const data = { message: text, email: "alirazasabir007@gmail.com" };
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); updateUI();
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
            .then(res => res.json()).then(d => { document.getElementById('thinking-indicator').classList.add('hidden'); window.addMessageFromJava(d.response); });
        }
    };
});
        
