// =========================================================================
// 1. آڈیو انجن اور ہارڈویئر کمانڈز
// =========================================================================
window.AyeshaAudio = {
    audioObj: null,
    queue: [],
    lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null,
    torchStream: null
};

// 🔦 ہارڈویئر کنٹرول: ٹارچ
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
    } catch (e) { console.log("Torch not supported."); }
}

// 🎯 فرنٹ اینڈ ہارڈویئر کمانڈز
function executeHardwareCommandLocally(text) {
    let cmd = text.toLowerCase();
    if (cmd.includes("وائبریٹ") || cmd.includes("vibrate")) {
        if (navigator.vibrate) navigator.vibrate([300, 100, 400, 100, 500]); 
    }
    if (cmd.includes("ٹارچ آن") || cmd.includes("لائٹ جلاؤ") || cmd.includes("torch on")) toggleTorch(true);
    if (cmd.includes("ٹارچ آف") || cmd.includes("لائٹ بند") || cmd.includes("torch off")) toggleTorch(false);
    if (cmd.includes("یوٹیوب") || cmd.includes("youtube")) window.open("https://www.youtube.com", '_blank');
    if (cmd.includes("پلے سٹور") || cmd.includes("play store")) window.open("https://play.google.com", '_blank');
    if (cmd.includes("سرچ") || cmd.includes("search")) {
        let query = text.split("سرچ")[1] || text.split("search")[1];
        if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
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
    let safeParts = cleanText.match(/.{1,150}(\s|$)|.{1,150}/g) || [cleanText];
    window.AyeshaAudio.queue = safeParts.filter(p => p.trim().length > 0);
    btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
    btnElement.classList.add('playing-audio');
    playCloudQueue(btnElement);
};

// =========================================================================
// 2. مین UI (بغیر آٹو ٹائمر کے، 100% مینول سینڈ اور گولڈن وائس انجن)
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
            micActionBtn.classList.remove('hidden'); micActionBtn.classList.add('recording-pulse');
            sendActionBtn.classList.add('hidden');
        } else {
            stopIcon.classList.add('hidden'); micIcon.classList.remove('hidden');
            micActionBtn.classList.remove('recording-pulse');
            if (hasText) {
                sendActionBtn.classList.remove('hidden'); micActionBtn.classList.add('hidden');
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
            reader.onload = function(event) {
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
            msgDiv.innerHTML = `<div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">${imgHtml}${cleanText}<button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)">${window.AyeshaAudio.playIcon}</button></div>`;
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

    async function sendToHuggingFace(text, file, audioBlob = null) {
        showThinking(file ? "تصویر دیکھ رہی ہے..." : (audioBlob ? "آواز سن رہی ہے..." : "ٹائپ کر رہی ہے..."));
        const API_URL = "https://aigrowthbox-ayesha-ai.hf.space/chat"; 
        let payload = { message: text || "", email: "alirazasabir007@gmail.com", local_time: new Date().toLocaleTimeString() };
        
        try {
            if (file) payload.image = await fileToBase64(file);
            if (audioBlob) payload.audio = await fileToBase64(audioBlob); // 🎯 آڈیو بھی جا رہی ہے!
            
            const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();
            hideThinking();
            
            const replyText = data.response || "معاف کیجیے، میں سمجھ نہیں سکی۔";
            addMessage(replyText, 'assistant');
            
            if (replyText.includes("وائبریٹ") || replyText.toLowerCase().includes("vibrate") || data.vibrate) {
                if (navigator.vibrate) navigator.vibrate([200, 100, 300, 100, 400]); 
            }

            setTimeout(() => {
                const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                if(allBtns.length > 0) window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
            }, 300);
            
        } catch (err) {
            hideThinking();
            addMessage("سرور آف لائن ہے۔ انٹرنیٹ چیک کریں۔", 'assistant');
        }
    }

    // 🚀 گولڈن وائس ٹائپنگ انجن (رومن اردو + آل لینگویج) - بغیر کسی آٹو ٹائمر کے!
    let recognition = null;
    let finalTranscript = ''; 
    let mediaRecorder = null;
    let audioChunks = [];

    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true; 
            recognition.interimResults = true; 
            recognition.lang = 'en-US'; // 🌟 گولڈن سیٹنگ

            recognition.onresult = function(event) {
                let currentInterim = '';
                let finalStr = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalStr += event.results[i][0].transcript + ' ';
                    } else {
                        currentInterim += event.results[i][0].transcript;
                    }
                }
                if (finalStr) { finalTranscript += finalStr; }
                
                // سکرین پر لائیو دکھاؤ
                input.value = (finalTranscript + ' ' + currentInterim).replace(/\s+/g, ' ').trim();
                updateUI();
                // ❌ آٹو ٹائمر کا کوڈ یہاں سے ہمیشہ کے لیے ڈیلیٹ کر دیا گیا ہے
            };

            recognition.onerror = function(e) { console.log("Speech Error:", e.error); };
            
            // ❌ آٹو ری سٹارٹ (گلچ کی وجہ) بھی ڈیلیٹ کر دیا ہے تاکہ ڈبلنگ نہ ہو

        } catch (e) { console.log("Speech recognition failed."); }
    }

    // 🔴 100% مینول سینڈ فنکشن (صرف تب چلے گا جب آپ سٹاپ دبائیں گے)
    function stopRecordingAndSend() {
        if (!isRecording) return;
        isRecording = false; 
        input.placeholder = "پروسیس ہو رہا ہے...";

        if (recognition) { try { recognition.stop(); } catch(e){} }
        
        // ہلکا سا ڈیلے تاکہ آخری لفظ سکرین پر آ جائے، پھر آڈیو بند کر کے سینڈ کرو
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop(); 
            }
        }, 300);
    }

    async function startRecording() {
        window.stopAyeshaCompletely();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                
                // 🎯 100% گارنٹی: جو سکرین پر لکھا ہے، وہی جائے گا
                const spokenText = input.value.trim();
                const imageToSend = pendingImageFile;
                
                if (spokenText) {
                    executeHardwareCommandLocally(spokenText);
                    addMessage(spokenText, 'user', imageToSend ? previewImg.src : null);
                    sendToHuggingFace(spokenText, imageToSend, audioBlob); // آڈیو + ٹیکسٹ دونوں سینڈ!
                } else if (audioChunks.length > 0) {
                    // یہ صرف تب آئے گا جب آپ مائیک آن کر کے کچھ نہ بولیں اور سٹاپ دبا دیں
                    addMessage("🎤 آڈیو موصول ہوئی", 'user', imageToSend ? previewImg.src : null);
                    sendToHuggingFace("", imageToSend, audioBlob);
                }
                
                // سب صاف کرو
                input.value = ''; 
                finalTranscript = '';
                pendingImageFile = null; 
                previewImg.src = "";
                previewContainer.classList.add('hidden');
                fileInput.value = "";
                
                stream.getTracks().forEach(track => track.stop());
                updateUI();
                input.placeholder = "Ask something...";
            };

            input.value = ''; 
            finalTranscript = '';
            
            if (recognition) { try { recognition.start(); } catch(e){} }
            mediaRecorder.start(); 
            
            isRecording = true;
            updateUI();
            input.placeholder = "بولیں... (بھیجنے کے لیے سٹاپ کا بٹن دبائیں)";
            showThinking("عائشہ سن رہی ہے...");
            
        } catch (err) {
            alert("مائیکروفون کی اجازت درکار ہے!");
        }
    }

    // 🎯 نارمل ٹیکسٹ سینڈ کرنے کے لیے
    sendActionBtn.onclick = (e) => {
        e.preventDefault();
        window.stopAyeshaCompletely();

        const text = input.value.trim();
        const imageToSend = pendingImageFile;
        
        if (text.length > 0 || imageToSend) {
            if (text) executeHardwareCommandLocally(text);

            addMessage(text, 'user', imageToSend ? previewImg.src : null);
            
            input.value = ''; 
            pendingImageFile = null; 
            previewImg.src = "";
            previewContainer.classList.add('hidden');
            fileInput.value = "";
            updateUI(); 
            
            sendToHuggingFace(text, imageToSend, null); 
        }
    };

    // 🎯 مائیک کا مینول کنٹرول (دبائیں تو چلے گا، دبائیں تو رکے گا اور سینڈ ہوگا)
    micActionBtn.onclick = (e) => {
        e.preventDefault();
        if (isRecording) {
            stopRecordingAndSend(); // خود بند کریں اور سینڈ کریں
        } else {
            startRecording(); // مائیک سٹارٹ کریں
        }
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (input.value.trim().length > 0 || pendingImageFile)) {
            if (isRecording) stopRecordingAndSend();
            else sendActionBtn.click();
        }
    });

    document.body.addEventListener('click', () => {
        try { if('speechSynthesis' in window) { window.speechSynthesis.resume(); } } catch(e){}
    }, {once:true});

});
                          
