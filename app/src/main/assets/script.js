// =========================================================================
// 1. کلاؤڈ آڈیو انجن (عائشہ کی آواز اور انٹرپٹ کنٹرول)
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    stopIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    queue: [],
    lang: 'ur'
};

window.stopAyeshaCompletely = function() {
    window.AyeshaAudio.queue = []; 
    if(window.AyeshaAudio.audioObj) {
        window.AyeshaAudio.audioObj.pause();
        window.AyeshaAudio.audioObj.currentTime = 0;
    }
    document.querySelectorAll('.smart-speaker-btn').forEach(b => {
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
    
    // سمارٹ لینگویج (عائشہ کے بولنے کے لیے)
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(cleanText) ? 'ur' : 'en';
    
    let parts = cleanText.match(/[^.!?؟\n]+[.!?؟\n]+/g) || [cleanText];
    let safeParts = [];
    parts.forEach(p => {
        if(p.length > 150) {
            let subParts = p.match(/.{1,150}(\s|$)/g) || [p];
            safeParts = safeParts.concat(subParts);
        } else {
            safeParts.push(p);
        }
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
        } else {
            safeParts.push(p);
        }
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
// 2. مین UI اور رئیل ٹائم وائس ٹائپنگ (STT)
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
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-btn');

    let isRecording = false;
    let finalTranscript = ''; // پکی ٹائپنگ سٹور کرنے کے لیے

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
        
        // اگر ریکارڈنگ ہو رہی ہے تو سٹاپ بٹن، ورنہ سینڈ یا مائیک
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
                addMessage("Image attached...", 'user', event.target.result);
            };
            reader.readAsDataURL(file);
            sendToHuggingFace("اس تصویر کو دیکھو۔", file, null); 
        }
    };

    menuBtn.onclick = () => { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); };
    overlay.onclick = () => { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); };

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';

        if (sender === 'user') {
            msgDiv.className = 'chat-bubble user-bubble border border-[#3a8ff7]';
            msgDiv.innerHTML = `${imgHtml}<p>${text}</p>`;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'relative group w-full mt-4';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10 relative">
                    ${imgHtml}<p style="white-space: pre-wrap;">${text}</p>
                    <button class="smart-speaker-btn" data-text="${encodedText}" onclick="window.playVoiceMessage(this)" title="Play Audio">
                        ${window.AyeshaAudio.playIcon}
                    </button>
                </div>
            `;
        }
        
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function sendToHuggingFace(text, file, audioBlob) {
        if(file) { showThinking("تصویر دیکھ رہی ہے..."); } 
        else if(audioBlob) { showThinking("آواز سن رہی ہے..."); }
        else { showThinking("ٹائپ کر رہی ہے..."); }

        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = {
            message: text || "",
            email: "alirazasabir007@gmail.com", 
            local_time: new Date().toLocaleTimeString()
        };

        try {
            if (file) payload.image = await fileToBase64(file);
            if (audioBlob) payload.audio = await fileToBase64(audioBlob);

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

    // 🔴 نیا: رئیل ٹائم گلوبل ٹائپنگ انجن
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];

    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true; // لگاتار سنے گا
            recognition.interimResults = true; // رئیل ٹائم کچی ٹائپنگ دکھائے گا
            
            // 🌍 گلوبل لینگویج (یوزر کے کی بورڈ سے پکڑے گا)
            recognition.lang = navigator.language || 'en-US';

            recognition.onstart = function() {
                finalTranscript = ''; 
                input.value = '';
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
                // 🔴 جادو یہاں ہے: لائیو الفاظ سکرین پر نظر آئیں گے
                input.value = finalTranscript + interimTranscript;
                updateUI();
            };

            recognition.onerror = function(e) {
                console.log("Speech recognition error:", e.error);
            };

            recognition.onend = function() {
                // اگر بولنا ختم ہو جائے تو خودکار سٹاپ کر دے
                if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop(); 
                }
            };
        } catch (e) {
            console.log("Speech recognition failed to init.");
        }
    }

    async function startRecordingSafely() {
        window.stopAyeshaCompletely(); // عائشہ کو چپ کروائیں

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            
            mediaRecorder.onstop = () => {
                isRecording = false;
                hideThinking();
                input.placeholder = "Ask something...";
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const text = input.value.trim();
                
                if (text.length > 0 || audioChunks.length > 0) {
                    addMessage(text || "🎤 Voice Message", 'user');
                    input.value = '';
                    updateUI();
                    sendToHuggingFace(text, null, audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            input.value = ''; 
            finalTranscript = '';
            
            if (recognition) { 
                try { recognition.start(); } catch(e){} 
            }
            mediaRecorder.start(); 
            
            isRecording = true;
            updateUI();
            input.placeholder = "سن رہی ہوں...";
            showThinking("عائشہ سن رہی ہے...");
            
        } catch (err) {
            alert("مائیکروفون کی اجازت درکار ہے!");
        }
    }

    function stopRecordingSafely() {
        if (recognition) { 
            try { recognition.stop(); } catch(e){} 
        }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') { 
            mediaRecorder.stop(); 
        }
    }

    actionBtn.onclick = (e) => {
        e.preventDefault();
        if (isRecording) {
            // اگر ریکارڈنگ چل رہی ہے، تو اس بٹن کو دبانے سے ریکارڈنگ سٹاپ ہوگی اور سینڈ ہو جائے گی
            stopRecordingSafely();
        } else if (input.value.trim().length > 0) {
            // اگر ٹیکسٹ لکھا ہے، تو سینڈ ہو جائے گا
            window.stopAyeshaCompletely(); 
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null, null); 
        } else {
            // ورنہ ریکارڈنگ سٹارٹ ہوگی
            startRecordingSafely();
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim().length > 0) {
            window.stopAyeshaCompletely(); 
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null, null);
        }
    });

});
        
