// =========================================================================
// 1. آڈیو انجن (پاز/ریزیوم، کوئی چھیڑ چھاڑ نہیں)
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    queue: [],
    lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null
};

window.stopAyeshaCompletely = function() {
    window.AyeshaAudio.queue = []; 
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon;
        b.classList.remove('playing-audio');
    });
    window.AyeshaAudio.currentBtn = null;
};

function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) {
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('playing-audio');
        window.AyeshaAudio.currentBtn = null;
        return;
    }
    let textChunk = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.play().catch(e => {
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('playing-audio');
    });
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

    let parts = cleanText.match(/[^.!?؟\n]+[.!?؟\n]+/g) || [cleanText];
    let safeParts = [];
    parts.forEach(p => {
        if(p.length > 150) {
            let subParts = p.match(/.{1,150}(\s|$)/g) || [p];
            safeParts = safeParts.concat(subParts);
        } else { safeParts.push(p); }
    });

    window.AyeshaAudio.queue = safeParts.filter(p => p.trim().length > 0);
    btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
    btnElement.classList.add('playing-audio');
    playCloudQueue(btnElement);
};

// =========================================================================
// 2. مین UI، ڈبل ٹائپنگ فکس اور ڈبل بٹن لاجک
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const fileInput = document.getElementById('hidden-file-input');
    
    // بٹنز
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon');
    
    // تصویر کا پریویو
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const removeImgBtn = document.getElementById('remove-img-btn');

    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');
    
    let isRecording = false;
    let pendingImageFile = null; 

    function showThinking(text) {
        document.getElementById('indicator-text').innerText = text;
        thinkingIndicator.classList.remove('hidden');
        thinkingIndicator.classList.add('flex');
    }

    function hideThinking() {
        thinkingIndicator.classList.add('hidden');
        thinkingIndicator.classList.remove('flex');
    }

    // 🎯 بٹنز اور UI کو اپڈیٹ کرنے کا پرفیکٹ لاجک
    function updateUI() {
        const hasText = input.value.trim().length > 0;
        const hasImage = pendingImageFile !== null;
        const isActive = (document.activeElement === input) || hasText || hasImage || isRecording;
        
        if (isActive) {
            plusBtn.classList.add('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "64px"; inputPill.style.paddingLeft = "10px"; inputPill.classList.add('active');
        } else {
            plusBtn.classList.remove('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "0px"; inputPill.style.paddingLeft = "56px"; inputPill.classList.remove('active');
        }
        
        if (isRecording) {
            // جب ریکارڈنگ ہو رہی ہو تو صرف سٹاپ بٹن نظر آئے گا
            micIcon.classList.add('hidden');
            stopIcon.classList.remove('hidden');
            micActionBtn.classList.remove('hidden');
            micActionBtn.classList.add('recording-pulse');
            sendActionBtn.classList.add('hidden');
        } else {
            stopIcon.classList.add('hidden');
            micActionBtn.classList.remove('recording-pulse');

            if (hasText) {
                // اگر ٹیکسٹ لکھا ہے تو صرف جہاز (سینڈ) نظر آئے گا
                micActionBtn.classList.add('hidden');
                sendActionBtn.classList.remove('hidden');
            } else if (hasImage) {
                // 🎯 اگر صرف تصویر سلیکٹ ہے، تو جہاز اور مائیک دونوں نظر آئیں گے!
                micIcon.classList.remove('hidden');
                micActionBtn.classList.remove('hidden');
                sendActionBtn.classList.remove('hidden');
            } else {
                // خالی حالت میں صرف مائیک نظر آئے گا
                micIcon.classList.remove('hidden');
                micActionBtn.classList.remove('hidden');
                sendActionBtn.classList.add('hidden');
            }
        }
    }

    input.addEventListener('input', updateUI);
    input.addEventListener('focus', updateUI);
    input.addEventListener('blur', updateUI);

    plusBtn.onclick = () => fileInput.click(); 

    // تصویر سلیکٹ کرنے پر پریویو باکس شو کرنا
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = function(event) {
                previewImg.src = event.target.result;
                previewContainer.classList.remove('hidden');
                updateUI(); 
            };
            reader.readAsDataURL(file);
        }
    };

    // تصویر ہٹانا
    removeImgBtn.onclick = () => {
        pendingImageFile = null;
        previewImg.src = "";
        previewContainer.classList.add('hidden');
        fileInput.value = ""; 
        updateUI();
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); };

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';
        let cleanText = text ? `<p dir="auto" style="white-space: pre-wrap;">${text}</p>` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${imgHtml}${cleanText}</div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">
                    ${imgHtml}${cleanText}
                    <button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)" title="Play/Pause Audio">
                        ${window.AyeshaAudio.playIcon}
                    </button>
                </div>`;
        }
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const fileToBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    async function sendToHuggingFace(text, file) {
        showThinking(file ? "تصویر دیکھ رہی ہے..." : "ٹائپ کر رہی ہے...");
        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = { message: text || "", email: "alirazasabir007@gmail.com", local_time: new Date().toLocaleTimeString() };
        
        try {
            if (file) payload.image = await fileToBase64(file);
            const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();
            hideThinking();
            const replyText = data.response || "معاف کیجیے، میں سمجھ نہیں سکی۔";
            addMessage(replyText, 'assistant');
            
            setTimeout(() => {
                const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                if(allBtns.length > 0) window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
            }, 300);
            
        } catch (err) {
            hideThinking();
            addMessage("سرور آف لائن ہے۔ انٹرنیٹ چیک کریں۔", 'assistant');
        }
    }

    // 🔴 ڈبل ٹائپنگ فکس: اب کچے اور پکے الفاظ مکس نہیں ہوں گے
    let recognition = null;
    let stableTranscript = ''; // پکی میموری

    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true; 
            recognition.interimResults = true; 
            recognition.lang = navigator.language || 'ur-PK';

            recognition.onstart = function() {
                isRecording = true;
                stableTranscript = ''; 
                input.value = '';
                updateUI();
                input.placeholder = "بولیں...";
            };

            recognition.onresult = function(event) {
                let finalStr = '';
                let interimStr = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalStr += event.results[i][0].transcript;
                    } else {
                        interimStr += event.results[i][0].transcript;
                    }
                }
                
                if (finalStr) { stableTranscript += finalStr + ' '; }
                
                input.value = (stableTranscript + interimStr).replace(/\s+/g, ' ').trim();
                updateUI();
            };

            recognition.onerror = function(e) { console.log("Speech Error:", e.error); };

            recognition.onend = function() {
                if (isRecording) {
                    isRecording = false;
                    input.placeholder = "Ask something...";
                    updateUI();
                    if (input.value.trim().length > 0) {
                        sendActionBtn.click(); // آٹو سینڈ
                    }
                }
            };
        } catch (e) { console.log("Speech recognition failed."); }
    }

    // 🎯 سینڈ بٹن کا فنکشن (تصویر اور ٹیکسٹ بھیجنے کے لیے)
    sendActionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely();

        const text = input.value.trim();
        const imageToSend = pendingImageFile;
        
        if (text.length > 0 || imageToSend) {
            if(imageToSend) {
                addMessage(text, 'user', previewImg.src);
            } else {
                addMessage(text, 'user');
            }

            input.value = ''; 
            pendingImageFile = null; 
            previewImg.src = "";
            previewContainer.classList.add('hidden');
            fileInput.value = "";
            updateUI(); 
            
            sendToHuggingFace(text, imageToSend); 
        }
    };

    // 🎯 مائیک بٹن کا فنکشن
    micActionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely();

        if (isRecording) {
            if (recognition) recognition.stop();
        } else {
            if (recognition) { try { recognition.start(); } catch(e){} }
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (input.value.trim().length > 0 || pendingImageFile)) {
            sendActionBtn.click();
        }
    });

    document.body.addEventListener('click', () => {
        try { if('speechSynthesis' in window) { window.speechSynthesis.resume(); } } catch(e){}
    }, {once:true});

});
                
