// =========================================================================
// 1. کلاؤڈ آڈیو انجن (بغیر کسی ایرر کے پلے اور پاز)
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
    if(window.AyeshaAudio.audioObj) {
        window.AyeshaAudio.audioObj.pause();
    }
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon;
        b.classList.remove('paused');
    });
    window.AyeshaAudio.currentBtn = null;
};

function playCloudQueue(btnElement) {
    if (window.AyeshaAudio.queue.length === 0) {
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('paused');
        window.AyeshaAudio.currentBtn = null;
        return;
    }

    let textChunk = window.AyeshaAudio.queue.shift();
    let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textChunk)}&tl=${window.AyeshaAudio.lang}&client=tw-ob`;
    
    window.AyeshaAudio.audioObj = new Audio(url);
    window.AyeshaAudio.audioObj.onended = () => playCloudQueue(btnElement);
    window.AyeshaAudio.audioObj.onerror = () => playCloudQueue(btnElement);
    
    window.AyeshaAudio.audioObj.play().catch(e => {
        console.log("Cloud Audio Error:", e);
        btnElement.innerHTML = window.AyeshaAudio.playIcon;
        btnElement.classList.remove('paused');
    });
}

window.toggleVoiceMessage = function(btnElement) {
    let rawText = decodeURIComponent(btnElement.getAttribute('data-text'));
    let cleanText = rawText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

    // اگر یہی بٹن پہلے سے چل رہا ہے تو پاز / ریزیوم کریں
    if (window.AyeshaAudio.currentBtn === btnElement && window.AyeshaAudio.audioObj) {
        if (!window.AyeshaAudio.audioObj.paused) {
            window.AyeshaAudio.audioObj.pause();
            btnElement.innerHTML = window.AyeshaAudio.playIcon;
            btnElement.classList.remove('paused');
        } else {
            window.AyeshaAudio.audioObj.play();
            btnElement.innerHTML = window.AyeshaAudio.pauseIcon;
            btnElement.classList.add('paused');
        }
        return;
    }

    // نیا میسج چلائیں
    window.stopAyeshaCompletely();
    window.AyeshaAudio.currentBtn = btnElement;

    const isUrdu = /[\u0600-\u06FF]/.test(cleanText);
    window.AyeshaAudio.lang = isUrdu ? 'ur' : 'en';

    // کلاؤڈ کے لیے لمبے میسج کو چھوٹے حصوں میں توڑنا
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
    btnElement.classList.add('paused');
    
    playCloudQueue(btnElement);
};


// =========================================================================
// 2. مین UI، ڈبل ٹائپنگ کا خاتمہ اور میسج ہینڈلنگ
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

    function addMessage(text, sender, imgSrc = null) {
        const msgDiv = document.createElement('div');
        let imgHtml = imgSrc ? `<img src="${imgSrc}" class="w-full max-w-[220px] rounded-lg mb-3 border-2 border-[#3a8ff7] shadow-lg">` : '';

        if (sender === 'user') {
            msgDiv.className = 'w-full flex justify-end mt-4';
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
            setTimeout(() => {
                const allBtns = document.querySelectorAll('.gemini-speaker-btn');
                if(allBtns.length > 0) {
                    window.toggleVoiceMessage(allBtns[allBtns.length - 1]);
                }
            }, 300);
            
        } catch (err) {
            hideThinking();
            addMessage("سرور آف لائن ہے۔ انٹرنیٹ چیک کریں۔", 'assistant');
        }
    }

    // 🔴 ڈبل ٹائپنگ کا پکا اور فائنل فکس
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];

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

            // یہ لوپ ہمیشہ زیرو (0) سے شروع ہوگا اور پرانے الفاظ دوبارہ نہیں لکھے گا
            recognition.onresult = function(event) {
                let fullText = '';
                for (let i = 0; i < event.results.length; ++i) {
                    fullText += event.results[i][0].transcript;
                }
                input.value = fullText;
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

});
                          
