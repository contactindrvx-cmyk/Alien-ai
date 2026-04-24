// DOM Elements
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('in-send');
const micBtn = document.getElementById('in-mic');
const callBtn = document.getElementById('in-call');
const callModeBar = document.getElementById('call-mode-bar');
const normalModeBar = document.getElementById('normal-mode-bar');
const endCallBtn = document.getElementById('cg-end');

// 🚀 یوزر کا میسج (ببل کے ساتھ) 🚀
function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'flex justify-end mb-6 w-full';
    div.innerHTML = `<div class="bg-[#2f3037] rounded-2xl rounded-tr-sm px-5 py-3 text-gray-200 max-w-[85%] text-right font-sans text-[1.05rem]" dir="rtl">${text}</div>`;
    chatBox.appendChild(div);
    scrollToBottom();
}

// 🚀 عائشہ کا میسج (بغیر ببل کے، ٹائپ رائٹر اور دو بٹنز کے ساتھ) 🚀
// نوٹ: یہ فنکشن کال موڈ میں بھی چلے گا اور سکرین پر لائیو ٹائپنگ دکھائے گا!
window.addMessageFromJava = function(msg) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-end mb-8 w-full pr-2'; 

    // ٹائپنگ والا پلین ٹیکسٹ کنٹینر
    const textDiv = document.createElement('div');
    textDiv.className = 'ai-text-container typing-cursor'; 
    div.appendChild(textDiv);

    // ایکشن بٹنز (کاپی اور سننا) - جو ٹائپنگ ختم ہونے پر ظاہر ہوں گے
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex gap-6 mt-3 text-gray-500 opacity-0 transition-opacity duration-500';
    
    let safeText = msg.replace(/'/g, "\\'");
    actionsDiv.innerHTML = `
        <button onclick="copyToClipboard('${safeText}')" class="hover:text-white transition flex items-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        <button onclick="if(window.AndroidBridge) AndroidBridge.speakText('${safeText}')" class="hover:text-white transition flex items-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
    `;
    div.appendChild(actionsDiv);
    chatBox.appendChild(div);

    // 🚀 ٹائپ رائٹر اینیمیشن (نیچرل لک) 🚀
    let i = 0;
    function typeWriter() {
        if (i < msg.length) {
            textDiv.innerText += msg.charAt(i);
            i++;
            scrollToBottom();
            setTimeout(typeWriter, 25); // 25ms کی سپیڈ
        } else {
            textDiv.classList.remove('typing-cursor'); // کرسر غائب
            actionsDiv.classList.remove('opacity-0'); // بٹن ظاہر
        }
    }
    typeWriter();
};

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast("ٹیکسٹ کاپی ہو گیا!");
}

function showToast(msg) {
    const toast = document.getElementById('top-toast');
    document.getElementById('toast-text').innerText = msg;
    toast.classList.remove('opacity-0', '-translate-y-10');
    setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); }, 2000);
}

// 🚀 ان پٹ بار کا لاجک (سینڈ اور مائیک بٹن کو ٹوگل کرنا) 🚀
userInput.addEventListener('input', () => {
    if (userInput.value.trim().length > 0) {
        sendBtn.classList.remove('btn-collapse');
        sendBtn.classList.add('btn-expand');
        micBtn.classList.add('btn-collapse');
    } else {
        sendBtn.classList.add('btn-collapse');
        sendBtn.classList.remove('btn-expand');
        micBtn.classList.remove('btn-collapse');
    }
});

// میسج سینڈ کرنے کا فنکشن
sendBtn.addEventListener('click', () => {
    const text = userInput.value.trim();
    if (text) {
        addUserMessage(text);
        userInput.value = '';
        userInput.dispatchEvent(new Event('input'));
        if(window.AndroidBridge) AndroidBridge.sendNativeRequest(text, "");
    }
});

// کی بورڈ کے Enter بٹن سے بھی میسج سینڈ کریں
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// 🚀 کال موڈ ٹوگلز (یہاں سکرین چینج نہیں ہو رہی، صرف بار چینج ہو رہی ہے) 🚀
callBtn.addEventListener('click', () => {
    normalModeBar.classList.add('hidden');
    callModeBar.classList.remove('hidden');
    callModeBar.classList.add('flex');
    if(window.AndroidBridge) AndroidBridge.toggleCall(true);
});

endCallBtn.addEventListener('click', () => {
    callModeBar.classList.add('hidden');
    callModeBar.classList.remove('flex');
    normalModeBar.classList.remove('hidden');
    if(window.AndroidBridge) AndroidBridge.toggleCall(false);
});

// 🚀 جاوا سے یوزر کی آواز کا ٹیکسٹ اپڈیٹ کرنا 🚀
window.updateInputFromJava = function(text, isFinal) {
    if (isFinal) {
        addUserMessage(text);
        // کال موڈ میں یوزر کا بولا ہوا ٹیکسٹ سینڈ نہیں کرنا کیونکہ جاوا (AyeshaCallService) اسے خود ہینڈل کر رہی ہے
        // لیکن اگر نارمل موڈ میں ان لائن مائیک استعمال ہوا ہے، تو سینڈ کریں
        if(!callModeBar.classList.contains('flex') && window.AndroidBridge) {
            AndroidBridge.sendNativeRequest(text, "");
        }
    } else {
        userInput.value = text;
        userInput.dispatchEvent(new Event('input'));
    }
};

// سٹریمنگ ہینڈلرز (اگر ضرورت ہو)
window.onStreamStart = function() {};
window.onStreamChunk = function(chunk) {};
window.onStreamEnd = function(finalResponse) {};
