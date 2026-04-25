window.AyeshaAudio = { isPlaying: false, activeBtn: null };
let isCallActive = false; 
let isCallMuted = false;
window.isAyeshaRecording = false;
window.isAyeshaProcessing = false;

// 🚀 تمام UI Elements کی ڈکلیئریشن 🚀
let inputNormal, outPlus, mainPill, inPlus, inSend, inMic, inCall;
let iMicNormal, iMicStop;
let inputCall, cgPlus, cgSend, cgMic, cgMicOn, cgMicOff, cgEnd;
let fileIn, preview, pendingImg = null, voiceTimeout;
let currentStreamBubble = null;
let fullStreamedText = "";

// 🚀 سمارٹ ملٹی لینگویج ڈکشنری 🚀
const translations = {
    'ur': { a: 'عائشہ', r: 'رضا', s: 'سارہ', x: 'ایلکس', title: 'آئیں بات کریں', cam: 'کیمرہ', gal: 'گیلری' },
    'en': { a: 'Ayesha', r: 'Raza', s: 'Sarah', x: 'Alex', title: 'Let\'s chat', cam: 'Camera', gal: 'Gallery' }
};

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. لینگویج اپلائی (Safe Mode)
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

    // 2. DOM Elements کو محفوظ طریقے سے پکڑنا
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
    
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    const normalBar = document.getElementById('normal-mode-bar'); 
    const callBar = document.getElementById('call-mode-bar');
    
    const profileBtn = document.getElementById('profile-btn');
    const profileMenu = document.getElementById('profile-menu');
    const assistantBtn = document.getElementById('assistant-btn');
    const assistantMenu = document.getElementById('assistant-menu');
    const attachmentMenu = document.getElementById('attachment-menu');

    // 3. مینیوز کو بند کرنے کا گلوبل فنکشن
    window.closeAllMenus = function() {
        if(profileMenu) profileMenu.classList.add('hidden');
        if(assistantMenu) assistantMenu.classList.add('hidden');
        if(attachmentMenu) attachmentMenu.classList.add('hidden');
    };

    // ہیڈر بٹنز کلک
    if(profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = profileMenu.classList.contains('hidden');
            window.closeAllMenus();
            if(isHidden) profileMenu.classList.remove('hidden');
        });
    }

    if(assistantBtn) {
        assistantBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = assistantMenu.classList.contains('hidden');
            window.closeAllMenus();
            if(isHidden) assistantMenu.classList.remove('hidden');
        });
    }

    document.querySelectorAll('.asst-option').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if(document.getElementById('current-assistant')) {
                document.getElementById('current-assistant').innerText = this.innerText.trim().split(' ')[0];
            }
            window.closeAllMenus();
        });
    });

    document.addEventListener('click', () => { window.closeAllMenus(); });

    // 4. UI Update Function (جہاز / مائیک بٹن کے لیے)
    function updateUIState() {
        try {
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
                    if(inSend) inSend.classList.remove('btn-collapse'); // 🚀 جہاز والا بٹن یہاں سے ظاہر ہوتا ہے
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
    }

    // ان پٹ فیلڈز پر ٹائپنگ کو سننا (جہاز لانے کے لیے)
    if(inputNormal) inputNormal.addEventListener('input', (e) => { if(inputCall) inputCall.value = e.target.value; updateUIState(); });
    if(inputCall) inputCall.addEventListener('input', (e) => { if(inputNormal) inputNormal.value = e.target.value; updateUIState(); });

    // کال بار میں ٹائپنگ اینیمیشن (مائیک/اینڈ غائب کرنا)
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

    // 5. تمام کلک ایونٹس (کیمرہ، گیلری، سینڈ وغیرہ)
    const handlePlusClick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if(attachmentMenu) {
            const isHidden = attachmentMenu.classList.contains('hidden');
            window.closeAllMenus(); 
            if (isHidden) attachmentMenu.classList.remove('hidden');
        }
    };
    if(outPlus) outPlus.addEventListener('click', handlePlusClick); 
    if(inPlus) inPlus.addEventListener('click', handlePlusClick); 
    if(cgPlus) cgPlus.addEventListener('click', handlePlusClick);

    const btnCam = document.getElementById('btn-camera');
    if(btnCam) btnCam.addEventListener('click', (e) => {
        e.stopPropagation(); window.closeAllMenus(); 
        if(window.AndroidBridge && window.AndroidBridge.openCamera) window.AndroidBridge.openCamera(); 
    });

    const btnGal = document.getElementById('btn-gallery');
    if(btnGal) btnGal.addEventListener('click', (e) => {
        e.stopPropagation(); window.closeAllMenus(); 
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); 
        else if(fileIn) fileIn.click(); 
    });

    if(fileIn) {
        fileIn.addEventListener('change', (e) => {
            if(e.target.files[0]) {
                pendingImg = e.target.files[0]; 
                const prevImg = document.getElementById('preview-img');
                if(prevImg) prevImg.src = URL.createObjectURL(pendingImg);
                if(preview) preview.classList.remove('hidden'); 
                updateUIState();
            }
        });
    }
    
    const rmImgBtn = document.getElementById('remove-img-btn');
    if(rmImgBtn) rmImgBtn.addEventListener('click', () => { 
        pendingImg = null; if(preview) preview.classList.add('hidden'); if(fileIn) fileIn.value=''; updateUIState(); 
    });
    
    if(inMic) inMic.addEventListener('click', () => { 
        if(!isCallActive && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); 
    });
    
    if(cgMic) cgMic.addEventListener('click', () => { 
        isCallMuted = !isCallMuted; updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.muteCall) window.AndroidBridge.muteCall(isCallMuted); 
    });

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(inputNormal) {
            if(isRecording) inputNormal.placeholder = "سن رہی ہوں..."; 
            else inputNormal.placeholder = "میسج ٹائپ کریں..."; 
        }
        if (!isRecording && isCallActive && !isCallMuted && !window.AyeshaAudio.isPlaying && !window.isAyeshaProcessing) {
            setTimeout(() => { if (window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); }, 500); 
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
                    if(isCallActive && cgSend) cgSend.click(); 
                    else if(inSend) inSend.click(); 
                }
            }, 1000); 
        }
    };

    if(inCall) inCall.addEventListener('click', () => { 
        isCallActive = true; isCallMuted = false; updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(true); 
        if(!window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic();
    });
    
    if(cgEnd) cgEnd.addEventListener('click', () => { 
        isCallActive = false; window.stopAyeshaCompletely(); 
        if(inputNormal) inputNormal.value = ''; 
        if(inputCall) inputCall.value = ''; 
        pendingImg = null; 
        if(preview) preview.classList.add('hidden'); 
        if(fileIn) fileIn.value = '';
        if(window.isAyeshaRecording && window.AndroidBridge && window.AndroidBridge.toggleInlineMic) window.AndroidBridge.toggleInlineMic(); 
        updateUIState(); 
        if(window.AndroidBridge && window.AndroidBridge.toggleCall) window.AndroidBridge.toggleCall(false); 
    });

    const handleSendClick = (e) => {
        if(e) e.preventDefault(); 
        const activeInput = isCallActive ? inputCall : inputNormal; 
        const text = activeInput ? activeInput.value.trim() : "";
        
        if (text || pendingImg) {
            let imgUrl = pendingImg ? URL.createObjectURL(pendingImg) : null;
            let currentB64 = "";
            
            if (pendingImg) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    currentB64 = reader.result.split(',')[1];
                    window.addMessage(text || "Image sent", 'user', imgUrl);
                    if(inputNormal) inputNormal.value = ''; 
                    if(inputCall) inputCall.value = ''; 
                    pendingImg = null; 
                    if(preview) preview.classList.add('hidden'); 
                    window.isAyeshaRecording = false; 
                    updateUIState();
                    const thinkInd = document.getElementById('thinking-indicator');
                    if(thinkInd) thinkInd.classList.remove('hidden');
                    window.isAyeshaProcessing = true;
                    if (window.AndroidBridge && window.AndroidBridge.sendNativeRequest) window.AndroidBridge.sendNativeRequest(text, currentB64);
                };
                reader.readAsDataURL(pendingImg);
            } else {
                window.addMessage(text, 'user', null);
                if(inputNormal) inputNormal.value = ''; 
                if(inputCall) inputCall.value = ''; 
                window.isAyeshaRecording = false; 
                updateUIState();
                const thinkInd = document.getElementById('thinking-indicator');
                if(thinkInd) thinkInd.classList.remove('hidden');
                window.isAyeshaProcessing = true;
                if (window.AndroidBridge && window.AndroidBridge.sendNativeRequest) window.AndroidBridge.sendNativeRequest(text, "");
            }
        }
    };
    
    if(inSend) inSend.addEventListener('click', handleSendClick); 
    if(cgSend) cgSend.addEventListener('click', handleSendClick);

    if(inputNormal) {
        inputNormal.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') handleSendClick(e);
        });
    }
});

// 6. سٹریمنگ اور میسجنگ فنکشنز (Global)
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
    processAIResponse(fullText, currentStreamBubble);
    currentStreamBubble = null;
};

window.onStreamError = function() {
    window.isAyeshaProcessing = false;
    const thinkInd = document.getElementById('thinking-indicator');
    if(thinkInd) thinkInd.classList.add('hidden');
    window.addMessage("سرور سے رابطہ ٹوٹ گیا ہے۔", 'assistant');
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
        let btn = window.addMessage(cleanText, 'assistant');
        if(btn && !isCallActive) { window.playNativeAudio(cleanText, btn); }
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
        if 
