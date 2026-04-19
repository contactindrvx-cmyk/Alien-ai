// =========================================================================
// 1. آڈیو انجن (پاز کرنے پر وہیں سے چلے گا!)
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
    if(window.AyeshaAudio.audioObj) {
        window.AyeshaAudio.audioObj.pause();
    }
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon;
        b.classList.remove('playing-audio');
    });
    window.AyeshaAudio.currentBtn = null;
};

// کلاؤڈ آڈیو کو پلے کرنے کا فنکشن
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

// 🔴 جادو یہاں ہے: Pause کرنے کے بعد Play پر وہیں سے ریزیوم (Resume) ہوگا
window.toggleVoiceMessage = function(btnElement) {
    // اگر یہی بٹن دوبارہ دبایا گیا ہے
    if (window.AyeshaAudio.currentBtn === btnElement && window.AyeshaAudio.audioObj) {
        if (!window.AyeshaAudio.audioObj.paused) {
            window.AyeshaAudio.audioObj.pause(); // ⏸ وہیں روکو
            btnElement.innerHTML = window.AyeshaAudio.playIcon;
            btnElement.classList.remove('playing-audio');
        } else {
            window.AyeshaAudio.audioObj.play(); // ▶ وہیں سے چلاؤ
            btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
            btnElement.classList.add('playing-audio');
        }
        return;
    }

    // اگر نیا میسج چلانا ہے تو پرانا سب کینسل کرو
    window.stopAyeshaCompletely();
    window.AyeshaAudio.currentBtn = btnElement;

    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

    const isUrdu = /[\u0600-\u06FF]/.test(cleanText);
    window.AyeshaAudio.lang = isUrdu ? 'ur' : 'en';

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
// 2. مین UI، ٹائپنگ اور امیج کنٹرول
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const fileInput = document.getElementById('hidden-file-input');
    const actionBtn = document.getElementById('action-btn');
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon');
    const sendIcon = document.getElementById('send-icon');
    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');
    const indicatorText = document.getElementById('indicator-text');
    
    let isRecording = false;
    let pendingImageFile = null; // 🔴 تصویر کو روکنے کے لیے ویری ایبل

    function showThinking(text) {
        indicatorText.innerText = text;
        thinkingIndicator.classList.remove('hidden');
        thinkingIndicator.classList.add('flex');
    }

    function hideThinking() {
        thinkingIndicator.classList.add('hidden');
        thinkingIndicator.classList.remove('flex');
    }

    function updateUI() {
        const hasText = input.value.trim().length > 0 || pendingImageFile !== null;
        const isActive = (document.activeElement === input) || hasText || isRecording;
        
        if (isActive) {
            plusBtn.classList.add('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "64px"; inputPill.style.paddingLeft = "10px"; inputPill.classList.add('active');
        } else {
            plusBtn.classList.remove('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "0px"; inputPill.style.paddingLeft = "56px"; inputPill.classList.remove('active');
        }
        
        if (isRecording) {
            micIcon.classList.add('hidden'); sendIcon.classList.add('hidden'); stopIcon.classList.remove('hidden');
            actionBtn.classList.add('recording-pulse');
        } else if (hasText) {
            micIcon.classList.add('hidden'); stopIcon.classList.add('hidden'); sendIcon.classList.remove('hidden');
            actionBtn.classList.remove('recording-pulse');
        } else {
            stopIcon.classList.add('hidden'); sendIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
            actionBtn.classList.remove('recording-pulse');
        }
    }

    input.addEventListener('input', updateUI);
    input.addEventListener('focus', updateUI);
    input.addEventListener('blur', updateUI);

    plusBtn.onclick = () => fileInput.click(); 

    // 🔴 تصویر سلیکٹ ہوتے ہی خود نہیں جائے گی، بس یوزر کو نظر آئے گی
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            input.value = "[تصویر منسلک کر دی گئی ہے، سینڈ دبائیں]";
            updateUI();
        }
    };

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            msgDiv.innerHTML = `<div class="chat-bubble user-bubble border border-[#3a8ff7]">${imgHtml}<p dir="auto" style="white-space: pre-wrap;">${text}</p></div>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4 relative';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">
                    ${imgHtml}<p dir="auto" style="white-space: pre-wrap;">${text}</p>
                    <button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button>
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

    let recognition = null;
    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true; 
            recognition.interimResults = true; 
            recognition.lang = navigator.language || 'ur-PK';

            recognition.onstart = function() {
                isRecording = true;
                input.value = '';
                updateUI();
                input.placeholder = "بولیں، رئیل ٹائم ٹائپ ہو رہا ہے...";
            };

            recognition.onresult = function(event) {
                let fullText = '';
                for (let i = 0; i < event.results.length; ++i) {
                    fullText += event.results[i][0].transcript + " "; 
                }
                input.value = fullText.replace(/\s+/g, ' ').trim();
                updateUI();
            };

            recognition.onend = function() {
                if (isRecording) {
                    isRecording = false;
                    updateUI();
                    if (input.value.trim().length > 0) {
                        const text = input.value.trim();
                        addMessage(text, 'user');
                        input.value = ''; updateUI(); sendToHuggingFace(text, null);
                    }
                }
            };
        } catch (e) {}
    }

    // 🔴 سینڈ بٹن (تصویر اور ٹیکسٹ کے لیے)
    actionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely();
        if (isRecording) { 
            recognition.stop(); 
        } else if (input.value.trim().length > 0 || pendingImageFile) {
            const text = input.value.replace('[تصویر منسلک کر دی گئی ہے، سینڈ دبائیں]', '').trim();
            const imageToSend = pendingImageFile;
            
            if(imageToSend) {
                const reader = new FileReader();
                reader.onload = function(event) { addMessage(text || "تصویر", 'user', event.target.result); };
                reader.readAsDataURL(imageToSend);
            } else {
                addMessage(text, 'user');
            }

            input.value = ''; 
            pendingImageFile = null; // تصویر بھیجنے کے بعد صاف کریں
            updateUI(); 
            sendToHuggingFace(text, imageToSend); 
        } else {
            if (recognition) { try { recognition.start(); } catch(e){} }
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (input.value.trim().length > 0 || pendingImageFile)) {
            actionBtn.click();
        }
    });

    document.body.addEventListener('click', () => {
        try { if('speechSynthesis' in window) { window.speechSynthesis.resume(); } } catch(e){}
    }, {once:true});
});
        
