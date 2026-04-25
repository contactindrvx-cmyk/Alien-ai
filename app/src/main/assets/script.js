// 🚀 گلوبل ویری ایبلز 🚀
window.AyeshaAudio = { isPlaying: false, activeBtn: null };
let isCallActive = false; 
let isCallMuted = false;
window.isAyeshaRecording = false;
window.isAyeshaProcessing = false;
let pendingImg = null;
let voiceTimeout;
let currentStreamBubble = null;
let fullStreamedText = "";

// 🚀 سمارٹ ملٹی لینگویج ڈکشنری 🚀
const translations = {
    'ur': { a: 'عائشہ', r: 'رضا', s: 'سارہ', x: 'ایلکس', title: 'آئیں بات کریں', cam: 'کیمرہ', gal: 'گیلری' },
    'en': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Let\'s chat', cam: 'Camera', gal: 'Gallery' }
};

document.addEventListener('DOMContentLoaded', () => {
    // لینگویج اپلائی (Safe Mode)
    try {
        const userLang = (navigator.language || navigator.userLanguage || 'en').substring(0, 2);
        const langData = translations[userLang] || translations['en']; 
        
        if(document.getElementById('ast-1')) document.getElementById('ast-1').innerText = langData.a;
        if(document.getElementById('ast-2')) document.getElementById('ast-2').innerText = langData.r;
        if(document.getElementById('ast-3')) document.getElementById('ast-3').innerText = langData.s;
        if(document.getElementById('ast-4')) document.getElementById('ast-4').innerText = langData.x;
        if(document.getElementById('current-assistant')) document.getElementById('current-assistant').innerText = langData.a; 
        if(document.getElementById('welcome-title')) document.getElementById('welcome-title').innerText = langData.title;
        if(document.getElementById('cam-text')) document.getElementById('cam-text').innerText = langData.cam;
        if(document.getElementById('gal-text')) document.getElementById('gal-text').innerText = langData.gal;
    } catch(e) { console.error("Language Setup Error:", e); }
    
    window.updateUIState();
});

// ==========================================
// 🚀 1. مینیو اور ہیڈر کنٹرولز (Global) 🚀
// ==========================================
window.closeAllMenus = function() {
    const profileMenu = document.getElementById('profile-menu');
    const assistantMenu = document.getElementById('assistant-menu');
    const attachmentMenu = document.getElementById('attachment-menu');
    const assistantArrow = document.getElementById('assistant-arrow');
    
    if(profileMenu) profileMenu.style.display = 'none';
    if(assistantMenu) assistantMenu.style.display = 'none';
    if(attachmentMenu) attachmentMenu.style.display = 'none';
    if(assistantArrow) assistantArrow.style.transform = 'rotate(0deg)';
};

window.toggleProfileMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('profile-menu');
    if(!menu) return;
    const isHidden = (menu.style.display === 'none' || menu.style.display === '');
    window.closeAllMenus();
    if(isHidden) menu.style.display = 'block';
};

window.toggleAssistantMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('assistant-menu');
    const arrow = document.getElementById('assistant-arrow');
    if(!menu) return;
    const isHidden = (menu.style.display === 'none' || menu.style.display === '');
    window.closeAllMenus();
    if(isHidden) {
        menu.style.display = 'block';
        if(arrow) arrow.style.transform = 'rotate(180deg)';
    }
};

window.toggleAttachmentMenu = function(e) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('attachment-menu');
    if(!menu) {
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); 
        else { const fi = document.getElementById('hidden-file-input'); if(fi) fi.click(); }
        return;
    }
    const isHidden = (menu.style.display === 'none' || menu.style.display === '');
    window.closeAllMenus();
    if(isHidden) menu.style.display = 'block';
};

window.selectAssistant = function(id, e) {
    if(e) e.stopPropagation();
    const el = document.getElementById(id);
    if(el) {
        const nameStr = el.innerText.trim().split(' ')[0];
        const currAsst = document.getElementById('current-assistant');
        if(currAsst) currAsst.innerText = nameStr;
    }
    window.closeAllMenus();
};

window.triggerPayment = function(e) {
    if(e) e.stopPropagation();
    window.closeAllMenus();
    if(window.AndroidBridge && window.AndroidBridge.startPayment) window.AndroidBridge.startPayment();
};

// ==========================================
// 🚀 2. کیمرہ، گیلری اور امیج کنٹرولز 🚀
// ==========================================
window.triggerCamera = function(e) {
    if(e) e.stopPropagation();
    window.closeAllMenus();
    if(window.AndroidBridge && window.AndroidBridge.openCamera) window.AndroidBridge.openCamera();
};

window.triggerGallery = function(e) {
    if(e) e.stopPropagation();
    window.closeAllMenus();
    if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery();
    else { const fi = document.getElementById('hidden-file-input'); if(fi) fi.click(); }
};

window.handleFileChange = function(e) {
    if(e.target.files && e.target.files[0]) {
        pendingImg = e.target.files[0];
        const preview = document.getElementById('preview-img');
        const previewCont = document.getElementById('image-preview-container');
        if(preview) preview.src = URL.createObjectURL(pendingImg);
        if(previewCont) previewCont.classList.remove('hidden');
        window.updateUIState();
    }
};

window.removeImage = function(e) {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    pendingImg = null;
    const previewCont = document.getElementById('image-preview-container');
    const fileIn = document.getElementById('hidden-file-input');
    if(previewCont) previewCont.classList.add('hidden');
    if(fileIn) fileIn.value = '';
    window.updateUIState();
};

// ==========================================
// 🚀 3. ان پٹ اور UI اپڈیٹ کنٹرولز 🚀
// ==========================================
window.syncInputs = function(val) {
    const inputNormal = document.getElementById('user-input');
    const inputCall = document.getElementById('cg-input');
    if(inputNormal && inputNormal.value !== val) inputNormal.value = val;
    if(inputCall && inputCall.value !== val) inputCall.value = val;
    window.updateUIState();
};

window.handleInputFocus = function() {
    const cgMic = document.getElementById('cg-mic');
    const cgEnd = document.getElementById('cg-end');
    if(cgMic) cgMic.classList.add('btn-collapse');
    if(cgEnd) cgEnd.classList.add('btn-collapse');
};

window.handleInputBlur = function() {
    setTimeout(() => {
        const cgMic = document.getElementById('cg-mic');
        const cgEnd = document.getElementById('cg-end');
        if(cgMic) cgMic.classList.remove('btn-collapse');
        if(cgEnd) cgEnd.classList.remove('btn-collapse');
    }, 200);
};

window.handleKeyPress = function(e) {
    if (e.key === 'Enter') {
        window.handleSendClick(e);
    }
};

window.updateUIState = function() {
    try {
        const inputNormal = document.getElementById('user-input');
        const inputCall = document.getElementById('cg-input');
        const activeInput = isCallActive ? inputCall : inputNormal;
        const text = activeInput ? activeInput.value.trim() : "";

        const normalBar = document.getElementById('normal-mode-bar');
        const callBar = document.getElementById('call-mode-bar');
        const cgSend = document.getElementById('cg-send');
        const cgMicOn = document.getElementById('cg-mic-on');
        const cgMicOff = document.getElementById('cg-mic-off');
        const outPlus = document.getElementById('out-plus');
        const inPlus = document.getElementById('in-plus');
        const inSend = document.getElementById('in-send');
        const inMic = document.getElementById('in-mic');
        const inCall = document.getElementById('in-call');
        const iMicNormal = document.getElementById('icon-mic-normal');
        const iMicStop = document.getElementById('icon-mic-stop');

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
    } catch (e) { console.error("UI Update Error:", e); }
};
                                                                                     // ==========================================
// 🚀 4. چیٹ اور کال ایکشنز (سینڈ، مائیک، کال) 🚀
// ==========================================

window.handleSendClick = function(e) {
    if(e) e.preventDefault(); 
    const activeInput = isCallActive ? document.getElementById('cg-input') : document.getElementById('user-input');
    const text = activeInput ? activeInput.value.trim() : "";
    
    if (text || pendingImg) {
        let imgUrl = pendingImg ? URL.createObjectURL(pendingImg) : null;
        let currentB64 = "";
        
        if (pendingImg) {
            const reader = new FileReader();
            reader.onloadend = function() {
                currentB64 = reader.result.split(',')[1];
                window.addMessage(text || "تصویر بھیجی گئی", 'user', imgUrl);
                window.clearInputsAndSend(text, currentB64);
            };
            reader.readAsDataURL(pendingImg);
        } else {
            window.addMessage(text, 'user', null);
            window.clearInputsAndSend(text, "");
        }
    }
};

window.clearInputsAndSend = function(text, b64) {
    const inputNormal = document.getElementById('user-input');
    const inputCall = document.getElementById('cg-input');
    if(inputNormal) inputNormal.value = ''; 
    if(inputCall) inputCall.value = ''; 
    
    pendingImg = null; 
    const previewCont = document.getElementById('image-preview-container');
    if(previewCont) previewCont.classList.add('hidden'); 
    
    window.isAyeshaRecording = false; 
    window.updateUIState();
    
    const thinkInd = document.getElementById('thinking-indicator');
    if(thinkInd) thinkInd.classList.remove('hidden');
    window.isAyeshaProcessing = true;
    
    // 🚨 یہ کمانڈ آپ کا میسج سیدھا عائشہ کو بھیجتی ہے 🚨
    if (window.AndroidBridge && window.AndroidBridge.sendNativeRequest) {
        window.AndroidBridge.sendNativeRequest(text, b64);
    }
};

window.handleMicClick = function(e) {
    if(e) e.preventDefault();
    window.isAyeshaRecording = !window.isAyeshaRecording;
    window.updateUIState();

    if(!isCallActive && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
        window.AndroidBridge.toggleInlineMic(); 
    }
};

window.handleCallClick = function(e) {
    if(e) e.preventDefault();
    isCallActive = true; 
    isCallMuted = false; 
    window.updateUIState(); 
    if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true); 
    if(!window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
        window.AndroidBridge.toggleInlineMic();
    }
};

window.handleMicMute = function(e) {
    if(e) e.preventDefault();
    isCallMuted = !isCallMuted; 
    window.updateUIState(); 
    if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted); 
};

window.handleEndCall = function(e) {
    if(e) e.preventDefault();
    isCallActive = false; 
    window.stopAyeshaCompletely(); 
    
    const inputNormal = document.getElementById('user-input');
    const inputCall = document.getElementById('cg-input');
    if(inputNormal) inputNormal.value = ''; 
    if(inputCall) inputCall.value = ''; 
    
    pendingImg = null; 
    const previewCont = document.getElementById('image-preview-container');
    if(previewCont) previewCont.classList.add('hidden'); 
    
    const fileIn = document.getElementById('hidden-file-input');
    if(fileIn) fileIn.value = '';
    
    window.isAyeshaRecording = false;
    
    if(window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
        window.AndroidBridge.toggleInlineMic(); 
    }
    window.updateUIState(); 
    if(window.AndroidBridge && window.AndroidBridge.toggleCall) {
        window.AndroidBridge.toggleCall(false); 
    }
};

// ==========================================
// 🚀 5. سٹریمنگ، ٹائپ رائٹر اور آڈیو کنٹرولز 🚀
// ==========================================

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
};

window.onSpeechDone = function() {
    window.AyeshaAudio.isPlaying = false;
    let btn = window.AyeshaAudio.activeBtn;
    if (btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        btn.classList.remove('text-[#3a8ff7]'); 
    }
    if (isCallActive && !isCallMuted && !window.isAyeshaRecording && !window.isAyeshaProcessing && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
        window.AndroidBridge.toggleInlineMic(); 
    }
};

window.stopAyeshaCompletely = function() {
    window.AyeshaAudio.isPlaying = false;
    if (window.AndroidBridge && window.AndroidBridge.stopSpeaking) {
        window.AndroidBridge.stopSpeaking();
    }
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => { 
        b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`; 
        b.classList.remove('text-[#3a8ff7]'); 
    });
};

window.copyToClipboard = function(encodedText) {
    const text = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(text);
    const toast = document.getElementById('top-toast');
    if(toast) {
        document.getElementById('toast-text').innerText = "Copied!";
        toast.classList.remove('opacity-0', '-translate-y-10');
        setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); }, 2000);
    }
};

window.onStreamStart = function() {
    const welcomeEl = document.getElementById('empty-chat-welcome');
    if(welcomeEl) welcomeEl.style.display = 'none';
    
    const thinkInd = document.getElementById('thinking-indicator');
    if(thinkInd) thinkInd.classList.add('hidden');
    
    const chatBox = document.getElementById('chat-box'); 
    if(!chatBox) return;

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
        if(chatBox) chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }
};

window.onStreamEnd = function(fullText) {
    window.isAyeshaProcessing = false;
    window.processAIResponse(fullText, currentStreamBubble);
    currentStreamBubble = null;
};

window.onStreamError = function() {
    window.isAyeshaProcessing = false;
    const thinkInd = document.getElementById('thinking-indicator');
    if(thinkInd) thinkInd.classList.add('hidden');
    if(window.addMessage) window.addMessage("سرور سے رابطہ ٹوٹ گیا ہے۔", 'assistant'); 
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
        if(window.addMessage) {
            let btn = window.addMessage(cleanText, 'assistant');
            if(btn && !isCallActive) { window.playNativeAudio(cleanText, btn); }
        }
    }
};

window.analyzeScreen = function() {
    let base64Image = ""; let screenText = "";
    if (window.AndroidBridge) {
        if (window.AndroidBridge.pullScreenshot) base64Image = window.AndroidBridge.pullScreenshot();
        if (window.AndroidBridge.pullScreenText) screenText = window.AndroidBridge.pullScreenText();
        
        if (window.AndroidBridge.sendNativeRequest) {
            window.isAyeshaProcessing = true;
            const thinkInd = document.getElementById('thinking-indicator');
            if(thinkInd) thinkInd.classList.remove('hidden');
            window.AndroidBridge.sendNativeRequest("[سکرین کا ڈیٹا موصول ہوا]\nسکرین کا ٹیکسٹ: " + screenText + "\nاب اس ڈیٹا کی بنیاد پر صارف کو جواب دیں۔", base64Image);
        }
    }
};

window.processAIResponse = function(cleanText, existingBubble = null) {
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
                    window.playNativeAudio(cleanText, this);
                };
            }

            if (!isCallActive && !isActionOnly) { window.playNativeAudio(cleanText, btn); }
        }

    } else {
        if(window.addMessage) {
            let btn = window.addMessage(cleanText, 'assistant');
            if (btn && !isCallActive && !isActionOnly) { window.playNativeAudio(cleanText, btn); }
        }
    }

    if (isActionOnly) {
        if (window.AndroidBridge && window.AndroidBridge.speakText) {
            window.AyeshaAudio.isPlaying = true;
            window.AndroidBridge.speakText(cleanText);
        }
    } else {
        if (isCallActive && !isCallMuted && !window.AyeshaAudio.isPlaying && !window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
            window.AndroidBridge.toggleInlineMic();
        }
    }
};

window.addMessage = function(text, sender, imgUrl = null) {
    const welcomeEl = document.getElementById('empty-chat-welcome');
    if(welcomeEl) welcomeEl.style.display = 'none'; 
    
    const chatBox = document.getElementById('chat-box'); 
    if(!chatBox) return null;

    const msgDiv = document.createElement('div');
    let imgHTML = imgUrl ? `<img src="${imgUrl}" class="w-48 h-48 object-cover rounded-xl mb-3 border-2 border-[#3a8ff7] shadow-sm">` : '';

    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4 mb-2';
        msgDiv.innerHTML = `<div class="chat-bubble bg-[#2f3037] p-3 rounded-2xl max-w-[85%] flex flex-col items-end text-[1.05rem] text-gray-200 shadow-md" dir="rtl">${imgHTML}<p dir="auto">${text}</p></div>`;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); 
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        return null;
    } else {
        const enc = encodeURIComponent(text);
        msgDiv.className = 'w-full flex flex-col items-end mt-4 mb-2 group pr-2';
        
        msgDiv.innerHTML = `
            <div class="ai-text-container typing-cursor text-right text-[1.1rem] leading-relaxed text-gray-100 max-w-[90%]" dir="rtl">
                ${imgHTML}<span id="text-node"></span>
            </div>
            <div class="action-buttons-container flex items-center gap-4 mt-2 opacity-0 transition-opacity duration-500">
                <button onclick="window.copyToClipboard('${enc}')" class="text-gray-500 hover:text-[#3a8ff7] transition"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                <button class="gemini-speaker-btn text-gray-500 hover:text-[#3a8ff7] transition flex items-center" data-text="${enc}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
            </div>
        `;
        chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator')); 
        
        let textNode = msgDiv.querySelector('#text-node');
        let actionsDiv = msgDiv.querySelector('.action-buttons-container');
        let btn = msgDiv.querySelector('.gemini-speaker-btn');
        
        if(btn) {
            btn.onclick = function() {
                if (window.AyeshaAudio.isPlaying) { window.stopAyeshaCompletely(); return; }
                window.playNativeAudio(text, this);
            };
        }

        if(text === "جی ٹھیک ہے، میں کر رہی ہوں۔" || text.trim() === "") {
            if(textNode) textNode.innerText = text;
            const aiCont = msgDiv.querySelector('.ai-text-container');
            if(aiCont) aiCont.classList.remove('typing-cursor');
            if(actionsDiv) actionsDiv.classList.remove('opacity-0');
        } else {
            let i = 0;
            function typeWriter() {
                if (i < text.length) {
                    if(textNode) textNode.innerText += text.charAt(i);
                    i++;
                    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
                    setTimeout(typeWriter, 20); 
                } else {
                    const aiCont = msgDiv.querySelector('.ai-text-container');
                    if(aiCont) aiCont.classList.remove('typing-cursor');
                    if(actionsDiv) actionsDiv.classList.remove('opacity-0');
                }
            }
            typeWriter();
        }
        return btn;
    }
};
        
