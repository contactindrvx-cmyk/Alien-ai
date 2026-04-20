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
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { b.innerHTML = ICONS.play; });
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
                <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7] text-[#3a8ff7] hover:bg-[#3a8ff7] hover:text-white transition-all" data-text="${enc}" onclick="window.toggleVoiceMessage(this)">${ICONS.play}</button>
                <button class="w-9 h-9 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}')); showToast('Copied');">${ICONS.copy}</button>
            </div></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); chatBox.scrollTop = chatBox.scrollHeight;
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); chatBox.scrollTop = chatBox.scrollHeight;
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('chat-wrapper');
    const btnPlus = document.getElementById('btn-plus');
    const centerArea = document.getElementById('center-area');
    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const btnMic = document.getElementById('btn-mic');
    const btnCall = document.getElementById('btn-call');
    const callInner = document.getElementById('call-inner-ui');
    const btnEnd = document.getElementById('btn-end');

    const iNormal = document.getElementById('icon-mic-normal');
    const iStop = document.getElementById('icon-mic-stop');
    const iUnmuted = document.getElementById('icon-call-unmuted');
    const iMuted = document.getElementById('icon-call-muted');
    const iSend = document.getElementById('icon-call-send'); // جہاز

    const fileIn = document.getElementById('hidden-file-input');
    const preview = document.getElementById('image-preview-container');
    let pendingImg = null;

    // 🚀 فول پروف اسٹیٹ مینجمنٹ (State Management) 🚀
    function applyState(state) {
        // پہلے تمام کلاسز ریموو کر دو تاکہ کوئی کانفلکٹ نہ ہو
        wrapper.className = "flex items-center w-full max-w-4xl mx-auto h-14 transition-all duration-300 " + (state === 'CALL' ? "gap-2 md:gap-3" : "gap-0");
        
        if (state === 'NORMAL') {
            btnPlus.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] border-r-0 rounded-l-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10";
            centerArea.className = "flex-1 h-14 bg-[#16243d] border-y border-[#2f3037] flex items-center transition-all duration-300 overflow-hidden relative";
            btnMic.className = "w-14 h-14 bg-[#16243d] border-y border-[#2f3037] flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10 relative";
            btnCall.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] border-l-0 rounded-r-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 overflow-hidden opacity-100";
            sendBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
            
            iNormal.classList.remove('hidden'); iStop.classList.add('hidden');
            iUnmuted.classList.add('hidden'); iMuted.classList.add('hidden'); iSend.classList.add('hidden');
        } 
        else if (state === 'TYPING') {
            btnPlus.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] border-r-0 rounded-l-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10";
            centerArea.className = "flex-1 h-14 bg-[#16243d] border border-[#2f3037] border-l-0 rounded-r-full flex items-center transition-all duration-300 overflow-hidden relative gemini-glow";
            
            // اگر تصویر ہے، تو مائیک شو کرو، اگر نہیں تو مائیک غائب کرو
            if(pendingImg && input.value.trim().length === 0) {
                btnMic.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10 relative ml-2";
                centerArea.classList.remove('border-l-0'); centerArea.className = "flex-1 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex items-center transition-all duration-300 overflow-hidden relative gemini-glow";
                btnPlus.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10 mr-2";
                wrapper.className = "flex items-center w-full max-w-4xl mx-auto h-14 transition-all duration-300 gap-0"; // override wrapper
            } else {
                btnMic.className = "w-0 h-14 opacity-0 overflow-hidden border-0 transition-all duration-300";
            }
            
            btnCall.className = "w-0 h-14 opacity-0 overflow-hidden border-0 transition-all duration-300";
            sendBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
            
            iNormal.classList.remove('hidden'); iStop.classList.add('hidden');
            iUnmuted.classList.add('hidden'); iMuted.classList.add('hidden'); iSend.classList.add('hidden');
        }
        else if (state === 'CALL') {
            btnPlus.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex-shrink-0 flex justify-center items-center text-[#3a8ff7] transition-all duration-300 z-10 shadow-lg";
            centerArea.className = "flex-1 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex items-center transition-all duration-300 overflow-hidden relative shadow-lg";
            btnMic.className = "w-14 h-14 bg-[#16243d] border border-[#2f3037] rounded-full flex-shrink-0 flex justify-center items-center text-white transition-all duration-300 z-10 relative shadow-lg";
            btnCall.className = "w-0 h-14 opacity-0 overflow-hidden border-0 transition-all duration-300";
            
            iNormal.classList.add('hidden'); iStop.classList.add('hidden');
            
            // کال میں اگر تصویر ہے تو جہاز ورنہ میوٹ
            if(pendingImg) {
                iSend.classList.remove('hidden'); iUnmuted.classList.add('hidden'); iMuted.classList.add('hidden');
                btnMic.classList.remove('bg-red-500/20');
            } else {
                iSend.classList.add('hidden');
                iUnmuted.classList.toggle('hidden', isCallMuted);
                iMuted.classList.toggle('hidden', !isCallMuted);
                if(isCallMuted) btnMic.classList.add('bg-red-500/20'); else btnMic.classList.remove('bg-red-500/20');
            }
        }
    }

    function checkUI() {
        if(isCallActive) { applyState('CALL'); return; }
        if(input.value.trim().length > 0 || pendingImg || window.isAyeshaRecording) { applyState('TYPING'); } 
        else { applyState('NORMAL'); }
    }

    input.addEventListener('input', checkUI);

    // 🚀 مینو اور پلس بٹن فکس 🚀
    document.getElementById('menu-btn').addEventListener('click', () => { 
        document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); 
    });
    document.getElementById('sidebar-overlay').addEventListener('click', () => { 
        document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); 
    });

    btnPlus.addEventListener('click', () => fileIn.click());
    
    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden');
            checkUI();
        }
    };
    
    document.getElementById('remove-img-btn').onclick = () => { 
        pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; checkUI();
    };

    // 🎤 وائس ٹائپنگ
    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording = true; checkUI();
            iNormal.classList.add('hidden'); iStop.classList.remove('hidden');
            btnMic.classList.add('bg-red-500/20'); input.placeholder='سن رہی ہوں...'; 
        };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=>sendBtn.click(), 500); };
        rec.onend = () => { 
            window.isAyeshaRecording = false; 
            btnMic.classList.remove('bg-red-500/20'); input.placeholder='Ask something...'; checkUI(); 
        };
    }
    
    btnMic.addEventListener('click', () => {
        if(isCallActive) {
            if(pendingImg) {
                sendBtn.click(); // تصویر سینڈ کر دو
            } else {
                isCallMuted = !isCallMuted; checkUI();
                if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted);
            }
        } else {
            if(window.isAyeshaRecording) rec.stop(); else rec.start();
        }
    });

    // 📞 کال سٹارٹ
    btnCall.addEventListener('click', () => {
        isCallActive = true; isCallMuted = false; checkUI();
        input.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => { callInner.classList.remove('translate-y-14', 'opacity-0', 'pointer-events-none'); callInner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto'); }, 150);
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(true);
    });

    // 📞 کال اینڈ
    btnEnd.addEventListener('click', () => {
        isCallActive = false;
        callInner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        callInner.classList.add('translate-y-14', 'opacity-0', 'pointer-events-none');
        setTimeout(() => { input.classList.remove('opacity-0', 'pointer-events-none'); checkUI(); }, 300);
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); showToast("Voice chat ended");
    });

    sendBtn.addEventListener('click', (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            addMessage(text || "تصویر بھیجی گئی", 'user');
            const data = { message: text, email: "alirazasabir007@gmail.com" };
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); checkUI();
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
            .then(res => res.json()).then(d => { document.getElementById('thinking-indicator').classList.add('hidden'); window.addMessageFromJava(d.response); });
        }
    });
});
            
