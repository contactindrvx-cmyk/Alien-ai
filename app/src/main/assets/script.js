window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur', currentBtn: null,
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
};

let isCallActive = false;
let isCallMuted = false;
window.isAyeshaRecording = false;

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon; b.classList.remove('playing-audio');
    });
};

function showToast(message) {
    const toast = document.getElementById('top-toast');
    document.getElementById('toast-text').innerText = message;
    toast.classList.remove('opacity-0', '-translate-y-10', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-10', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

// 🛠️ ہارڈویئر کمانڈز
function executeHardwareCommandLocally(text) {
    let cmd = text.toLowerCase();
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) {
        if (navigator.vibrate) navigator.vibrate([300, 100, 400]); 
    }
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) window.open("https://www.youtube.com", '_blank');
    if (cmd.includes("پلے سٹور") || cmd.includes("play store")) window.open("https://play.google.com", '_blank');
}

// 🔊 کلاؤڈ پلے بیک
function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) {
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('playing-audio');
        return;
    }
    let textChunk = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.play();
}

window.toggleVoiceMessage = function(btnElement) {
    if (window.AyeshaAudio.currentBtn === btnElement && window.AyeshaAudio.audioObj) {
        if (!window.AyeshaAudio.audioObj.paused) {
            window.AyeshaAudio.audioObj.pause();
            btnElement.innerHTML = window.AyeshaAudio.playIcon;
            btnElement.classList.remove('playing-audio');
        } else {
            window.AyeshaAudio.audioObj.play();
            btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
            btnElement.classList.add('playing-audio');
        }
        return;
    }
    window.stopAyeshaCompletely();
    window.AyeshaAudio.currentBtn = btnElement;
    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(cleanText) ? 'ur' : 'en';
    let safeParts = cleanText.match(/.{1,150}(\s|$)|.{1,150}/g) || [cleanText];
    window.AyeshaAudio.queue = safeParts.filter(p => p.trim().length > 0);
    btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
    btnElement.classList.add('playing-audio');
    playCloudQueue(btnElement);
};

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    const plusBtn = document.getElementById('plus-btn');
    const callPlusBtn = document.getElementById('call-plus-btn'); 
    const fileInput = document.getElementById('hidden-file-input');
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const startCallBtn = document.getElementById('start-call-btn');
    
    const normalChatUI = document.getElementById('normal-chat-ui');
    const activeCallUI = document.getElementById('active-call-ui');
    const muteCallBtn = document.getElementById('mute-call-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const unmutedIcon = document.getElementById('unmuted-icon-call');
    const mutedIcon = document.getElementById('muted-icon-call');
    
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const removeImgBtn = document.getElementById('remove-img-btn');
    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');

    let pendingImageFile = null;

    function updateUI() {
        if(isCallActive) return; 
        const hasText = input.value.trim().length > 0;
        const hasImage = pendingImageFile !== null;
        
        if (window.isAyeshaRecording) {
            micIcon.classList.add('hidden'); stopIcon.classList.remove('hidden');
            micActionBtn.classList.remove('hidden');
            startCallBtn.classList.add('hidden');
            sendActionBtn.classList.add('hidden');
        } else {
            stopIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
            if (hasText || hasImage) {
                sendActionBtn.classList.remove('hidden'); 
                micActionBtn.classList.add('hidden');
                startCallBtn.classList.add('hidden');
            } else {
                sendActionBtn.classList.add('hidden'); 
                micActionBtn.classList.add('hidden'); // نارمل حالت میں وائس مائیک چھپا دیں
                startCallBtn.classList.remove('hidden'); // صرف کال بٹن دکھائیں
            }
        }
    }

    input.addEventListener('input', updateUI);

    // 🖼️ امیج ہینڈلنگ (اب 100% ورکنگ)
    const handlePlusClick = () => fileInput.click();
    plusBtn.onclick = handlePlusClick;
    callPlusBtn.onclick = handlePlusClick;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewContainer.classList.remove('hidden');
                updateUI(); 
            };
            reader.readAsDataURL(file);
        }
    };

    removeImgBtn.onclick = () => {
        pendingImageFile = null; previewImg.src = "";
        previewContainer.classList.add('hidden'); fileInput.value = ""; updateUI();
    };

    // 🚀 کال شروع کرنے کی اینیمیشن 🚀
    startCallBtn.onclick = (e) => {
        e.preventDefault();
        isCallActive = true;
        isCallMuted = false;

        normalChatUI.classList.remove('fade-enter-active');
        normalChatUI.classList.add('fade-exit-active');
        
        setTimeout(() => {
            activeCallUI.classList.remove('fade-exit', 'fade-exit-active');
            activeCallUI.classList.add('fade-enter-active');
        }, 150);

        unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
        muteCallBtn.classList.remove('bg-red-500/20');
        muteCallBtn.classList.add('bg-[#16243d]');

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) {
            window.AndroidBridge.toggleCall(true);
        }
    };

    // 🚀 کال اینڈ کرنے کی اینیمیشن 🚀
    endCallBtn.onclick = () => {
        isCallActive = false;

        activeCallUI.classList.remove('fade-enter-active');
        activeCallUI.classList.add('fade-exit-active');
        
        setTimeout(() => {
            normalChatUI.classList.remove('fade-exit-active');
            normalChatUI.classList.add('fade-enter-active');
            updateUI();
        }, 300);

        showToast("Voice chat ended");

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) {
            window.AndroidBridge.toggleCall(false);
        }
    };

    // 🚀 کال کے دوران میوٹ کنٹرول 🚀
    muteCallBtn.onclick = () => {
        isCallMuted = !isCallMuted;
        if(isCallMuted) {
            unmutedIcon.classList.add('hidden'); mutedIcon.classList.remove('hidden');
            muteCallBtn.classList.replace('bg-[#16243d]', 'bg-red-500/20');
        } else {
            unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
            muteCallBtn.classList.replace('bg-red-500/20', 'bg-[#16243d]');
        }
        if (window.AndroidBridge && window.AndroidBridge.muteCall) {
            window.AndroidBridge.muteCall(isCallMuted);
        }
    };

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7]">` : '';
        let cleanText = text ? `<p dir="auto" style="white-space: pre-wrap;">${text}</p>` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${imgHtml}${cleanText}</div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative';
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${imgHtml}${cleanText}<button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button></div>`;
        }
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 🎤 آپ کا ماسٹر مائیک کوڈ (Auto-Send کے ساتھ)
    let recognition;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = true;
        recognition.lang = 'ur-PK'; 

        recognition.onstart = () => {
            window.stopAyeshaCompletely();
            window.isAyeshaRecording = true;
            input.value = ''; updateUI();
            input.placeholder = "سن رہی ہوں...";
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            input.value = transcript;
            updateUI();
        };

        recognition.onend = () => {
            window.isAyeshaRecording = false;
            input.placeholder = "Ask something...";
            updateUI();
            // 🚀 اٹو سینڈ ٹائمر (Auto Send Logic) 🚀
            if (input.value.trim().length > 0) {
                setTimeout(() => { sendActionBtn.click(); }, 600);
            }
        };
    }

    micActionBtn.onclick = (e) => {
        e.preventDefault();
        if (window.isAyeshaRecording) {
            recognition.stop();
        } else {
            // کال کو بند کرو اگر چل رہی ہے
            if (isCallActive) endCallBtn.click();
            recognition.start();
        }
    };

    sendActionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely();
        const text = input.value.trim();
        const imageToSend = pendingImageFile;
        const imageSrc = pendingImageFile ? previewImg.src : null;
        
        if (text || imageToSend) {
            if(text) executeHardwareCommandLocally(text);
            addMessage(text, 'user', imageSrc);
            
            input.value = ''; pendingImageFile = null;
            previewContainer.classList.add('hidden');
            updateUI();
            
            thinkingIndicator.classList.remove('hidden'); thinkingIndicator.classList.add('flex');
            
            // Image to Base64 logic
            let base64Image = null;
            if (imageToSend) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    base64Image = e.target.result;
                    sendRequest(text, base64Image);
                };
                reader.readAsDataURL(imageToSend);
            } else {
                sendRequest(text, null);
            }
        }
    };

    function sendRequest(text, base64Image) {
        let payload = { message: text || "", email: "alirazasabir007@gmail.com" };
        if (base64Image) payload.image = base64Image;

        fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(res => res.json()).then(data => {
            thinkingIndicator.classList.add('hidden');
            addMessage(data.response, 'assistant');
            setTimeout(() => {
                const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                if(allBtns.length > 0) window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
            }, 300);
        }).catch(e => {
            thinkingIndicator.classList.add('hidden');
            addMessage("سرور آف لائن ہے۔", 'assistant');
        });
    }

    document.getElementById('menu-btn').onclick = () => { 
        document.getElementById('sidebar').classList.toggle('-translate-x-full'); 
        document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
    };
    document.getElementById('sidebar-overlay').onclick = () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    };
});
                    
