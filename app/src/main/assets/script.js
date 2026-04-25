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
    'ur': { a: 'عائشہ', r: 'رضا', s: 'سارہ', x: 'ایلکس', title: 'آئیں بات کریں', cam: 'کیمرہ', gal: 'گیلری' },
    'ar': { a: 'عائشة', r: 'رضا', s: 'سارة', x: 'أليكس', title: 'دعنا نتحدث', cam: 'كاميرا', gal: 'معرض الصور' },
    'ru': { a: 'Аиша', r: 'Раза', s: 'Сара', x: 'Алекс', title: 'Давайте пообщаемся', cam: 'Камера', gal: 'Галерея' },
    'zh': { a: '艾莎', r: '拉扎', s: '莎拉', x: '亚历克斯', title: '我们聊天吧', cam: '相机', gal: '画廊' },
    'ja': { a: 'アイシャ', r: 'ラザ', s: 'サラ', x: 'アレックス', title: '話しましょう', cam: 'カメラ', gal: 'ギャラリー' },
    'es': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Hablemos', cam: 'Cámara', gal: 'Galería' },
    'en': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Let\'s chat', cam: 'Camera', gal: 'Gallery' }
};

// 🚀 گلوبل مینیو فنکشنز (بلٹ پروف کلک ہینڈلنگ) 🚀
window.closeAllMenus = function() {
    const pm = document.getElementById('profile-menu');
    const am = document.getElementById('assistant-menu');
    const atm = document.getElementById('attachment-menu');
    if(pm) pm.classList.add('hidden');
    if(am) am.classList.add('hidden');
    if(atm) atm.classList.add('hidden');
};

window.toggleProfileMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('profile-menu');
    if(!menu) return;
    const isHidden = menu.classList.contains('hidden');
    window.closeAllMenus();
    if(isHidden) menu.classList.remove('hidden');
};

window.toggleAssistantMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('assistant-menu');
    if(!menu) return;
    const isHidden = menu.classList.contains('hidden');
    window.closeAllMenus();
    if(isHidden) menu.classList.remove('hidden');
};

window.toggleAttachmentMenu = function(e) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('attachment-menu');
    if(!menu) return;
    const isHidden = menu.classList.contains('hidden');
    window.closeAllMenus();
    if(isHidden) menu.classList.remove('hidden');
};

window.selectAssistant = function(spanId) {
    const el = document.getElementById(spanId);
    if(el) {
        document.getElementById('current-assistant').innerText = el.innerText;
    }
    window.closeAllMenus();
};

window.triggerCamera = function(e) {
    if(e) e.stopPropagation();
    window.closeAllMenus();
    if(window.AndroidBridge && window.AndroidBridge.openCamera) {
        window.AndroidBridge.openCamera();
    } else {
        window.copyToClipboard("کیمرہ فنکشن");
    }
};

window.triggerGallery = function(e) {
    if(e) e.stopPropagation();
    window.closeAllMenus();
    if(window.AndroidBridge && window.AndroidBridge.openGallery) {
        window.AndroidBridge.openGallery();
    } else {
        const fi = document.getElementById('hidden-file-input');
        if(fi) fi.click();
    }
};

document.addEventListener('click', window.closeAllMenus);

document.addEventListener('DOMContentLoaded', () => {
    
    // لینگویج اپلائی کرنا (try-catch کے ساتھ تاکہ اگر کوئی آئی ڈی مس ہو تو کریش نہ ہو)
    try {
        const userLang = (navigator.language || navigator.userLanguage).substring(0, 2);
        const langData = translations[userLang] || translations['en']; 
        
        document.getElementById('ast-1').innerText = langData.a;
        document.getElementById('ast-2').innerText = langData.r;
        document.getElementById('ast-3').innerText = langData.s;
        document.getElementById('ast-4').innerText = langData.x;
        document.getElementById('current-assistant').innerText = langData.a; 
        document.getElementById('welcome-title').innerText = langData.title;
        document.getElementById('cam-text').innerText = langData.cam;
        document.getElementById('gal-text').innerText = langData.gal;
    } catch(e) { console.error(e); }

    // پرانے ایلیمنٹس
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
        const text = activeInput ? activeInput.value.trim() : "";

        if (isCallActive) {
            if(normalBar) { normalBar.classList.add('hidden'); normalBar.classList.remove('flex'); }
            if(callBar) { callBar.classList.remove('hidden'); callBar.classList.add('flex'); }
            if (text.length > 0 || pendingImg) { 
                if(cgSend) { cgSend.classList.remove('hidden'); cgSend.classList.add('flex'); }
            } else { 
                if(cgSend) { cgSend.classList.add('hidden'); cgSend.classList.remove('flex'); }
            }
            if(cgMicOn) cgMicOn.classList.toggle('hidden', isCallMuted); 
            if(cgMicOff) cgMicOff.classList.toggle('hidden', !isCallMuted);
        } else {
            if(callBar) { callBar.classList.add('hidden'); callBar.classList.remove('flex'); }
            if(normalBar) { normalBar.classList.remove('hidden'); normalBar.classList.add('flex'); }
            
            if(outPlus) { outPlus.classList.add('btn-collapse'); outPlus.classList.remove('btn-expand'); }
            if(inPlus) inPlus.classList.add('btn-collapse'); 
            if(inSend) inSend.classList.add('btn-collapse');
            if(inMic) inMic.classList.add('btn-collapse'); 
            if(inCall) inCall.classList.add('btn-collapse');
            if(inputNormal) inputNormal.classList.remove('btn-collapse');
            if(inMic) inMic.classList.remove('bg-red-500/20'); 
            if(iMicNormal) iMicNormal.classList.remove('hidden'); 
            if(iMicStop) iMicStop.classList.add('hidden');

            if (window.isAyeshaRecording) {
                if(outPlus) { outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand'); }
                if(inMic) { inMic.classList.remove('btn-collapse'); inMic.classList.add('bg-red-500/20'); }
                if(iMicNormal) iMicNormal.classList.add('hidden'); 
                if(iMicStop) iMicStop.classList.remove('hidden');
            } else if (text.length > 0) {
                if(outPlus) { outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand'); }
                if(inSend) inSend.classList.remove('btn-collapse');
            } else if (pendingImg) {
                if(outPlus) { outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand'); }
                if(inMic) inMic.classList.remove('btn-collapse');
            } else {
                if(inPlus) inPlus.classList.remove('btn-collapse'); 
                if(inMic) inMic.classList.remove('btn-collapse'); 
                if(inCall) inCall.classList.remove('btn-collapse');
            }
        }
    }

    if(inputNormal) inputNormal.addEventListener('input', (e) => { if(inputCall) inputCall.value = e.target.value; updateUIState(); });
    if(inputCall) inputCall.addEventListener('input', (e) => { if(inputNormal) inputNormal.value = e.target.value; updateUIState(); });

    // 🚀 کال بار میں ٹائپنگ اینیمیشن 🚀
    if(inputCall) {
        inputCall.addEventListener('focus', () => {
            if(cgMic) cgMic.classList.add('btn-collapse'); 
            if(cgEnd) cgEnd.classList.add('btn-collapse');
        });
        inputCall.addEventListener('blur', () => {
            setTimeout(() => { 
                if(cgMic) cgMic.classList.remove('btn-collapse'); 
                if(cgEnd) cgEnd.classList.remove('btn-collapse'); 
            }, 200); 
        });
    }

    if(fileIn) {
        fileIn.onchange = (e) => {
            if(e.target.files[0]) {
                pendingImg = e.target.files[0]; 
                document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
                if(preview) preview.classList.remove('hidden'); 
                updateUIState();
            }
        };
    }
    
    const rmImgBtn = document.getElementById('remove-img-btn');
    if(rmImgBtn) rmImgBtn.onclick = () => { pendingImg = null; if(preview) preview.classList.add('hidden'); if(fileIn) fileIn.value=''; updateUIState(); };
    
    if(inMic) inMic.onclick = () => { 
        if(!isCallActive && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); 
    };
    
    if(cgMic) cgMic.onclick = () => { 
        isCallMuted = !isCallMuted; updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted); 
    };

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(isRecording) { 
            if(inputNormal) inputNormal.placeholder = "سن رہی ہوں..."; 
        } else { 
            if(inputNormal) inputNormal.placeholder = "Ask something..."; 
            if (isCallActive && !isCallMuted) {
                if (!window.AyeshaAudio.isPlaying && !window.isAyeshaProcessing) {
                    setTimeout(() => {
                        if (isCallActive && !window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
                            window.AndroidBridge.toggleInlineMic();
                        }
                    }, 500); 
                }
            }
        }
        updateUIState();
    };

    window.updateInputFromJava = function(text, finalResult) {
        if(inputNormal) inputNormal.value = text; 
        if(inputCall) inputCall.value = text; 
        updateUIState();
        if(finalResult) {
            clearTimeout(voiceTimeout);
            voiceTimeout = setTimeout(() => { 
                const activeInput = isCallActive ? inputCall : inputNormal;
                if (activeInput && (activeInput.value.trim().length > 0 || pendingImg)) { 
                    if(isCallActive) { if(cgSend) cgSend.click(); } 
                    else { if(inSend) inSend.click(); } 
                }
            }, 1000); 
        }
    };

    if(inCall) inCall.onclick = () => { 
        isCallActive = true; isCallMuted = false; updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true); 
        if(!window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic();
    };
    
    if(cgEnd) cgEnd.onclick = () => { 
        isCallActive = false; window.stopAyeshaCompletely(); 
        if(inputNormal) inputNormal.value = ''; 
        if(inputCall) inputCall.value = ''; 
        pendingImg = null; 
        if(preview) preview.classList.add('hidden'); 
        if(fileIn) fileIn.value = '';
        if(window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); 
        updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false); 
    };

    window.onStreamStart = function() {
        const welcomeEl = document.getElementById('empty-chat-welcome');
        if(welcomeEl) welcomeEl.classList.add('hidden');
        
        const thinkInd = document.getElementById('thinking-indicator');
        if(thinkInd) thinkInd.classList.add('hidden');
        
        const chatBox = document.getElementById('chat-box'); 
        if(!chatBox) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'w-full flex flex-col items-end mt-4 mb-2 group pr-2';
        
        msgDiv.innerHTML = `
            <div class="text-right text-[1.1rem] leading-relaxed text-gray-100 max-w-[90%]" dir="rtl">
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
            if(chatBox) chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
    };

    window.onStreamEnd = function(fullText) {
        window.isAyeshaProcessing = false;
        processAIResponse(fullText, currentStreamBubble);
        currentStreamBubble = null;
    };

    window.onStreamError = function() {
        window.isAyeshaProcessing = false;
        const thinkInd = document.getElementById('thinking-indicator');
        if(thinkInd) thinkInd.classList.add('hidden');
        addMessage("سرور سے رابطہ ٹوٹ گیا ہے۔", 'assistant');
        currentStreamBubble = null;
    };

    window.addMessageFromJava = function(text) {
        if (text.startsWith("SCREEN_DATA||")) {
            let screenData = text.replace("SCREEN_DATA||", "");
            const thinkInd = document.getElementById('thinking-indicator');
            if(thinkInd) thinkInd.classList.remove('hidden');
            let promptMsg = "صارف کی سکرین پر اس وقت یہ سب لکھا ہے:\n" + screenData + "\n\n[SYSTEM WARNING: اب کوئی ایکشن کمانڈ مت دینا، صرف یہ پڑھ کر یوزر کو جواب دو کہ سکرین پر کیا ہے۔]";
            window.isAyeshaProcessing = true;
            if (window.AndroidBridge && window.AndroidBridge.sendNativeRequest) window.AndroidBridge.sendNativeRequest(promptMsg, "");
            return;
        }

        const thinkInd = document.getElementById('thinking-indicator');
        if(thinkInd) thinkInd.classList.add('hidden');
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
        const thinkInd = document.getElementById('thinking-indicator');
        if(thinkInd) thinkInd.classList.remove('hidden');
        let promptMsg = `[سکرین کا ڈیٹا موصول ہوا]\nسکرین کا ٹیکسٹ: ${screenText}\nتصویر: شامل ہے۔\nاب صرف اس ڈیٹا کی بنیاد پر صارف کو جواب دیں، کوئی نئی کمانڈ نہ دیں۔`;
        window.isAyeshaProcessing = true;
        if (window.AndroidBridge && window.AndroidBridge.sendNativeRequest) window.AndroidBridge.sendNativeRequest(promptMsg, base64Image);
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
            
            if(actionsContainer) {
                actionsContainer.innerHTML = `
                    <button onclick="window.copyToClipboard('${enc}')" class="text-gray-500 hover:text-[#3a8ff7] transition"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    <button class="gemini-speaker-btn text-gray-500 hover:text-[#3a8ff7] transition flex items-center" data-text="${enc}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
                `;
                actionsContainer.classList.remove('opacity-0');
                
                let btn = actionsContainer.querySelector('.gemini-speaker-btn');
                if(btn) {
                    btn.onclick = function() {
                        if (window.AyeshaAudio.isPlaying) { window.stopAyeshaCompletely(); return; }
                        playNativeAudio(cleanText, this);
                    };
                }

                if (!isCallActive && !isActionOnly) { playNativeAudio(cleanText, btn); }
            }

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
            if (isCallActive && !isCallMuted && !window.AyeshaAudio.isPlaying && !window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
                window.AndroidBridge.toggleInlineMic();
    
