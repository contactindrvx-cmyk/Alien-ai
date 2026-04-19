// =========================================================================
// 1. ایڈوانسڈ آڈیو انجن (Pause / Resume فیچر کے ساتھ)
// =========================================================================
window.AyeshaAudio = {
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null
};

// جب کوئی نیا میسج آئے یا مائیک دبے تو پرانی آواز کاٹ دے
window.stopAyeshaCompletely = function() {
    if('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon;
        b.classList.remove('paused');
    });
    window.AyeshaAudio.currentBtn = null;
};

// پلے، پاز اور ریزیوم کا مین لاجک
window.toggleVoiceMessage = function(btnElement) {
    if (!('speechSynthesis' in window)) {
        alert("سپیکر سپورٹ نہیں ہے۔");
        return;
    }

    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

    // اگر یہی بٹن پہلے سے چل رہا ہے تو اسے Pause یا Resume کریں
    if (window.AyeshaAudio.currentBtn === btnElement) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause(); // ⏸ آواز روک دو
            btnElement.innerHTML = window.AyeshaAudio.playIcon;
            btnElement.classList.add('paused');
        } else if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume(); // ▶ وہیں سے دوبارہ شروع کرو
            btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
            btnElement.classList.remove('paused');
        }
        return;
    }

    // اگر کوئی نیا میسج پلے کیا ہے تو پرانا بند کرو
    window.stopAyeshaCompletely();
    window.AyeshaAudio.currentBtn = btnElement;

    let speech = new SpeechSynthesisUtterance(cleanText);
    const isUrdu = /[\u0600-\u06FF]/.test(cleanText);
    speech.lang = isUrdu ? 'ur-PK' : (navigator.language || 'en-US');
    speech.rate = 0.95; 

    speech.onstart = () => { 
        btnElement.innerHTML = window.AyeshaAudio.pauseIcon; 
        btnElement.classList.remove('paused');
    };
    speech.onend = () => { 
        window.AyeshaAudio.currentBtn = null;
        btnElement.innerHTML = window.AyeshaAudio.playIcon; 
    };
    speech.onerror = () => { 
        window.AyeshaAudio.currentBtn = null;
        btnElement.innerHTML = window.AyeshaAudio.playIcon; 
    };

    window.speechSynthesis.speak(speech);
};


// =========================================================================
// 2. مین UI، سنگل ٹائپنگ اور میسج ہینڈلنگ
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
            sendToHuggingFace("اس تصویر کو دیکھیں", file, null); 
        }
    };

    menuBtn.onclick = () => { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); };
    overlay.onclick = () => { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); };

    // 🔴 یہ رہا رائٹ الائن (dir="auto") اور سٹکی سپیکر والا میسج فنکشن
    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
            // dir="auto" خود چیک کرے گا کہ اردو ہے تو رائٹ سے شروع کرے
            msgDiv.innerHTML = `
                <div class="chat-bubble user-bubble border border-[#3a8ff7]">
                    ${imgHtml}<p dir="auto" style="white-space: pre-wrap;">${text}</p>
                </div>
            `;
        } else {
            const encodedText = encodeURIComponent(text);
            msgDiv.className = 'w-full flex justify-start mt-4';
            msgDiv.innerHTML = `
                <div class="chat-bubble ayesha-bubble border border-[#3a8ff7] z-10">
                    ${imgHtml}<p dir="auto" style="white-space: pre-wrap;">${text}</p>
                    <button class="gemini-speaker-btn" data-text="${encodedText}" onclick="window.toggleVoiceMessage(this)" title="Play/Pause Audio">
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
            
            // آٹو پلے کے لیے یوزر کے میسج والے بٹن کو ٹرگر کر دیں
            const allBtns = document.querySelectorAll('.gemini-speaker-btn');
            if(allBtns.length > 0) {
                window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
            }
            
        } catch (err) {
            hideThinking();
            addMessage("سرور آف لائن ہے۔ انٹرنیٹ چیک کریں۔", 'assistant');
        }
    }

    // 🔴 ڈبل ٹائپنگ فکس (اب الفاظ آپس میں نہیں جڑیں گے)
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

            // یہ نیا لاجک 100% سنگل ٹائپنگ دے گا
            recognition.onresult = function(event) {
                let fullTranscript = Array.from(event.results)
                                          .map(result => result[0].transcript)
                                          .join('');
                input.value = fullTranscript;
                updateUI();
            };

            recognition.onerror = function(e) {
                console.log("Speech Error:", e.error);
            };

            recognition.onend = function() {
                if (isRecording) {
                    isRecording = false;
                    input.placeholder = "Ask something...";
                    updateUI();
                    if (input.value.trim().length > 0) {
                        const text = input.value.trim();
                        addMessage(text, 'user');
                        input.value = ''; updateUI(); 
                        sendToHuggingFace(text, null);
                    }
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
            // سٹاپ بٹن دبانے پر ٹائپنگ رکے گی اور خود سینڈ ہو جائے گی
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

    document.body.addEventListener('click', () => {
        try { if('speechSynthesis' in window) { window.speechSynthesis.resume(); } } catch(e){}
    }, {once:true});

});
                          
