// =========================================================================
// 1. کلاؤڈ آڈیو انجن (اینڈرائیڈ کی پابندی کو بائی پاس کرنے کے لیے)
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    isPlaying: false,
    playIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    stopIcon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    queue: [],
    lang: 'ur'
};

window.playVoiceMessage = function(btnElement) {
    // اگر وہی آواز چل رہی ہے تو اسے روک دیں
    if (btnElement.classList.contains('playing')) {
        if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
        btnElement.classList.remove('playing');
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        return;
    }

    // باقی سب کو خاموش کریں
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    document.querySelectorAll('.inline-play-btn').forEach(b => {
        b.classList.remove('playing');
        b.innerHTML = window.AyeshaAudio.playIcon;
    });

    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    // ایموجیز ہٹائیں تاکہ آڈیو کریش نہ ہو
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    
    // سمارٹ لینگویج (اردو اور انگلش کے لیے)
    window.AyeshaAudio.lang = /[\u0600-\u06FF]/.test(cleanText) ? 'ur' : 'en';
    
    // لمبے میسج کو چھوٹے حصوں میں کاٹنا تاکہ کلاؤڈ سرور بلاک نہ کرے
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
    if (window.AyeshaAudio.queue.length === 0) {
        btnElement.classList.remove('playing');
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        return;
    }

    let text = window.AyeshaAudio.queue.shift();
    // کلاؤڈ آڈیو کا جادو (بغیر موبائل انجن کے)
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playQueue(btnElement);
    window.AyeshaAudio.audioObj.onerror = () => playQueue(btnElement);
    window.AyeshaAudio.audioObj.play().catch(e => {
        console.log("Cloud Audio blocked by browser interaction policy.", e);
        btnElement.classList.remove('playing');
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
    });
}

// عائشہ کا آٹو پلے
window.autoPlayVoice = function(rawText) {
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
        window.AyeshaAudio.audioObj.play().catch(e => console.log("Auto-play requires user click first.", e));
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
        
        if (hasText) {
            micIcon.classList.add('hidden'); stopIcon.classList.add('hidden'); sendIcon.classList.remove('hidden');
        } else if (isRecording) {
            micIcon.classList.add('hidden'); sendIcon.classList.add('hidden'); stopIcon.classList.remove('hidden');
        } else {
            stopIcon.classList.add('hidden'); sendIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
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
            const playIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            
            msgDiv.className = 'relative group w-full mt-4';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10 relative">
                    ${imgHtml}<p style="white-space: pre-wrap;">${text}</p>
                    <button class="inline-play-btn" data-text="${encodedText}" onclick="window.playVoiceMessage(this)" title="Play Audio">
                        ${playIcon}
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

    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];

    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true; 
            recognition.lang = navigator.language || 'en-US';

            recognition.onresult = function(event) {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; } 
                    else { interimTranscript += event.results[i][0].transcript; }
                }
                input.value = finalTranscript || interimTranscript;
                updateUI();
            };

            recognition.onend = function() {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop(); 
                }
            };
        } catch (e) {
            console.log("Speech recognition failed to init.");
        }
    }

    async function startRecordingSafely() {
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
            if (recognition) { recognition.start(); }
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
        try {
            if (recognition) { recognition.stop(); }
            else if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); }
        } catch(e) {}
    }

    actionBtn.onclick = (e) => {
        e.preventDefault();
        if (input.value.trim().length > 0) {
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null, null); 
        } else {
            if (isRecording) { stopRecordingSafely(); } else { startRecordingSafely(); }
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim().length > 0) {
            const text = input.value.trim();
            addMessage(text, 'user');
            input.value = ''; updateUI(); 
            sendToHuggingFace(text, null, null);
        }
    });

});
    
