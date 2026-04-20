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

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { b.innerHTML = ICONS.play; b.classList.remove('bg-[#3a8ff7]', 'text-white'); });
};

function playCloudQueue(btn) {
    if (window.AyeshaAudio.queue.length === 0) { btn.innerHTML = ICONS.play; btn.classList.remove('bg-[#3a8ff7]', 'text-white'); return; }
    let chunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btn); window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btn) {
    if (window.AyeshaAudio.currentBtn === btn && window.AyeshaAudio.audioObj && !window.AyeshaAudio.audioObj.paused) {
        window.AyeshaAudio.audioObj.pause(); btn.innerHTML = ICONS.play; btn.classList.remove('bg-[#3a8ff7]', 'text-white'); return;
    }
    window.stopAyeshaCompletely(); window.AyeshaAudio.currentBtn = btn;
    let text = decodeURIComponent(btn.getAttribute('data-text'));
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
    window.AyeshaAudio.queue = text.match(/.{1,150}(\s|$)|.{1,150}/g).filter(p => p.trim().length > 0);
    btn.innerHTML = ICONS.pause; btn.classList.add('bg-[#3a8ff7]', 'text-white'); playCloudQueue(btn);
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
                <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7] text-[#3a8ff7] hover:bg-[#3a8ff7] hover:text-white transition-all cursor-pointer" data-text="${enc}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                <button class="w-9 h-9 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all cursor-pointer" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}')); showToast('Copied');">${ICONS.copy}</button>
            </div></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input'); 
    const outPlus = document.getElementById('out-plus'); const outMute = document.getElementById('out-mute');
    const mainPill = document.getElementById('main-pill');
    const inPlus = document.getElementById('in-plus'); const waveArea = document.getElementById('wave-area');
    const inSend = document.getElementById('in-send'); const inMic = document.getElementById('in-mic');
    const inCall = document.getElementById('in-call'); const inEnd = document.getElementById('in-end');
    const fileIn = document.getElementById('hidden-file-input');
    const chatBox = document.getElementById('chat-box'); const thinking = document.getElementById('thinking-indicator');
    const scrollBtn = document.getElementById('scroll-bottom-btn');
    let pendingImg = null;

    function applyState(state) {
        if (state === 'NORMAL') {
            outPlus.classList.add('btn-collapse'); outMute.classList.add('btn-collapse');
            mainPill.classList.remove('gemini-glow');
            inPlus.classList.remove('btn-collapse'); input.classList.remove('btn-collapse');
            inMic.classList.remove('btn-collapse'); inCall.classList.remove('btn-collapse');
            inSend.classList.add('btn-collapse'); waveArea.classList.add('btn-collapse'); inEnd.classList.add('btn-collapse');
        } else if (state === 'TYPING') {
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inPlus.classList.add('btn-collapse'); inMic.classList.add('btn-collapse'); inCall.classList.add('btn-collapse');
            inSend.classList.remove('btn-collapse'); inSend.classList.add('btn-expand');
        } else if (state === 'CALL') {
            outPlus.classList.remove('btn-collapse'); outMute.classList.remove('btn-collapse');
            input.classList.add('btn-collapse'); inPlus.classList.add('btn-collapse');
            inMic.classList.add('btn-collapse'); inCall.classList.add('btn-collapse');
            waveArea.classList.remove('btn-collapse'); inEnd.classList.remove('btn-collapse'); inEnd.classList.add('btn-expand-auto');
        }
    }

    const handlePlusClick = (e) => {
        e.preventDefault();
        // اگر ایپ کا برج ہے تو اسے استعمال کریں ورنہ براؤزر کا فائل ان پٹ
        if(window.AndroidBridge && window.AndroidBridge.openGallery) {
            window.AndroidBridge.openGallery();
        } else {
            fileIn.click();
        }
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick;

    inMic.onclick = () => {
        // ایپ برج کے ذریعے مائیک کھولیں
        if(window.AndroidBridge && window.AndroidBridge.startVoiceRecognition) {
            window.AndroidBridge.startVoiceRecognition();
        } else {
            showToast("Native voice support not found. Ensure AndroidBridge is set up.");
        }
    };

    inCall.onclick = () => { isCallActive = true; applyState('CALL'); if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); };
    inEnd.onclick = () => { isCallActive = false; applyState('NORMAL'); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); };

    inSend.onclick = (e) => {
        const text = input.value.trim();
        if (text) {
            addMessage(text, 'user');
            input.value = ''; applyState('NORMAL');
            thinking.classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) 
            })
            .then(res => res.json()).then(d => { 
                thinking.classList.add('hidden'); 
                addMessage(d.response, 'assistant');
            }).catch(() => { thinking.classList.add('hidden'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };
    
    input.addEventListener('input', () => { if(!isCallActive) applyState(input.value.length > 0 ? 'TYPING' : 'NORMAL'); });
});
        
