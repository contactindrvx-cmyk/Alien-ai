window.AyeshaAudio = {
    audioObj: null, queue: [], lang: 'ur',
    playIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    pauseIcon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    currentBtn: null
};

let isCallActive = false;
let isCallMuted = false;

window.stopAyeshaCompletely = function() {
    if(window.AyeshaAudio.audioObj) window.AyeshaAudio.audioObj.pause();
    window.AyeshaAudio.queue = []; 
    document.querySelectorAll('.gemini-speaker-btn').forEach(b => {
        b.innerHTML = window.AyeshaAudio.playIcon; b.classList.remove('playing-audio');
    });
};

function showToast(message) {
    const toast = document.getElementById('top-toast');
    document.getElementById('toast-text').innerText = message;
    toast.classList.remove('opacity-0', '-translate-y-10', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-10', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    const inputPill = document.getElementById('input-pill');
    const plusBtn = document.getElementById('plus-btn');
    const micActionBtn = document.getElementById('mic-action-btn');
    const sendActionBtn = document.getElementById('send-action-btn');
    const startCallBtn = document.getElementById('start-call-btn');
    const normalChatUI = document.getElementById('normal-chat-ui');
    const activeCallUI = document.getElementById('active-call-ui');
    
    const muteCallBtn = document.getElementById('mute-call-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const unmutedIcon = document.getElementById('unmuted-icon-call');
    const mutedIcon = document.getElementById('muted-icon-call');

    function updateUI() {
        if(isCallActive) return; // اگر کال چل رہی ہے تو نارمل UI اپڈیٹ مت کرو
        
        const hasText = input.value.trim().length > 0;
        if (hasText) {
            sendActionBtn.classList.remove('hidden'); 
            micActionBtn.classList.add('hidden');
            startCallBtn.classList.add('hidden');
        } else {
            sendActionBtn.classList.add('hidden'); 
            micActionBtn.classList.remove('hidden');
            startCallBtn.classList.remove('hidden');
        }
    }
    input.addEventListener('input', updateUI);

    // 🚀 کال شروع کرنے کی اینیمیشن اور لاجک 🚀
    startCallBtn.onclick = (e) => {
        e.preventDefault();
        isCallActive = true;
        isCallMuted = false;

        // UI کو کال موڈ میں شفٹ کریں
        plusBtn.style.opacity = '0'; plusBtn.style.pointerEvents = 'none';
        inputPill.style.paddingLeft = '10px';
        
        normalChatUI.style.opacity = '0'; normalChatUI.style.pointerEvents = 'none';
        setTimeout(() => {
            activeCallUI.classList.remove('fade-exit', 'fade-exit-active');
            activeCallUI.classList.add('fade-enter-active');
        }, 150);

        unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
        muteCallBtn.classList.replace('bg-[#3a8ff7]/20', 'bg-[#2f3037]');

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) {
            window.AndroidBridge.toggleCall(true);
        }
    };

    // 🚀 کال اینڈ کرنے کی اینیمیشن اور لاجک 🚀
    endCallBtn.onclick = () => {
        isCallActive = false;

        // UI کو نارمل موڈ میں واپس لائیں
        activeCallUI.classList.remove('fade-enter-active');
        activeCallUI.classList.add('fade-exit-active');
        
        setTimeout(() => {
            normalChatUI.style.opacity = '1'; normalChatUI.style.pointerEvents = 'auto';
            plusBtn.style.opacity = '1'; plusBtn.style.pointerEvents = 'auto';
            inputPill.style.paddingLeft = '56px';
        }, 300);

        showToast("Voice chat ended");

        if (window.AndroidBridge && window.AndroidBridge.toggleCall) {
            window.AndroidBridge.toggleCall(false);
        }
    };

    // 🚀 کال کے دوران میوٹ کنٹرول 🚀
    muteCallBtn.onclick = () => {
        isCallMuted = !isCallMuted;
        if(isCallMuted) {
            unmutedIcon.classList.add('hidden'); mutedIcon.classList.remove('hidden');
            muteCallBtn.classList.replace('bg-[#2f3037]', 'bg-red-500/20');
        } else {
            unmutedIcon.classList.remove('hidden'); mutedIcon.classList.add('hidden');
            muteCallBtn.classList.replace('bg-red-500/20', 'bg-[#2f3037]');
        }
        
        if (window.AndroidBridge && window.AndroidBridge.muteCall) {
            window.AndroidBridge.muteCall(isCallMuted);
        }
    };

    // (باقی پرانا Voice Typing اور Hugging Face کا کوڈ ویسے ہی رہے گا جو میں نے پچھلے میسج میں دیا تھا)
});
