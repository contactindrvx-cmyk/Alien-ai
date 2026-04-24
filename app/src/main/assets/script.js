window.AyeshaAudio = { isPlaying: false, activeBtn: null };
let isCallActive = false; 
let isCallMuted = false;
window.isAyeshaRecording = false;
window.isAyeshaProcessing = false;

// UI Elements
let inputNormal, outPlus, mainPill, inPlus, waveArea, inEnd, inSend, inMic, inCall;
let iMicNormal, iMicStop;
let inputCall, cgPlus, cgSend, cgMic, cgMicOn, cgMicOff, cgEnd;
let fileIn, preview, pendingImg = null, voiceTimeout;

let currentStreamBubble = null;
let fullStreamedText = "";

// 🚀 سمارٹ ملٹی لینگویج ڈکشنری 🚀
const translations = {
    'ur': { a: 'عائشہ', r: 'رضا', s: 'سارہ', x: 'ایلکس', title: 'آئیں بات کریں' },
    'ar': { a: 'عائشة', r: 'رضا', s: 'سارة', x: 'أليكس', title: 'دعنا نتحدث' },
    'ru': { a: 'Аиша', r: 'Раза', s: 'Сара', x: 'Алекс', title: 'Давайте пообщаемся' },
    'zh': { a: '艾莎', r: '拉扎', s: '莎拉', x: '亚历克斯', title: '我们聊天吧' },
    'ja': { a: 'アイシャ', r: 'ラザ', s: 'サラ', x: 'アレックス', title: '話しましょう' },
    'es': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Hablemos' },
    'en': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Let\'s chat' }
};

document.addEventListener('DOMContentLoaded', () => {
    
    // 🚀 لینگویج اپلائی کرنا 🚀
    const userLang = (navigator.language || navigator.userLanguage).substring(0, 2);
    const langData = translations[userLang] || translations['en']; 
    
    document.getElementById('ast-1').innerText = langData.a;
    document.getElementById('ast-2').innerText = langData.r;
    document.getElementById('ast-3').innerText = langData.s;
    document.getElementById('ast-4').innerText = langData.x;
    document.getElementById('current-assistant').innerText = langData.a; 
    document.getElementById('welcome-title').innerText = langData.title;

    // 🚀 ہیڈر بٹن لاجک (بلٹ پروف جاوا سکرپٹ کلک ایونٹس) 🚀
    const profileBtn = document.getElementById('profile-btn');
    const profileMenu = document.getElementById('profile-menu');
    const assistantBtn = document.getElementById('assistant-btn');
    const assistantMenu = document.getElementById('assistant-menu');

    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('hidden');
        assistantMenu.classList.add('hidden');
    });

    assistantBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        assistantMenu.classList.toggle('hidden');
        profileMenu.classList.add('hidden');
    });

    window.selectAssistant = function(spanId) {
        const text = document.getElementById(spanId).innerText;
        document.getElementById('current-assistant').innerText = text;
        assistantMenu.classList.add('hidden');
    };

    document.addEventListener('click', () => {
        profileMenu.classList.add('hidden');
        assistantMenu.classList.add('hidden');
    });

    // 🚀 باقی پرانا سسٹم 🚀
    inputNormal = document.getElementById('user-input'); outPlus = document.getElementById('out-plus'); 
    mainPill = document.getElementById('main-pill'); inPlus = document.getElementById('in-plus'); 
    inSend = document.getElementById('in-send'); inMic = document.getElementById('in-mic'); inCall = document.getElementById('in-call'); 
    iMicNormal = document.getElementById('icon-mic-normal'); iMicStop = document.getElementById('icon-mic-stop');
    inputCall = document.getElementById('cg-input'); cgPlus = document.getElementById('cg-plus');
    cgSend = document.getElementById('cg-send'); cgMic = document.getElementById('cg-mic');
    cgMicOn = document.getElementById('cg-mic-on'); cgMicOff = document.getElementById('cg-mic-off'); cgEnd = document.getElementById('cg-end');
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    const normalBar = document.getElementById('normal-mode-bar'); const callBar = document.getElementById('call-mode-bar');

    function updateUIState() {
        const activeInput = isCallActive ? inputCall : inputNormal;
        const text = activeInput.value.trim();

        if (isCallActive) {
            normalBar.classList.add('hidden'); normalBar.classList.remove('flex');
            callBar.classList.remove('hidden'); callBar.classList.add('flex');
            if (text.length > 0 || pendingImg) { cgSend.classList.remove('hidden'); cgSend.classList.add('flex'); } 
            else { cgSend.classList.add('hidden'); cgSend.classList.remove('flex'); }
            if(cgMicOn) cgMicOn.classList.toggle('hidden', isCallMuted); 
            if(cgMicOff) cgMicOff.classList.toggle('hidden', !isCallMuted);
        } else {
            callBar.classList.add('hidden'); callBar.classList.remove('flex');
            normalBar.classList.remove('hidden'); normalBar.classList.add('flex');
            outPlus.classList.add('btn-collapse'); outPlus.classList.remove('btn-expand');
            inPlus.classList.add('btn-collapse'); inSend.classList.add('btn-collapse');
            inMic.classList.add('btn-collapse'); inCall.classList.add('btn-collapse');
            inputNormal.classList.remove('btn-collapse');
            inMic.classList.remove('bg-red-500/20'); iMicNormal.classList.remove('hidden'); iMicStop.classList.add('hidden');

            if (window.isAyeshaRecording) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
                inMic.classList.remove('btn-collapse'); inMic.classList.add('bg-red-500/20');
                iMicNormal.classList.add('hidden'); iMicStop.classList.remove('hidden');
            } else if (text.length > 0) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand'); inSend.classList.remove('btn-collapse');
            } else if (pendingImg) {
                outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand'); inMic.classList.remove('btn-collapse');
            } else {
                inPlus.classList.remove('btn-collapse'); inMic.classList.remove('btn-collapse'); inCall.classList.remove('btn-collapse');
            }
        }
    }

    inputNormal.addEventListener('input', (e) => { inputCall.value = e.target.value; updateUIState(); });
    if(inputCall) inputCall.addEventListener('input', (e) => { inputNormal.value = e.target.value; updateUIState(); });

    // 🚀 کال بار میں ٹائپنگ اینیمیشن (Mic اور End غائب ہوں گے) 🚀
    if(inputCall) {
        inputCall.addEventListener('focus', () => {
            cgMic.classList.add('btn-collapse');
            cgEnd.classList.add('btn-collapse');
        });
        inputCall.addEventListener('blur', () => {
            setTimeout(() => {
                cgMic.classList.remove('btn-collapse');
                cgEnd.classList.remove('btn-collapse');
            }, 200); 
        });
    }

    const handlePlusClick = (e) => {
        e.preventDefault();
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); else fileIn.click();
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick; if(cgPlus) cgPlus.onclick = handlePlusClick;

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0]; document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); updateUIState();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; updateUIState(); };
    
    inMic.onclick = () => { 
        if(!isCallActive && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); 
    };
    
    if(cgMic) cgMic.onclick = () => { 
        isCallMuted = !isCallMuted; updateUIState(); 
        if(window.AndroidBridge) window.AndroidBridge.muteCall(isCallMuted); 
    };

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(isRecording) { 
            inputNormal.placeholder = "سن رہی ہوں..."; 
        } else { 
            inputNormal.placeholder = "کچھ پوچھیں..."; 
            if (isCallActive && !isCallMuted) {
                if (!window.AyeshaAudio.isPlaying && !window.isAyeshaProcessing) {
                    setTimeout(() => {
                        if (isCallActive && !window.isAyeshaRecording && window.AndroidBridge) {
                            window.AndroidBridge.toggleInlineMic();
                        }
                    }, 500); 
                }
            }
        }
        updateUIState();
    };

    window.updateInputFromJava = function(text, finalResult) {
        inputNormal.value = text; if(inputCall) inputCall.value = text; updateUIState();
        if(finalResult) {
            clearTimeout(voiceTimeout);
            voiceTimeout = setTimeout(() => { 
                const activeInput = isCallActive ? inputCall : inputNormal;
                if (activeInput.value.trim().length > 0 || pendingImg) { if(isCallActive) { if(cgSend) cgSend.click(); } else inSend.click(); }
            }, 1000); 
        }
    };

    inCall.onclick = () => { 
        isCallActive = true; isCallMuted = false; updateUIState(); 
        if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); 
        if(!window.isAyeshaRecording && window.AndroidBridge) window.AndroidBridge.toggleInlineMic();
    };
    
    if(cgEnd) cgEnd.onclick = () => { 
        isCallActive = false; window.stopAyeshaCompletely(); 
        inputNormal.value = ''; if(inputCall) inputCall.value = ''; pendingImg = null; preview.classList.add('hidden'); fileIn.value = '';
        if(window.isAyeshaRecording && window.AndroidBridge) window.AndroidBridge.toggleInlineMic(); 
        updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); 
    };

    window.onStreamStart = function() {
        document.getElementById('empty-chat-welcome').classList.add('hidden'); // پہلا میسج آنے پر سینٹر ٹیکسٹ غائب
        document.getElementById('thinking-indicator').classList.add('hidden');
        const chatBox = document.getElementById('chat-box'); 
        const msgDiv = document.createElement('div');
        msgDiv.className = 'w-full flex flex-col items-end mt-4 mb-2 group pr-2';
        
        msgDiv.innerHTML = `
            <div class="ai-text-container text-right text-[1.1rem] leading-relaxed text-gray-100 max-w-[90%]" dir="rtl">
                <span id="streaming-text-target" class="typing-cursor"></span>
            </div>
            <div class="action-buttons-container flex items-center gap-4 mt-2 opacity-0 transition-opacity duration-500"></div>
        `;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); 
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        
        currentStreamBubble = msgDiv.querySelector('#streaming-text-target');
        fullStreamedText = "";
    };

    window.onStreamChunk = function(chunk) {
        if (currentStreamBubble) {
            fullStreamedText += chunk;
            if (!fullStreamedText.includes("[ACTION:")) {
                currentStreamBubble.innerText = fullStreamedText;
            }
            const chatBox = document.getElementById('chat-box');
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
    };

    window.onStreamEnd = function(fullText) {
        window.isAyeshaProcessing = false;
        processAIResponse(fullText, currentStreamBubble);
        currentStreamBubble = null;
    };

    window.onStreamError = function() {
        window.isAyeshaProcessing = false;
        document.getElementById('thinking-indicator').classList.add('hidden');
        addMessage("سرور سے رابطہ ٹوٹ گیا ہے۔", 'assistant');
        currentStreamBubble = null;
    };

    window.addMessageFromJava = function(text) {
        if (text.startsWith("SCREEN_DATA||")) {
            let screenData = text.replace("SCREEN_DATA||", "");
            document.getElementById('thinking-indicator').classList.remove('hidden');
            let promptMsg = "صارف کی سکرین پر اس وقت یہ سب لکھا ہے:\n" + screenData + "\n\n[SYSTEM WARNING: اب کوئی ایکشن کمانڈ مت دینا، صرف یہ پڑھ کر یوزر کو جواب دو کہ سکرین پر کیا ہے۔]";
            window.isAyeshaProcessing = true;
            if (window.AndroidBridge) window.AndroidBridge.sendNativeRequest(promptMsg, "");
            return;
        }

        document.getElementById('thinking-indicator').classList.add('hidden');
        let cleanText = text.replace(/\[ACTION:.*?\]/gi, '').trim();
        if (cleanText.length > 0) {
            let btn = addMessage(cleanText, 'assistant');
            if(btn && !isCallActive) { playNativeAudio(cleanText, btn); }
        }
    };

    window.analyzeScreen = function() {
        let base64Image = ""; let screenText = "";
        if (window.AndroidBridge) {
            if (window.AndroidBridge.pullScreenshot) base64Image = window.AndroidBridge.pullScreenshot();
            if (window.AndroidBridge.pullScreenText) screenText = window.AndroidBridge.pullScreenText();
        }
        document.getElementById('thinking-indicator').classList.remove('hidden');
        let promptMsg = `[سکرین کا ڈیٹا موصول ہوا]\nسکرین کا ٹیکسٹ: ${screenText}\nتصویر: شامل ہے۔\nاب صرف اس ڈیٹا کی بنیاد پر صارف کو جواب دیں، کوئی نئی کمانڈ نہ دیں۔`;
        window.isAyeshaProcessing = true;
        if (window.AndroidBridge) window.AndroidBridge.sendNativeRequest(promptMsg, base64Image);
    };
    
    function processAIResponse(cleanText, existingBubble = null) {
        let cmdMatch = cleanText.match(/\[ACTION:\s*(.*?)(?:,\s*DATA:\s*(.*?))?\]/i);
        let action = ""; let actionData = "none";
        
        if (cmdMatch) {
            action = cmdMatch[1] ? cmdMatch[1].trim() : "";
            actionData = cmdMatch[2] ? cmdMatch[2].trim() : "none";
            if (action.includes("||") && !action.includes("MULTI_TASK")) { actionData = action; action = "MULTI_TASK"; }
            if (window.AndroidBridge && window.AndroidBridge.sendAccessibilityCommand) {
                window.AndroidBridge.sendAccessibilityCommand(action, actionData);
            }
        }
        
        cleanText = cleanText.replace(/\[ACTION:.*?\]/gi, '').trim();

        if (action === "ANALYZE_SCREEN" || action === "TAKE_SCREENSHOT" || action === "READ_SCREEN") {
            if (existingBubble) existingBubble.closest('.group').remove(); 
            return; 
        }

        let isActionOnly = false;
        if (cleanText === "") {
            cleanText = "جی ٹھیک ہے، میں کر رہی ہوں۔";
            isActionOnly = true; 
        }

        if (existingBubble) {
            existingBubble.innerText = cleanText;
            existingBubble.classList.remove('typing-cursor');
            
            const enc = encodeURIComponent(cleanText);
            const actionsContainer = existingBubble.closest('.group').querySelector('.action-buttons-container');
            
            actionsContainer.innerHTML = `
                <button onclick="window.copyToClipboard('${enc}')" class="text-gray-500 hover:text-[#3a8ff7] transition"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                <button class="gemini-speaker-btn text-gray-500 hover:text-[#3a8ff7] transition flex items-center" data-text="${enc}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
            `;
            actionsContainer.classList.remove('opacity-0');
            
            let btn = actionsContainer.querySelector('.gemini-speaker-btn');
            btn.onclick = function() {
                if (window.AyeshaAudio.isPlaying) { window.stopAyeshaCompletely(); return; }
                playNativeAudio(cleanText, this);
            };

            if (!isCallActive && !isActionOnly) { playNativeAudio(cleanText, btn); }

        } else {
            let btn = addMessage(cleanText, 'assistant');
            if (btn && !isCallActive && !isActionOnly) { playNativeAudio(cleanText, btn); }
        }

        if (isActionOnly) {
            if (window.AndroidBridge && window.AndroidBridge.speakText) {
                window.AyeshaAudio.isPlaying = true;
                window.AndroidBridge.speakText(cleanText);
            }
        } else {
            if (isCallActive && !isCallMuted && !window.AyeshaAudio.isPlaying && !window.isAyeshaRecording && window.AndroidBridge) {
                window.AndroidBridge.toggleInlineMic();
            }
        }
    }

    const handleSendClick = (e) => {
        e.preventDefault(); 
        const activeInput = isCallActive ? inputCall : inputNormal; 
        const text = activeInput.value.trim();
        
        if (text || pendingImg) {
            let imgUrl = pendingImg ? URL.createObjectURL(pendingImg) : null;
            let currentB64 = "";
            
            if (pendingImg) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    currentB64 = reader.result.split(',')[1];
                    addMessage(text || "Image sent", 'user', imgUrl);
                    inputNormal.value = ''; if(inputCall) inputCall.value = ''; pendingImg = null; preview.classList.add('hidden'); window.isAyeshaRecording = false; updateUIState();
                    document.getElementById('thinking-indicator').classList.remove('hidden');
                    window.isAyeshaProcessing = true;
                    if (window.AndroidBridge) window.AndroidBridge.sendNativeRequest(text, currentB64);
                };
                reader.readAsDataURL(pendingImg);
            } else {
                addMessage(text, 'user', null);
                inputNormal.value = ''; if(inputCall) inputCall.value = ''; window.isAyeshaRecording = false; updateUIState();
                document.getElementById('thinking-indicator').classList.remove('hidden');
                window.isAyeshaProcessing = true;
                if (window.AndroidBridge) window.AndroidBridge.sendNativeRequest(text, "");
            }
        }
    };
    inSend.onclick = handleSendClick; 
    if(cgSend) cgSend.onclick = handleSendClick;

    // کی بورڈ انٹر
    inputNormal.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSendClick(e);
        }
    });
});

window.playNativeAudio = function(text, btn) {
    window.AyeshaAudio.isPlaying = true;
    window.AyeshaAudio.activeBtn = btn;

    if (btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`; 
        btn.classList.add('text-[#3a8ff7]'); 
    }
    if (window.AndroidBridge && window.AndroidBridge.speakText) {
        window.AndroidBridge.speakText(text);
    }
}

function addMessage(text, sender, imgUrl = null) {
    document.getElementById('empty-chat-welcome').classList.add('hidden'); // 🚀 پہلا میسج آنے پر سینٹر ٹیکسٹ غائب 🚀
    const chatBox = document.getElementById('chat-box'); 
    const msgDiv = document.createElement('div');
    let imgHTML = imgUrl ? `<img src="${imgUrl}" class="w-48 h-48 object-cover rounded-xl mb-3 border-2 border-[#3a8ff7] shadow-sm">` : '';

    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4 mb-2';
        msgDiv.innerHTML = `<div class="chat-bubble bg-[#2f3037] p-3 rounded-2xl max-w-[85%] flex flex-col items-end text-[1.05rem] text-gray-200 shadow-md" dir="rtl">${imgHTML}<p dir="auto">${text}</p></div>`;
        chatBox
