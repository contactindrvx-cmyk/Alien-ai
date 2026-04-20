window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; 
window.isAyeshaRecording = false;

let input, outPlus, outSend, mainPill, inPlus, waveArea, inSend, inMic, inCall;
let iMicNormal, iMicStop, fileIn, preview, pendingImg = null, voiceTimeout;

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); 
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { 
        b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        b.classList.remove('bg-[#3a8ff7]', 'text-white'); 
    });
};

function playCloudQueue(btn) {
    if (window.AyeshaAudio.queue.length === 0) { 
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        btn.classList.remove('bg-[#3a8ff7]', 'text-white'); 
        return; 
    }
    let chunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btn); 
    
    let playPromise = window.AyeshaAudio.audioObj.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => { console.log("Auto-play blocked."); });
    }
}

window.toggleVoiceMessage = function(btn) {
    if (window.AyeshaAudio.currentBtn === btn && window.AyeshaAudio.audioObj && !window.AyeshaAudio.audioObj.paused) {
        window.AyeshaAudio.audioObj.pause(); 
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        btn.classList.remove('bg-[#3a8ff7]', 'text-white'); 
        return;
    }
    window.stopAyeshaCompletely(); 
    window.AyeshaAudio.currentBtn = btn;
    let text = decodeURIComponent(btn.getAttribute('data-text'));
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(text) ? 'ur' : 'en';
    window.AyeshaAudio.queue = text.match(/.{1,150}(\s|$)|.{1,150}/g).filter(p => p.trim().length > 0);
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`; 
    btn.classList.add('bg-[#3a8ff7]', 'text-white'); 
    playCloudQueue(btn);
};

document.addEventListener('DOMContentLoaded', () => {
    input = document.getElementById('user-input'); 
    outPlus = document.getElementById('out-plus'); 
    outSend = document.getElementById('out-send'); 
    mainPill = document.getElementById('main-pill');
    inPlus = document.getElementById('in-plus'); 
    waveArea = document.getElementById('wave-area');
    inSend = document.getElementById('in-send'); 
    inMic = document.getElementById('in-mic');
    inCall = document.getElementById('in-call'); 
    
    let inEnd = document.getElementById('in-end'); 
    
    iMicNormal = document.getElementById('icon-mic-normal'); 
    iMicStop = document.getElementById('icon-mic-stop');
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    function updateUIState() {
        const text = input.value.trim();

        // 1. Reset
        outPlus.classList.add('btn-collapse'); outPlus.classList.remove('btn-expand');
        outSend.classList.add('btn-collapse'); outSend.classList.remove('btn-expand');
        inPlus.classList.add('btn-collapse');
        inSend.classList.add('btn-collapse');
        inMic.classList.add('btn-collapse');
        inCall.classList.add('btn-collapse');
        waveArea.classList.add('btn-collapse');
        
        mainPill.classList.remove('gemini-glow');
        input.classList.remove('btn-collapse');
        inMic.classList.remove('bg-red-500/20');
        iMicNormal.classList.remove('hidden');
        iMicStop.classList.add('hidden');

        // 2. آپ کے بتائے ہوئے رولز اپلائی کریں
        if (isCallActive) {
            // 🔴 لائیو کال کی حالت 🔴
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            input.classList.add('btn-collapse');
            waveArea.classList.remove('btn-collapse'); 
            
            // رول 1: اگر لائیو کال میں تصویر سلیکٹ کریں تو باہر جہاز آ جائے گا
            if (pendingImg) {
                outSend.classList.remove('btn-collapse'); outSend.classList.add('btn-expand');
            }
        } 
        else if (window.isAyeshaRecording) {
            // 🎤 مائیک چلنے کی حالت 🎤
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inMic.classList.remove('btn-collapse');
            inMic.classList.add('bg-red-500/20');
            iMicNormal.classList.add('hidden');
            iMicStop.classList.remove('hidden');
        } 
        else if (text.length > 0) {
            // ⌨️ رول 3: نارمل موڈ میں ٹائپنگ شروع ہو جائے تو مائیک غائب، اندر والا جہاز شو ⌨️
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inSend.classList.remove('btn-collapse');
        } 
        else if (pendingImg) {
            // 🖼️ رول 2: نارمل موڈ میں صرف تصویر سلیکٹ ہو (ٹائپنگ نہ ہو) تو مائیک ہی رہے گا 🖼️
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inMic.classList.remove('btn-collapse');
        }
        else {
            // 🏠 ڈیفالٹ نارمل موڈ 🏠
            inPlus.classList.remove('btn-collapse');
            inMic.classList.remove('btn-collapse');
            inCall.classList.remove('btn-collapse');
        }
    }

    input.addEventListener('input', updateUIState);

    const handlePlusClick = (e) => {
        e.preventDefault();
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); 
        else fileIn.click();
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick;

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); updateUIState();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; updateUIState(); };

    inMic.onclick = () => { 
        if(window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
            window.AndroidBridge.toggleInlineMic(); 
        }
    };

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(isRecording) { input.placeholder = "سن رہی ہوں..."; } 
        else { input.placeholder = "Ask something..."; }
        updateUIState();
    };

    window.updateInputFromJava = function(text, finalResult) {
        input.value = text;
        updateUIState();
        if(finalResult) {
            clearTimeout(voiceTimeout);
            voiceTimeout = setTimeout(() => { 
                if (input.value.trim().length > 0 || pendingImg) {
                    // اگر ٹیکسٹ ہو تو اندر والا جہاز کلک کرے گا، کال میں باہر والا
                    if(isCallActive && pendingImg) outSend.click();
                    else inSend.click(); 
                }
            }, 1500); 
        }
    };

    inCall.onclick = () => { isCallActive = true; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); };
    
    inEnd.onclick = () => { isCallActive = false; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); };
    
    const handleSendClick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            let imgUrl = pendingImg ? URL.createObjectURL(pendingImg) : null;
            addMessage(text || "تصویر بھیجی گئی", 'user', imgUrl);
            
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); 
            window.isAyeshaRecording = false;
            updateUIState();
            
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) 
            })
            .then(res => res.json()).then(d => { 
                document.getElementById('thinking-indicator').classList.add('hidden'); 
                let btn = addMessage(d.response, 'assistant');
                if(btn && !isCallActive) {
                    setTimeout(() => window.toggleVoiceMessage(btn), 500);
                }
            }).catch(e => { 
                document.getElementById('thinking-indicator').classList.add('hidden'); 
                addMessage("سرور آف لائن ہے۔", 'assistant'); 
            });
        }
    };
    inSend.onclick = handleSendClick; outSend.onclick = handleSendClick;
});

function addMessage(text, sender, imgUrl = null) {
    const chatBox = document.getElementById('chat-box'); 
    const msgDiv = document.createElement('div');
    
    let imgHTML = imgUrl ? `<img src="${imgUrl}" class="w-48 h-48 object-cover rounded-xl mb-3 border-2 border-[#3a8ff7] shadow-sm">` : '';

    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%] flex flex-col items-end">
            ${imgHTML}
            <p dir="auto">${text}</p>
        </div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        return null;
    } else {
        const enc = encodeURIComponent(text);
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]">
            ${imgHTML}
            <p dir="auto">${text}</p>
            <div class="flex items-center gap-3 mt-3">
                <button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7] text-[#3a8ff7] hover:bg-[#3a8ff7] hover:text-white transition-all cursor-pointer" data-text="${enc}" onclick="window.toggleVoiceMessage(this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
            </div>
        </div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        return msgDiv.querySelector('.gemini-speaker-btn');
    }
           }
        
