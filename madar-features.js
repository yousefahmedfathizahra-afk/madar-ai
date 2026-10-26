/* MADAR advanced features: browser-native voice, study, modes, sharing.
   No paid speech endpoints or remote share storage. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const app=window.MADAR_APP;if(!app)return;
let mode='chat',speakingEnabled=false,recognition=null,listening=false,speakingText='';
const SpeechRecognitionCtor=window.SpeechRecognition||window.webkitSpeechRecognition;
const speechSupported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
function notify(text){app.notice(text);}
function language(text){
 const selected=$('madarVoiceLang').value;
 if(selected!=='auto')return selected;
 const value=String(text||'').trim();
 if(!value)return (navigator.language||'en-US').toLowerCase().startsWith('ar')?'ar-EG':'en-US';
 return /[\u0600-\u06ff]/.test(value)?'ar-EG':'en-US';
}
function stopSpeech(){
 if(speechSupported)window.speechSynthesis.cancel();
 speakingText='';
}
function speak(text){
 if(!speechSupported){notify('Audio playback is not supported by this browser. Try Chrome, Edge or Safari.');return;}
 const clean=String(text||'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
   .replace(/[*#_~]+/g,'').replace(/\n+/g,'. ').slice(0,2600);
 if(!clean)return;
 if(window.speechSynthesis.speaking&&speakingText===clean){stopSpeech();return;}
 stopSpeech();
 const utterance=new SpeechSynthesisUtterance(clean);
 utterance.lang=language(clean);utterance.rate=0.97;
 const voices=window.speechSynthesis.getVoices();
 utterance.voice=voices.find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase())
   ||voices.find(v=>v.lang.toLowerCase().startsWith(utterance.lang.slice(0,2).toLowerCase()))
   ||null;
 speakingText=clean;
 utterance.onend=()=>{if(speakingText===clean)speakingText='';};
 utterance.onerror=()=>{speakingText='';notify('Audio playback failed on this device.');};
 try{window.speechSynthesis.speak(utterance);}
 catch{speakingText='';notify('Audio playback could not start.');}
}
function setListening(value){
 listening=value;
 const button=$('madarMicBtn');
 button.setAttribute('aria-pressed',String(value));
 button.textContent=value?'⏹️ Stop':'🎙️ Talk';
 button.classList.toggle('active',value);
}
function toggleMic(){
 if(app.isWaiting()){notify('Wait for MADAR to finish replying before recording.');return;}
 if(listening){try{recognition?.stop();}catch{}setListening(false);return;}
 if(!SpeechRecognitionCtor){
   notify('Speech recognition is not supported here. Try Chrome or Edge, or type your message.');
   return;
 }
 stopSpeech();
 const microphone=new SpeechRecognitionCtor();
 recognition=microphone;
 microphone.lang=language(app.getDraft());
 microphone.interimResults=true;
 microphone.continuous=false;
 const initial=app.getDraft().trim();
 microphone.onresult=event=>{
   let transcript='';
   for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0]?.transcript||'';
   app.setDraft([initial,transcript.trim()].filter(Boolean).join(' ').slice(0,5000));
 };
 microphone.onerror=event=>{
   setListening(false);
   if(event.error==='aborted')return;
   notify(event.error==='not-allowed'
     ?'Microphone blocked. Allow access in your browser settings.'
     :'Could not understand your speech. Try again.');
 };
 microphone.onend=()=>{setListening(false);recognition=null;};
 try{microphone.start();setListening(true);}
 catch{recognition=null;setListening(false);notify('Microphone could not start on this device.');}
}
function setMode(next){
 mode=['chat','study','code','translate','write'].includes(next)?next:'chat';
 $('madarMode').value=mode;
 $('madarStudyActions').hidden=mode!=='study';
 const hint={
  chat:'Message MADAR...',
  study:'اكتب اسم الدرس أو سؤالك الدراسي...',
  code:'Describe your coding question...',
  translate:'Paste text to translate...',
  write:'What would you like to write?'
 };
 $('prompt').placeholder=hint[mode];
 try{localStorage.setItem('madar_selected_mode',mode);}catch{}
}
function studyAction(action){
 if(app.isWaiting())return;
 setMode('study');
 const topic=app.getDraft().trim(),photo=app.hasPendingImage();
 if(!topic&&!photo){
   const examples={
     explain:'اشرح لي درس [اكتب اسم الدرس هنا]',
     quiz:'اعمل لي امتحان في درس [اكتب اسم الدرس هنا]',
     check:'صحح إجابتي: [اكتب الإجابة هنا]'
   };
   app.setDraft(examples[action]);$('prompt').focus();return;
 }
 const context=topic||'الواجب الموجود في الصورة';
 const messages={
  explain:photo?'اشرح المسألة أو الدرس الموجود في الصورة خطوة بخطوة، ولا تخمن أي جزء غير واضح. '+topic:
    'اشرح لي الموضوع ده ببساطة وبالخطوات ومع أمثلة: '+context,
  quiz:'اعمل لي اختبار تفاعلي من خمس أسئلة في الموضوع التالي. اسأل سؤال واحد كل مرة، انتظر إجابتي وصححها قبل السؤال اللي بعده، وفي الآخر احسب درجتي من خمسة. الموضوع: '+context,
  check:'صحح إجابتي ووضح الأخطاء والصواب واديني تقييمًا واضحًا: '+context
 };
 app.sendText(messages[action]);
}
async function shareText(text,button){
 try{
   if(navigator.share){
     try{await navigator.share({title:'MADAR AI',text});return;}
     catch(e){if(e?.name==='AbortError')return;}
   }
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(text);
   if(button){
     const original=button.textContent;button.textContent='✓ Copied';
     setTimeout(()=>{button.textContent=original;},1600);
   }else notify('Conversation copied. Paste it into WhatsApp or any other app.');
 }catch{notify('Could not share automatically. Try using your browser copy option.');}
}
function shareReply(reply,button){
 shareText('MADAR AI:\n'+String(reply||'').slice(0,12000)
   +'\n\nhttps://madar-ai-yousef.vercel.app',button);
}
function shareChat(){
 const chat=app.getActiveChat();
 if(!chat?.messages?.length){notify('Start a chat before sharing it.');return;}
 if(!confirm('Share this chat? It may contain private messages. Only continue if you want others to read them.'))return;
 const content=chat.messages.slice(-25).map(m=>
   (m.role==='user'?'You':'MADAR')+': '+String(m.content||'').slice(0,1500)).join('\n\n');
 shareText('MADAR AI — '+String(chat.title||'Conversation').slice(0,100)
   +'\n\n'+content.slice(0,12000)+'\n\nhttps://madar-ai-yousef.vercel.app',$('shareChatBtn'));
}
function onReply(text){
 if(speakingEnabled)speak(text);
}
$('madarMode').addEventListener('change',e=>setMode(e.target.value));
$('madarMicBtn').addEventListener('click',toggleMic);
function setVoiceEnabled(enabled){
 if(!speechSupported){notify('المتصفح ده مش بيدعم قراءة الردود بصوت. جرّب Chrome أو Edge.');return;}
 speakingEnabled=Boolean(enabled);
 const button=$('madarSpeakToggle');
 button.setAttribute('aria-pressed',String(speakingEnabled));
 button.classList.toggle('active',speakingEnabled);
 button.textContent=speakingEnabled?'🔊 Voice on':'🔈 Voice off';
 if(!speakingEnabled)stopSpeech();
}
$('madarSpeakToggle').addEventListener('click',()=>setVoiceEnabled(!speakingEnabled));
function getModeFor(text,history=[]){
 // All modes remain available without an extra row of mode-selection controls.
 const q=String(text||'').normalize('NFKC').toLowerCase()
   .replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
 if(/(?:^|\s)(?:ترجم|ترجمه|translate|translation)(?:\s|$)/i.test(q))return 'translate';
 if(/(?:امتحني|اختبرني|اعمل\s+اختبار|اعمل\s+امتحان|اسالني\s+اسئله|صحح\s+اجابتي|واجب\s+مدرسي|quiz\s+me|study\s+mode)/i.test(q))return 'study';
 if(/(?:اكتب\s+كود|اعمل\s+كود|شرح\s+كود|بايثون|جافاسكريبت|برمج|debug|python|javascript|typescript|coding|programming)/i.test(q))return 'code';
 if(/(?:اكتب\s+(?:رساله|بوست|مقال|قصه|ايميل)|صيغ\s+(?:رساله|خطاب)|write\s+(?:an?\s+)?(?:email|letter|story|essay|post))/i.test(q))return 'write';
 // A study quiz should remain in tutoring mode over short answer turns.
 const previous=Array.isArray(history)?history.slice(-6):[];
 if(previous.some(m=>m?.role==='assistant'&&/(?:سؤال\s*(?:رقم|[١٢٣٤٥1-5])|question\s*[1-5]\s*(?:of\s*5)?)/i.test(String(m.content||'')))
    &&q.length<160)return 'study';
 return 'chat';
}
$('madarExplain').addEventListener('click',()=>studyAction('explain'));
$('madarQuiz').addEventListener('click',()=>studyAction('quiz'));
$('madarCheck').addEventListener('click',()=>studyAction('check'));
$('shareChatBtn').addEventListener('click',shareChat);
// The mode row is hidden, so don't trap visitors in a previously selected mode.
setMode('chat');
window.MADAR_FEATURES={getMode:()=>mode,getModeFor,setMode,onReply,speak,shareReply,shareChat,stopSpeech,toggleMic,setVoiceEnabled};
})();
