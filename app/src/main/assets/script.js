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
                <button class="w-9 h-9 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all cursor-pointer" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}')); showToast('Copied');">${ICONS.copy}</button>
            </div></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
    
    // سکرول ٹو باٹم جب میسج آئے
    setTimeout(() => { chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' }); }, 100);
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input'); 
    const normalUI = document.getElementById('normal-ui'); const callUI = document.getElementById('call-ui');
    
    const btnPlus = document.getElementById('btn-plus'); const centerInput = document.getElementById('center-input');
    const btnMic = document.getElementById('btn-mic'); const btnCall = document.getElementById('btn-call');
    const sendBtn = document.getElementById('send-btn');
    
    const callPlus = document.getElementById('call-plus-btn'); const muteCall = document.getElementById('mute-call-btn');
    const btnEnd = document.getElementById('btn-end');

    const iNormal = document.getElementById('icon-mic-normal'); const iStop = document.getElementById('icon-mic-stop');
    const iUnmuted = document.getElementById('icon-call-unmuted'); const iMuted = document.getElementById('icon-call-muted');
    const iSend = document.getElementById('icon-call-send');

    const fileIn = document.getElementById('hidden-file-input'); const preview = document.getElementById('image-preview-container');
    const chatBox = document.getElementById('chat-box'); const thinking = document.getElementById('thinking-indicator');
    const scrollBtn = document.getElementById('scroll-bottom-btn');
    let pendingImg = null;

    // 🚀 نیا فیچر: سکرول ٹو باٹم تیر والا بٹن 🚀
    chatBox.addEventListener('scroll', () => {
        if (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight > 150) {
            scrollBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
        } else {
            scrollBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        }
    });
    scrollBtn.onclick = () => { chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' }); };

    // 🚀 فول پروف UI منیجر (No Overlaps Guaranteed) 🚀
    function updateUI() {
        if(isCallActive) return; // کال کے دوران نارمل UI کو نہیں چھیڑنا
        
        const hasText = input.value.trim().length > 0 || pendingImg;

        if (hasText || window.isAyeshaRecording) {
            // ٹائپنگ موڈ: مائیک اور کال چھپاؤ، گولائی پوری کرو (rounded-r-full)
            btnMic.classList.add('hidden'); btnCall.classList.add('hidden');
            centerInput.classList.add('border-r', 'rounded-r-full', 'gemini-glow');
            
            if(hasText && !window.isAyeshaRecording) {
                sendBtn.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
            }
        } else {
            // نارمل موڈ: مائیک اور کال واپس لاؤ، رائٹ سائیڈ فلیٹ کرو
            btnMic.classList.remove('hidden'); btnCall.classList.remove('hidden');
            centerInput.classList.remove('border-r', 'rounded-r-full', 'gemini-glow');
            sendBtn.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        }
    }

    input.addEventListener('input', updateUI);

    const handlePlusClick = () => fileIn.click();
    btnPlus.onclick = handlePlusClick; callPlus.onclick = handlePlusClick;

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden');
            
            if(isCallActive) {
                // لائیو کال میں تصویر آئے تو میوٹ کو جہاز بناؤ
                iUnmuted.classList.add('hidden'); iMuted.classList.add('hidden'); iSend.classList.remove('hidden');
                muteCall.classList.remove('bg-red-500/20');
            } else { updateUI(); }
        }
    };
    
    document.getElementById('remove-img-btn').onclick = () => {
        pendingImg = null; preview.classList.add('hidden'); fileIn.value='';
        if(isCallActive) {
            iSend.classList.add('hidden');
            if(isCallMuted) iMuted.classList.remove('hidden'); else iUnmuted.classList.remove('hidden');
        } else { updateUI(); }
    };

    let rec; if('webkitSpeechRecognition' in window) {
        rec = new webkitSpeechRecognition(); rec.lang='ur-PK';
        rec.onstart = () => { 
            window.isAyeshaRecording = true; 
            btnMic.classList.remove('hidden'); centerInput.classList.remove('rounded-r-full'); // زبردستی مائیک شو کرو
            iNormal.classList.add('hidden'); iStop.classList.remove('hidden');
            btnMic.classList.add('bg-red-500/20'); input.placeholder='سن رہی ہوں...'; 
            updateUI();
        };
        rec.onresult = (e) => { input.value = e.results[0][0].transcript; setTimeout(()=>sendBtn.click(), 500); };
        rec.onend = () => { 
            window.isAyeshaRecording = false; 
            iNormal.classList.remove('hidden'); iStop.classList.add('hidden');
            btnMic.classList.remove('bg-red-500/20'); input.placeholder='Ask something...'; updateUI(); 
        };
    }
    
    btnMic.onclick = () => { if(window.isAyeshaRecording) rec.stop(); else rec.start(); };

    // 📞 کال سٹارٹ (نارمل UI ہائیڈ، کال UI شو)
    btnCall.onclick = () => {
        isCallActive = true; isCallMuted = false;
        
        normalUI.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        normalUI.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
        
        setTimeout(() => {
            callUI.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
            callUI.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
        }, 100);

        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true);
    };

    // 📞 کال اینڈ (کال UI ہائیڈ، نارمل UI شو)
    btnEnd.onclick = () => {
        isCallActive = false;
        
        callUI.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        callUI.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
        
        setTimeout(() => {
            normalUI.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
            normalUI.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
            updateUI();
        }, 100);

        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false); 
        showToast("Voice chat ended");
    };

    muteCall.onclick = () => {
        if(pendingImg) { 
            sendBtn.click(); 
            iSend.classList.add('hidden'); 
            if(isCallMuted) iMuted.classList.remove('hidden'); else iUnmuted.classList.remove('hidden');
        } else { 
            isCallMuted = !isCallMuted; 
            iUnmuted.classList.toggle('hidden', isCallMuted); iMuted.classList.toggle('hidden', !isCallMuted); 
            muteCall.classList.toggle('bg-red-500/20', isCallMuted);
            if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted); 
        }
    };

    sendBtn.onclick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            addMessage(text || "تصویر بھیجی گئی", 'user');
            const data = { message: text, email: "alirazasabir007@gmail.com" };
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); 
            if(!isCallActive) updateUI();
            
            thinking.classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
            .then(res => res.json()).then(d => { 
                thinking.classList.add('hidden'); 
                let btn = addMessage(d.response, 'assistant');
                if(btn && !isCallActive) setTimeout(() => window.toggleVoiceMessage(btn), 300); 
            }).catch(e => { thinking.classList.add('hidden'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.remove('-translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); };
});
        
