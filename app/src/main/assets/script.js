// =========================================================================
// 1. کلاؤڈ آڈیو انجن (جمنائی فلوٹنگ سپیکر کنٹرول)
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    playIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    stopIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    queue: [],
    lang: 'ur'
};

window.stopAyeshaCompletely = function() {
    window.AyeshaAudio.queue = []; 
    if(window.AyeshaAudio.audioObj) {
        window.AyeshaAudio.audioObj.pause();
        window.AyeshaAudio.audioObj.currentTime = 0;
    }
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.classList.remove('playing');
        b.innerHTML = window.AyeshaAudio.playIcon;
    });
};

window.playVoiceMessage = function(btnElement) {
    if (btnElement.classList.contains('playing')) {
        window.stopAyeshaCompletely();
        return;
    }

    window.stopAyeshaCompletely();

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
    btnElement.classList.add('playing');
    btnElement.innerHTML = window.AyeshaAudio.stopIcon;

    playQueue(btnElement);
};

function playQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0 || !btnElement.classList.contains('playing')) {
        btnElement.classList.remove('playing');
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        return;
    }

    let text = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playQueue(btnElement);
    window.AyeshaAudio.audioObj.onerror = () => playQueue(btnElement);
    window.AyeshaAudio.audioObj.play().catch(e => {
        btnElement.classList.remove('playing');
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
    });
}

window.autoPlayVoice = function(rawText) {
    window.stopAyeshaCompletely(); 
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
    
    function playAutoQueue() {
        if(window.AyeshaAudio.queue.length === 0) return;
        let text = window.AyeshaAudio.queue.shift();
        let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
        window.AyeshaAudio.audioObj = new Audio(url);
        window.AyeshaAudio.audioObj.onended = playAutoQueue;
        window.AyeshaAudio.audioObj.play().catch(e => console.log("Auto-play blocked", e));
    }
    playAutoQueue();
};


// =========================================================================
// 2. مین UI، گلوبل ٹائپنگ اور میسج ہینڈلنگ
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
    let finalTranscript = '';

    function showThinking(text) {
        indicatorText.innerText = text;
        thinkingIndicator.classList.remove('hidden');
        thinkingIndicator.classList.add('flex');
        chatBox.appendChild(thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideThinking() {
        thinkingIndicator.classList.add('hidden');
        thinkingIndicator.classList.remove('flex');
    }

    function updateUI() {
        const hasText = input.value.trim().length > 0;
        const isActive = (document.activeElement === input) || hasText || isRecording;
        
        if (isActive) {
            plusBtn.classList.add('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "64px"; inputPill.style.paddingLeft = "10px"; inputPill.classList.add('active');
        } else {
            plusBtn.classList.remove('bg-[#2f3037]', 'border-[#3a8ff7]', 'border');
            inputPill.style.marginLeft = "0px"; inputPill.style.paddingLeft = "56px"; inputPill.classList.remove('active');
        }
        
        if (isRecording) {
            micIcon.classList.add('hidden'); 
            sendIcon.classList.add('hidden'); 
            stopIcon.classList.remove('hidden');
        } else if (hasText) {
            micIcon.classList.add('hidden'); 
            stopIcon.classList.add('hidden'); 
            sendIcon.classList.remove('hidden');
        } else {
            stopIcon.classList.add('hidden'); 
            sendIcon.classList.add('hidden'); 
            micIcon.classList.remove('hidden');
        }
    }

    input.addEventListener('input', updateUI);
    input.addEventListener('focus', updateUI);
    input.addEventListener('blur', updateUI);

    plusBtn.onclick = () => fileInput.click(); 

    const fileToBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                addMessage("تصویر بھیجی جا رہی ہے...", 'user', event.target.result);
            };
            reader.readAsDataURL(file);
            sendToHuggingFace("اس تصویر کو دیکھیں", file); 
        }
    };

    // 🔴 پروفیشنل میسج کنٹینر (جمنائی ڈیزائن)
    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';

        if (sender === 'user') {
            msgDiv.className = 'user-container w-full flex justify-end';
            msgDiv.innerHTML = `
                <div class="chat-bubble user-bubble border border-[#3a8ff7]">
                    ${imgHtml}<p>${text}</p>
                </div>
            `;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'message-container';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">
                    ${imgHtml}<p style="white-space: pre-wrap;">${text}</p>
                </div>
                <button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.playVoiceMessage(this)" title="Play Audio">
                    ${window.AyeshaAudio.playIcon}
                </button>
            `;
        }
        
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function sendToHuggingFace(text, file) {
        if(file) { showThinking("تصویر دیکھ رہی ہے..."); } 
        else { showThinking("ٹائپ کر رہی ہے..."); }

        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = {
            message: text || "",
            email: "alirazasabir007@gmail.com", 
            local_time: new Date().toLocaleTimeString()
        };

        try {
            if (file) payload.image = await fileToBase64(file);

            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            hideThinking();
            
            const replyText = data.response || "معاف کیجیے، میں سمجھ نہیں سکی۔";
            addMessage(replyText, 'assistant');
            
            window.autoPlayVoice(replyText);
            
        } catch (err) {
            hideThinking();
            addMessage("سرور آف لائن ہے۔ انٹرنیٹ چیک کریں۔", 'assistant');
        }
    }

    // 🔴 رئیل ٹائم گلوبل ٹائپنگ انجن (STT) - فوکس صرف ٹائپنگ پر
    let recognition = null;

    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true; 
            recognition.interimResults = true; 
            recognition.lang = navigator.language || 'ur-PK'; // آٹو ڈیٹیکٹ

            recognition.onstart = function() {
                isRecording = true;
                finalTranscript = ''; 
                input.value = '';
                updateUI();
                input.placeholder = "بولیں، رئیل ٹائم ٹائپ ہو رہا ہے...";
            };

            recognition.onresult = function(event) {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) { 
                        finalTranscript += event.results[i][0].transcript + ' '; 
                    } else { 
                        interimTranscript += event.results[i][0].transcript; 
                    }
                }
                // یہ الفاظ کو اسی وقت سکرین پر دکھائے گا
                input.value = finalTranscript + interimTranscript;
                updateUI();
            };

            recognition.onerror = function(e) {
                console.log("Speech Error:", e.error);
                isRecording = false;
                input.placeholder = "Ask something...";
                updateUI();
            };

            recognition.onend = function() {
                isRecording = false;
                input.placeholder = "Ask something...";
                updateUI();
                
                // جیسے ہی چپ ہوں، جو ٹائپ ہوا ہے وہ خود سینڈ ہو جائے گا
                if (input.value.trim().length > 0) {
                    const text = input.value.trim();
                    addMessage(text, 'user');
                    input.value = ''; updateUI(); 
                    sendToHuggingFace(text, null);
                }
            };
        } catch (e) {
            console.log("Speech recognition failed.");
        }
    }

    actionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely(); // مائیک دباتے ہی عائشہ چپ

        if (isRecording) {
            // سٹاپ بٹن دبانے پر ٹائپنگ رکے گی اور خود سینڈ ہو جائے گی (onend کے ذریعے)
            if (recognition) recognition.stop();
        } else if (input.value.trim().length > 0) {
            // اگر کچھ ٹائپ کیا ہے تو سینڈ
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null); 
        } else {
            // مائیک آن کریں
            if (recognition) {
                try { recognition.start(); } 
                catch(e){ alert("مائیکروفون کی اجازت نہیں ملی۔"); }
            } else {
                alert("آپ کے فون میں وائس ٹائپنگ سپورٹ نہیں ہے۔");
            }
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim().length > 0) {
            window.stopAyeshaCompletely(); 
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null);
        }
    });

    // اینڈرائیڈ آڈیو پالیسی بائی پاس
    document.body.addEventListener('click', () => {
        try { if('speechSynthesis' in window) { window.speechSynthesis.resume(); } } catch(e){}
    }, {once:true});

});
        
