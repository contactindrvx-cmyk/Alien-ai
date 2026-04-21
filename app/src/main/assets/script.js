window.AyeshaAudio = { audioObj: null, queue: [], isPlaying: false, lang: 'ur' };
let isCallActive = false; 
let isCallMuted = false;
window.isAyeshaRecording = false;

// UI Elements
let inputNormal, outPlus, mainPill, inPlus, waveArea, inEnd, inSend, inMic, inCall;
let iMicNormal, iMicStop;
let inputCall, cgPlus, cgSend, cgMic, cgMicOn, cgMicOff, cgEnd, liveGlowBg;
let fileIn, preview, pendingImg = null, voiceTimeout;

let currentMsgId = null; 
let currentSentenceBuffer = "";

function processSentenceBuffer() {
    let cleanText = currentSentenceBuffer.trim();
    if (cleanText.length > 0) {
        // 🚨 کمانڈ کیچر 🚨
        let cmdMatch = cleanText.match(/\[ACTION:(.*?), DATA:(.*?)\]/);
        if (cmdMatch) {
            let action = cmdMatch[1];
            let actionData = cmdMatch[2];
            console.log("🔥 کمانڈ پکڑی گئی:", action, actionData);
            
            if (window.AndroidBridge && window.AndroidBridge.sendAccessibilityCommand) {
                window.AndroidBridge.sendAccessibilityCommand(action, actionData);
            }
            cleanText = cleanText.replace(/\[ACTION:.*\]/g, '').trim();
            if (currentMsgId) {
                let p = document.getElementById(currentMsgId);
                if(p) p.innerHTML = p.innerHTML.replace(/\[ACTION:.*\]/g, '');
            }
        }
        
        // 🗣️ آڈیو پلے بیک 🗣️
        if (cleanText) {
            window.AyeshaAudio.queue.push(cleanText);
            if (!window.AyeshaAudio.isPlaying) playCloudQueue(document.querySelector('.gemini-speaker-btn:last-child'));
        }
    }
    currentSentenceBuffer = "";
}

function playCloudQueue(btn) {
    if (!btn || window.AyeshaAudio.queue.length === 0) { 
        window.AyeshaAudio.isPlaying = false;
        if(btn) {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
            btn.classList.remove('bg-[#3a8ff7]', 'text-white'); 
        }
        
        // عائشہ کے چپ ہونے کے بعد مائیک دوبارہ کھولیں
        if (isCallActive && !isCallMuted && !window.isAyeshaRecording && window.AndroidBridge) {
             window.AndroidBridge.toggleInlineMic(); 
        }
        return; 
    }
    
    window.AyeshaAudio.isPlaying = true;
    
    // عائشہ بولے تو مائیک بند کر دیں تاکہ ایکو (Echo) نہ آئے
    if (window.isAyeshaRecording && window.AndroidBridge) {
        window.AndroidBridge.toggleInlineMic(); 
    }

    let chunk = window.AyeshaAudio.queue.shift();
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(chunk) ? 'ur' : 'en';
    window.AyeshaAudio.audioObj = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btn); 
    
    if(btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`; 
        btn.classList.add('bg-[#3a8ff7]', 'text-white'); 
    }

    let playPromise = window.AyeshaAudio.audioObj.play();
    if (playPromise !== undefined) playPromise.catch(error => { playCloudQueue(btn); });
}

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause(); 
    window.AyeshaAudio.queue = []; 
    window.AyeshaAudio.isPlaying = false;
    currentSentenceBuffer = "";
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { 
        b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        b.classList.remove('bg-[#3a8ff7]', 'text-white'); 
    });
};

document.addEventListener('DOMContentLoaded', () => {
    inputNormal = document.getElementById('user-input'); 
    outPlus = document.getElementById('out-plus'); 
    mainPill = document.getElementById('main-pill');
    inPlus = document.getElementById('in-plus'); 
    inSend = document.getElementById('in-send'); 
    inMic = document.getElementById('in-mic');
    inCall = document.getElementById('in-call'); 
    iMicNormal = document.getElementById('icon-mic-normal'); 
    iMicStop = document.getElementById('icon-mic-stop');

    inputCall = document.getElementById('cg-input');
    cgPlus = document.getElementById('cg-plus');
    cgSend = document.getElementById('cg-send');
    cgMic = document.getElementById('cg-mic');
    cgMicOn = document.getElementById('cg-mic-on');
    cgMicOff = document.getElementById('cg-mic-off');
    cgEnd = document.getElementById('cg-end');

    liveGlowBg = document.getElementById('live-glow-bg'); 
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    const normalBar = document.getElementById('normal-mode-bar');
    const callBar = document.getElementById('call-mode-bar');

    function updateUIState() {
        const activeInput = isCallActive ? inputCall : inputNormal;
        const text = activeInput.value.trim();

        if (isCallActive) {
            normalBar.classList.add('hidden'); normalBar.classList.remove('flex');
            callBar.classList.remove('hidden'); callBar.classList.add('flex');
            liveGlowBg.classList.add('show');

            if (text.length > 0 || pendingImg) {
                cgSend.classList.remove('hidden'); cgSend.classList.add('flex');
            } else {
                cgSend.classList.add('hidden'); cgSend.classList.remove('flex');
            }
            cgMicOn.classList.toggle('hidden', isCallMuted);
            cgMicOff.classList.toggle('hidden', !isCallMuted);
        } else {
            callBar.classList.add('hidden'); callBar.classList.remove('flex');
            normalBar.classList.remove('hidden'); normalBar.classList.add('flex');
            liveGlowBg.classList.remove('show');

            outPlus.classList.add('btn-collapse'); outPlus.classList.remove('btn-expand');
            inPlus.classList.add('btn-collapse'); inSend.classList.add('btn-collapse');
            inMic.classList.add('btn-collapse'); inCall.classList.add('btn-collapse');
            inputNormal.classList.remove('btn-collapse');
            inMic.classList.remove('bg-red-500/20'); iMicNormal.classList.remove('hidden'); iMicStop.classList.add('hidden');

            if (window.isAyeshaRecording) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
                inMic.classList.remove('btn-collapse'); inMic.classList.add('bg-red-500/20');
                iMicNormal.classList.add('hidden'); iMicStop.classList.remove('hidden');
            } 
            else if (text.length > 0) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
                inSend.classList.remove('btn-collapse');
            } 
            else if (pendingImg) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
                inMic.classList.remove('btn-collapse');
            } else {
                inPlus.classList.remove('btn-collapse'); inMic.classList.remove('btn-collapse'); inCall.classList.remove('btn-collapse');
            }
        }
    }

    inputNormal.addEventListener('input', (e) => { inputCall.value = e.target.value; updateUIState(); });
    inputCall.addEventListener('input', (e) => { inputNormal.value = e.target.value; updateUIState(); });

    const handlePlusClick = (e) => {
        e.preventDefault();
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); else fileIn.click();
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick; cgPlus.onclick = handlePlusClick;

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); updateUIState();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; updateUIState(); };

    inMic.onclick = () => { 
        if(!isCallActive && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
            window.AndroidBridge.toggleInlineMic(); 
        }
    };
    
    cgMic.onclick = () => { 
        isCallMuted = !isCallMuted; updateUIState(); 
        if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted); 
    };

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(isRecording) { inputNormal.placeholder = "سن رہی ہوں..."; } else { inputNormal.placeholder = "Ask something..."; }
        updateUIState();
    };

    // 🚨 آٹو سینڈ لاجک (وائس ریکارڈنگ کے فوراً بعد خود میسج بھیجے گا) 🚨
    window.updateInputFromJava = function(text, finalResult) {
        inputNormal.value = text; inputCall.value = text; updateUIState();
        if(finalResult) {
            clearTimeout(voiceTimeout);
            // یوزر کے چپ ہونے کے ٹھیک 1 سیکنڈ بعد بٹن خود کلک ہو جائے گا
            voiceTimeout = setTimeout(() => { 
                const activeInput = isCallActive ? inputCall : inputNormal;
                if (activeInput.value.trim().length > 0 || pendingImg) {
                    if (isCallActive) cgSend.click(); 
                    else inSend.click();
                }
            }, 1000); 
        }
    };

    inCall.onclick = () => { 
        isCallActive = true; isCallMuted = false; updateUIState(); 
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); 
        if(!window.isAyeshaRecording && window.AndroidBridge) window.AndroidBridge.toggleInlineMic();
    };
    
    cgEnd.onclick = () => { 
        isCallActive = false; window.stopAyeshaCompletely(); 
        inputNormal.value = ''; inputCall.value = ''; pendingImg = null; preview.classList.add('hidden'); fileIn.value = '';
        if(window.isAyeshaRecording && window.AndroidBridge) window.AndroidBridge.toggleInlineMic();
        updateUIState(); 
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); 
    };
    
    const handleSendClick = async (e) => {
        e.preventDefault(); 
        const activeInput = isCallActive ? inputCall : inputNormal; 
        const text = activeInput.value.trim();
        
        if (text || pendingImg) {
            let imgUrl = pendingImg ? URL.createObjectURL(pendingImg) : null;
            addMessage(text || "تصویر بھیجی گئی", 'user', imgUrl);
            
            inputNormal.value = ''; inputCall.value = ''; pendingImg = null; preview.classList.add('hidden'); window.isAyeshaRecording = false; updateUIState();
            
            document.getElementById('thinking-indicator').classList.remove('hidden');
            
            // 🚀 پرفیکٹ اور پکا HTTP Streaming Fetch 🚀
            try {
                // نوٹ: اپنے پائتھون سرور کا URL چیک کر لیں (chat_stream والا)
                const response = await fetch("https://aigrowthbox-ayesha-ai.hf.space/chat_stream", { 
                    method: "POST", headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) 
                });

                document.getElementById('thinking-indicator').classList.add('hidden'); 
                
                if (!response.body) throw new Error("No Data");

                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                
                currentMsgId = 'msg-' + Date.now();
                addMessage("", 'assistant', null, currentMsgId); 

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    let chunk = decoder.decode(value, { stream: true });
                    let textElement = document.getElementById(currentMsgId);
                    if (textElement) textElement.innerHTML += chunk;
                    
                    currentSentenceBuffer += chunk;
                    if (/[.?!۔؟]/.test(chunk) || chunk.includes('\n')) {
                        processSentenceBuffer();
                    }
                }
                processSentenceBuffer(); 
                currentMsgId = null;

            } catch (error) {
                document.getElementById('thinking-indicator').classList.add('hidden'); 
                addMessage("انٹرنیٹ یا سرور کا مسئلہ ہے، دوبارہ کوشش کریں۔", 'assistant'); 
            }
        }
    };
    inSend.onclick = handleSendClick; cgSend.onclick = handleSendClick;
});

function addMessage(text, sender, imgUrl = null, msgId = null) {
    const chatBox = document.getElementById('chat-box'); 
    const msgDiv = document.createElement('div');
    
    let imgHTML = imgUrl ? `<img src="${imgUrl}" class="w-48 h-48 object-cover rounded-xl mb-3 border-2 border-[#3a8ff7] shadow-sm">` : '';
    let idAttr = msgId ? `id="${msgId}"` : '';

    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%] flex flex-col items-end">${imgHTML}<p ${idAttr} dir="auto">${text}</p></div>`;
    } else {
        const enc = encodeURIComponent(text);
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]">${imgHTML}<p ${idAttr} dir="auto">${text}</p><div class="flex items-center gap-3 mt-3"><button class="gemini-speaker-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#3a8ff7] text-[#3a8ff7] hover:bg-[#3a8ff7] hover:text-white transition-all cursor-pointer" data-text="${enc}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button></div></div>`;
        
        let btn = msgDiv.querySelector('.gemini-speaker-btn');
        btn.onclick = function() {
            if (window.AyeshaAudio.isPlaying) { window.stopAyeshaCompletely(); return; }
            let fullText = msgDiv.querySelector('p').innerText;
            window.AyeshaAudio.queue.push(fullText);
            playCloudQueue(this);
        };
        return btn;
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    return null;
}
    
