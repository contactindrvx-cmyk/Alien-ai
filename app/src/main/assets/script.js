// =========================================================================
// 1. آڈیو انجن اور ہارڈویئر کمانڈ سسٹم
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    queue: [],
    lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null,
    torchStream: null // ٹارچ کے لیے
};

// 🔦 ٹارچ (Flashlight) کنٹرول فنکشن
async function toggleTorch(state) {
    try {
        if (state) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const track = stream.getVideoTracks()[0];
            await track.applyConstraints({ advanced: [{ torch: true }] });
            window.AyeshaAudio.torchStream = stream;
        } else {
            if (window.AyeshaAudio.torchStream) {
                const track = window.AyeshaAudio.torchStream.getVideoTracks()[0];
                await track.applyConstraints({ advanced: [{ torch: false }] });
                window.AyeshaAudio.torchStream.getTracks().forEach(t => t.stop());
            }
        }
    } catch (e) { console.log("Torch not supported on this device/browser."); }
}

// 🎯 عائشہ کی باتوں پر ایکشن لینے کا انجن
function executeAyeshaCommand(text) {
    const cmd = text.toLowerCase();

    // 1. ٹارچ آن/آف
    if (cmd.includes("ٹارچ آن") || cmd.includes("torch on") || cmd.includes("لائٹ جلاؤ")) toggleTorch(true);
    if (cmd.includes("ٹارچ آف") || cmd.includes("torch off") || cmd.includes("لائٹ بند")) toggleTorch(false);

    // 2. ویب سرچ (گوگل کروم)
    if (cmd.includes("سرچ") || cmd.includes("search")) {
        let query = text.split("سرچ")[1] || text.split("search")[1];
        if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
    }

    // 3. یوٹیوب
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) {
        window.open("https://www.youtube.com", '_blank');
    }

    // 4. پلے سٹور
    if (cmd.includes("پلے سٹور") || cmd.includes("play store")) {
        window.open("https://play.google.com", '_blank');
    }

    // 5. وائبریشن
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
}

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    window.AyeshaAudio.queue = []; 
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
        return;
    }
    let textChunk = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.play().catch(() => {
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
    let safeParts = cleanText.match(/.{1,150}(\s|$)|.{1,150}/g) || [cleanText];
    window.AyeshaAudio.queue = safeParts.filter(p => p.trim().length > 0);
    btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
    btnElement.classList.add('playing-audio');
    playCloudQueue(btnElement);
};

// =========================================================================
// 2. مین UI، سنگل ٹائپنگ اور 1.5s ٹائمر
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const fileInput = document.getElementById('hidden-file-input');
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const micIcon = document.getElementById('mic-icon');
    const stopIcon = document.getElementById('stop-icon');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const removeImgBtn = document.getElementById('remove-img-btn');
    const chatBox = document.getElementById('chat-box');
    const thinkingIndicator = document.getElementById('thinking-indicator');

    let isRecording = false;
    let pendingImageFile = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let silenceTimer = null;

    function showThinking(text) {
        document.getElementById('indicator-text').innerText = text;
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
            micIcon.classList.add('hidden'); stopIcon.classList.remove('hidden');
            micActionBtn.classList.add('recording-pulse'); sendActionBtn.classList.add('hidden');
        } else {
            stopIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
            micActionBtn.classList.remove('recording-pulse');
            if (hasText || hasImage) {
                sendActionBtn.classList.remove('hidden');
                if(hasImage && !hasText) micActionBtn.classList.remove('hidden');
                else if(hasText) micActionBtn.classList.add('hidden');
            } else {
                sendActionBtn.classList.add('hidden'); micActionBtn.classList.remove('hidden');
            }
        }
    }

    input.addEventListener('input', updateUI);
    input.addEventListener('focus', updateUI);
    input.addEventListener('blur', updateUI);

    plusBtn.onclick = () => fileInput.click(); 

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => { previewImg.src = ev.target.result; previewContainer.classList.remove('hidden'); updateUI(); };
            reader.readAsDataURL(file);
        }
    };

    removeImgBtn.onclick = () => {
        pendingImageFile = null; previewContainer.classList.add('hidden'); fileInput.value = ""; updateUI();
    };

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
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${imgHtml}${cleanText}<button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button></div>`;
        }
        chatBox.insertBefore(msgDiv, thinkingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const fileToBase64 = file => new Promise((res, rej) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => res(reader.result); reader.onerror = e => rej(e);
    });

    async function sendToHuggingFace(text, imageFile, audioBlob = null) {
        showThinking(imageFile ? "تصویر دیکھ رہی ہے..." : (audioBlob ? "آواز سن رہی ہے..." : "ٹائپ کر رہی ہے..."));
        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = { message: text || "", email: "alirazasabir007@gmail.com", local_time: new Date().toLocaleTimeString() };
        try {
            if (imageFile) payload.image = await fileToBase64(imageFile);
            if (audioBlob) payload.audio = await fileToBase64(audioBlob);
            const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();
            hideThinking();
            
            const replyText = data.response || "معاف کیجیے، میں سمجھ نہیں سکی۔";
            addMessage(replyText, 'assistant');
            
            // 🎯 کمانڈ انجن چلائیں
            executeAyeshaCommand(replyText);

            setTimeout(() => {
                const btns = document.querySelectorAll('.gemini-speaker-btn');
                if(btns.length > 0) window.toggleVoiceMessage(btns[btns.length - 1]);
            }, 500);
        } catch (err) { hideThinking(); addMessage("سرور آف لائن ہے۔", 'assistant'); }
    }

    // 🔴 سنگل ٹائپنگ انجن (ڈبلنگ ختم)
    let recognition = null;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; recognition.interimResults = true; recognition.lang = navigator.language || 'ur-PK';
        recognition.onresult = (event) => {
            let finalStr = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) finalStr += event.results[i][0].transcript;
            }
            if(finalStr) {
                // صرف نئے الفاظ ان پٹ میں شامل کریں
                input.value = (input.value + " " + finalStr).replace(/\s+/g, ' ').trim();
                updateUI();
                resetSilenceTimer();
            }
        };
    }

    function stopRecordingAndSend() {
        if (!isRecording) return;
        clearTimeout(silenceTimer);
        if (recognition) { try { recognition.stop(); } catch(e){} }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => { if (isRecording) stopRecordingAndSend(); }, 2500); // 2.5s خاموشی پر بند
    }

    async function startRecording() {
        window.stopAyeshaCompletely();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream); audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                
                // 🎯 1.5 سیکنڈ کا پرفیکٹ ڈیلے
                setTimeout(() => {
                    const text = input.value.trim();
                    if (text || audioChunks.length > 0) {
                        addMessage(text || "🎤", 'user', pendingImageFile ? previewImg.src : null);
                        sendToHuggingFace(text, pendingImageFile, audioBlob);
                        input.value = ''; pendingImageFile = null; previewContainer.classList.add('hidden'); updateUI();
                    }
                    stream.getTracks().forEach(t => t.stop());
                    isRecording = false; updateUI();
                }, 1500); // <-- یہ رہا 1.5 سیکنڈ کا ٹائمر
            };
            input.value = ''; if (recognition) { recognition.start(); resetSilenceTimer(); }
            mediaRecorder.start(); isRecording = true; updateUI();
        } catch (e) { alert("مائیکروفون کی اجازت دیں"); }
    }

    sendActionBtn.onclick = (e) => {
        e.preventDefault(); window.stopAyeshaCompletely();
        const text = input.value.trim();
        if (text || pendingImageFile) {
            addMessage(text, 'user', pendingImageFile ? previewImg.src : null);
            sendToHuggingFace(text, pendingImageFile);
            input.value = ''; pendingImageFile = null; previewContainer.classList.add('hidden'); updateUI();
        }
    };

    micActionBtn.onclick = (e) => {
        e.preventDefault();
        if (isRecording) stopRecordingAndSend();
        else startRecording();
    };

    document.getElementById('menu-btn').onclick = () => { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); };
    document.getElementById('sidebar-overlay').onclick = () => { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); };
});
                
