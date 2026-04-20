window.AyeshaAudio = { audioObj: null, queue: [], lang: 'ur' };
let isCallActive = false; 
window.isAyeshaRecording = false;

let input, outPlus, outSend, mainPill, inPlus, waveArea, inSend, inMic, inCall, inEnd;
let iMicNormal, iMicStop, fileIn, preview, pendingImg = null, voiceTimeout;

document.addEventListener('DOMContentLoaded', () => {
    input = document.getElementById('user-input'); 
    outPlus = document.getElementById('out-plus'); 
    outSend = document.getElementById('out-send'); 
    mainPill = document.getElementById('main-pill');
    inPlus = document.getElementById('in-plus'); 
    waveArea = document.getElementById('wave-area');
    inSend = document.getElementById('in-send'); 
    inMic = document.getElementById('in-mic');
    inCall = document.getElementById('in-call'); 
    inEnd = document.getElementById('in-end');
    
    iMicNormal = document.getElementById('icon-mic-normal'); 
    iMicStop = document.getElementById('icon-mic-stop');
    fileIn = document.getElementById('hidden-file-input'); 
    preview = document.getElementById('image-preview-container');

    // 🌟 100% پرفیکٹ سٹیٹ مینیجر 🌟
    function updateUIState() {
        const text = input.value.trim();

        // سٹیپ 1: سب سے پہلے ہر چیز کو زبردستی چھپا دیں (Reset All)
        outPlus.classList.add('btn-collapse'); outPlus.classList.remove('btn-expand');
        outSend.classList.add('btn-collapse'); outSend.classList.remove('btn-expand');
        inPlus.classList.add('btn-collapse');
        inSend.classList.add('btn-collapse');
        inMic.classList.add('btn-collapse');
        inCall.classList.add('btn-collapse');
        waveArea.classList.add('btn-collapse');
        inEnd.classList.add('btn-collapse'); inEnd.classList.remove('btn-expand-auto');
        
        mainPill.classList.remove('gemini-glow');
        input.classList.remove('btn-collapse');
        inMic.classList.remove('bg-red-500/20');
        iMicNormal.classList.remove('hidden');
        iMicStop.classList.add('hidden');

        // سٹیپ 2: جو ایکشن ہو رہا ہے، صرف اس کے بٹن آن کریں
        if (isCallActive) {
            // 🔴 لائیو کال سٹیٹ
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            outSend.classList.remove('btn-collapse'); outSend.classList.add('btn-expand');
            input.classList.add('btn-collapse');
            waveArea.classList.remove('btn-collapse');
            inEnd.classList.remove('btn-collapse'); inEnd.classList.add('btn-expand-auto');
        } 
        else if (window.isAyeshaRecording) {
            // 🎤 مائیک ریکارڈنگ سٹیٹ
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inMic.classList.remove('btn-collapse');
            inMic.classList.add('bg-red-500/20');
            iMicNormal.classList.add('hidden');
            iMicStop.classList.remove('hidden');
        } 
        else if (text.length > 0 || pendingImg) {
            // ⌨️ ٹائپنگ سٹیٹ (جہاز بٹن)
            outPlus.classList.remove('btn-collapse'); outPlus.classList.add('btn-expand');
            mainPill.classList.add('gemini-glow');
            inSend.classList.remove('btn-collapse');
        } 
        else {
            // ✅ پرفیکٹ نارمل سٹیٹ (صرف 4 بٹن)
            inPlus.classList.remove('btn-collapse');
            inMic.classList.remove('btn-collapse');
            inCall.classList.remove('btn-collapse');
        }
    }

    input.addEventListener('input', updateUIState);

    const handlePlusClick = (e) => {
        e.preventDefault();
        if(window.AndroidBridge && window.AndroidBridge.openGallery) window.AndroidBridge.openGallery(); 
        else fileIn.click();
    };
    outPlus.onclick = handlePlusClick; inPlus.onclick = handlePlusClick;

    fileIn.onchange = (e) => {
        if(e.target.files[0]) {
            pendingImg = e.target.files[0];
            document.getElementById('preview-img').src = URL.createObjectURL(pendingImg);
            preview.classList.remove('hidden'); updateUIState();
        }
    };
    document.getElementById('remove-img-btn').onclick = () => { pendingImg = null; preview.classList.add('hidden'); fileIn.value=''; updateUIState(); };

    inMic.onclick = () => { 
        if(window.AndroidBridge && window.AndroidBridge.toggleInlineMic) {
            window.AndroidBridge.toggleInlineMic(); 
        }
    };

    window.onInlineMicState = function(isRecording) {
        window.isAyeshaRecording = isRecording;
        if(isRecording) { input.placeholder = "سن رہی ہوں..."; } 
        else { input.placeholder = "Ask something..."; }
        updateUIState();
    };

    window.updateInputFromJava = function(text, finalResult) {
        input.value = text;
        updateUIState();
        if(finalResult) {
            clearTimeout(voiceTimeout);
            voiceTimeout = setTimeout(() => { inSend.click(); }, 1500); 
        }
    };

    inCall.onclick = () => { isCallActive = true; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(true); };
    inEnd.onclick = () => { isCallActive = false; updateUIState(); if(window.AndroidBridge) window.AndroidBridge.toggleCall(false); };
    
    const handleSendClick = (e) => {
        e.preventDefault(); const text = input.value.trim();
        if (text || pendingImg) {
            addMessage(text || "تصویر بھیجی گئی", 'user');
            input.value = ''; pendingImg = null; preview.classList.add('hidden'); 
            
            // سینڈ کے فوراً بعد UI کو نارمل حالت پر لے آئیں
            window.isAyeshaRecording = false;
            updateUIState();
            
            document.getElementById('thinking-indicator').classList.remove('hidden');
            fetch("https://aigrowthbox-ayesha-ai.hf.space/chat", { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ message: text, email: "alirazasabir007@gmail.com" }) 
            })
            .then(res => res.json()).then(d => { 
                document.getElementById('thinking-indicator').classList.add('hidden'); addMessage(d.response, 'assistant');
            }).catch(e => { document.getElementById('thinking-indicator').classList.add('hidden'); addMessage("سرور آف لائن ہے۔", 'assistant'); });
        }
    };
    inSend.onclick = handleSendClick; outSend.onclick = handleSendClick;
});

function addMessage(text, sender) {
    const chatBox = document.getElementById('chat-box'); const msgDiv = document.createElement('div');
    if (sender === 'user') {
        msgDiv.className = 'w-full flex justify-end mt-4';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#2f3037] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    } else {
        msgDiv.className = 'w-full flex justify-start mt-4 group';
        msgDiv.innerHTML = `<div class="chat-bubble border border-[#3a8ff7] bg-[#16243d] p-3 rounded-2xl max-w-[85%]"><p dir="auto">${text}</p></div>`;
    }
    chatBox.insertBefore(msgDiv, document.getElementById('thinking-indicator'));
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
                                                              }
                    
