/* MADAR: real email/password authentication and private chat sync.
   No account is created until a dedicated Supabase project is configured. */
(function () {
 'use strict';
 const ui = window.MADAR_APP;
 if (!ui) return;
 const $ = id => document.getElementById(id);
 const dialog = $('authDialog'), status = $('authStatus'), accountBtn = $('accountBtn');
 const email = $('authEmail'), password = $('authPassword'), passwordLabel = $('authPasswordLabel');
 const loginBtn = $('authLogin'), signupBtn = $('authSignup'), logoutBtn = $('authLogout');
 const resetBtn = $('authReset'), recoveryBtn = $('authRecovery'), userBadge = $('authUser');
 let client = null, currentUser = null, connectedUserId = null, booting = null;
 let syncTimer = null, lastMessage = '';
 let whatsappEnabled=false, authMethod='email', sentToPhone=null, lastCodeSentAt=0;
 const APP_URL = window.location.origin + '/';

 function note(message, isError) {
   lastMessage = message;
   status.textContent = message || '';
   status.style.color = isError ? '#eb91a2' : 'var(--text)';
 }
 function setMode(mode) {
   const signedIn = mode === 'signedin', recovery = mode === 'recovery';
   const guest=mode==='guest';
   const requiresEmail = guest && authMethod==='email';
   $('authForm').hidden = signedIn || mode === 'disabled' || (guest && authMethod==='whatsapp');
   $('authMethods').hidden = !guest;
   $('authWhatsAppPanel').hidden = !guest || authMethod!=='whatsapp';
   $('authUseEmail').classList.toggle('selected',authMethod==='email');
   $('authUseWhatsApp').classList.toggle('selected',authMethod==='whatsapp');
   $('authUseEmail').setAttribute('aria-pressed',String(authMethod==='email'));
   $('authUseWhatsApp').setAttribute('aria-pressed',String(authMethod==='whatsapp'));
   $('authSendWhatsApp').disabled=!whatsappEnabled || Date.now()-lastCodeSentAt<60000;
   $('authWhatsAppNotice').textContent=whatsappEnabled
     ?'Your code will be delivered by WhatsApp. Never share it with anyone.'
     :'WhatsApp sign-in is not enabled yet. It needs a Twilio or Twilio Verify message provider, which may charge fees. Use Email for now.';
   email.hidden = !requiresEmail;
   $('authEmailLabel').hidden = !requiresEmail;
   passwordLabel.textContent = recovery ? 'New password' : 'Password';
   passwordLabel.hidden = signedIn;
   password.hidden = signedIn;
   password.autocomplete = recovery ? 'new-password' : 'current-password';
   loginBtn.hidden = mode !== 'guest';
   signupBtn.hidden = mode !== 'guest';
   resetBtn.hidden = mode !== 'guest';
   recoveryBtn.hidden = !recovery;
   logoutBtn.hidden = !signedIn;
   userBadge.hidden = !signedIn;
   if (signedIn) userBadge.textContent = currentUser?.email || currentUser?.phone || 'Signed in';
   if (recovery) password.value='';
 }
 function show() {
   if (!dialog.open) dialog.showModal();
   if (!client) {
     setMode('disabled');
     note('Secure sign-in needs a dedicated MADAR account database. Chat still works, and guest chats stay only on this device.',true);
     return;
   }
   if (dialog.dataset.recovery === 'true') {
     setMode('recovery');note('Choose a new password of at least 8 characters.',false);
   } else if (currentUser) {
     setMode('signedin');note(connectedUserId?'Your account is connected. Your text conversations sync privately.':'You are signed in, but private chat storage is not ready yet.',!connectedUserId);
   } else {
     setMode('guest');note('Use your email address to sign in or create an account.',false);
   }
 }

 function loadSdk() {
   return new Promise((resolve,reject)=>{
     if (window.supabase?.createClient) return resolve(window.supabase);
     const script=document.createElement('script');
     script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/dist/umd/supabase.js';
     script.crossOrigin='anonymous';
     script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error('Auth library could not load.'));
     script.onerror=()=>reject(new Error('Auth library is unavailable. Check your internet connection.'));
     document.head.append(script);
   });
 }
 async function init() {
   if(booting)return booting;
   booting=(async()=>{
     const response=await fetch('/api/auth-config',{cache:'no-store'});
     if(!response.ok)throw new Error('Auth configuration is unavailable.');
     const config=await response.json();
     if(!config?.configured)return false;
     whatsappEnabled=config.whatsappEnabled===true;
     if(whatsappEnabled)authMethod='whatsapp';
     if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) ||
       typeof config.publishableKey!=='string')throw new Error('Invalid authentication settings.');
     const sdk=await loadSdk();
     client=sdk.createClient(config.url,config.publishableKey,{
       auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
     });
     client.auth.onAuthStateChange((event,session)=>{
       // Supabase cautions against async DB calls directly inside this callback.
       setTimeout(()=>updateAccount(session,event),0);
     });
     const {data,error}=await client.auth.getSession();
     if(error)throw error;
     await updateAccount(data.session,'INITIAL_SESSION');
     return true;
   })().catch(err=>{
     console.warn('MADAR auth setup unavailable:',err?.message);
     accountBtn.title='Sign-in is not configured';
     return false;
   });
   return booting;
 }
 async function updateAccount(session,event) {
   if(event==='PASSWORD_RECOVERY') {
     dialog.dataset.recovery='true';
     if(!dialog.open)dialog.showModal();
     setMode('recovery');
     note('Choose a new password (at least 8 characters).',false);
   }
   const user=session?.user || null;
   currentUser=user;
   accountBtn.textContent=user ? '● '+String(user.email||user.phone||'Account').slice(0,22) : 'Sign in';
   accountBtn.title=user?'Manage your account':'Sign in or create an account';
   if(user?.id===connectedUserId)return;
   if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}
   connectedUserId=null;
   if(!user){
     ui.leaveCloud();
     return;
   }
   // Do not mix guest conversations with another person's private account.
   try {
     const result=await client.from('madar_chats')
       .select('id,title,messages,updated_at')
       .eq('user_id',user.id).order('updated_at',{ascending:false}).limit(35);
     if(result.error)throw result.error;
     if(currentUser?.id!==user.id)return;
     connectedUserId=user.id;
     ui.enterCloud(user.id,(result.data||[]).map(row=>({
       id:row.id,title:row.title,updatedAt:Date.parse(row.updated_at)||Date.now(),
       messages:Array.isArray(row.messages)?row.messages:[]
     })));
   } catch (err) {
     note('Signed in, but cloud conversations are not ready. The MADAR database needs the chat table and access policies.',true);
     ui.notice('Your account signed in, but cloud storage is not configured. Guest chats are still saved on this device.');
   }
 }

 window.MADAR_CLOUD = {
   queueSave(chats) {
     if(!client||!connectedUserId || currentUser?.id!==connectedUserId)return;
     clearTimeout(syncTimer);
     const userId=connectedUserId;
     const snapshot=chats.slice(0,35).map(c=>({
       id:c.id,user_id:userId,title:String(c.title||'New chat').slice(0,70),
       messages:(c.messages||[]).slice(-100).map(m=>({
         role:m.role,content:String(m.content||'').slice(0,5000),
         sources:Array.isArray(m.sources)?m.sources.slice(0,3):[]
       })),
       updated_at:new Date(Number(c.updatedAt)||Date.now()).toISOString()
     }));
     syncTimer=setTimeout(async()=>{
       if(!snapshot.length||connectedUserId!==userId)return;
       try {
         const {error}=await client.from('madar_chats').upsert(snapshot,{onConflict:'id'});
         if(error)throw error;
       }catch(err){
         console.warn('MADAR chat sync error:',err?.message);
         ui.notice('Could not sync your private conversations. Please check your connection.');
       }
     },1100);
   },
   async deleteChat(id){
     if(!client||!connectedUserId)return;
     const userId=connectedUserId;
     try {
       const {error}=await client.from('madar_chats').delete()
         .eq('id',id).eq('user_id',userId);
       if(error)throw error;
     }catch(e){ui.notice('This conversation could not be deleted from your cloud account.');}
   }
 };

 accountBtn.addEventListener('click',async()=>{
   show();
   if(!booting)await init();
   if(client && dialog.open && dialog.dataset.recovery !== 'true'){
     if(currentUser){setMode('signedin');note(connectedUserId?'Your account is connected.':'Your account is signed in but private chat storage is not ready.',!connectedUserId);}
     else{setMode('guest');note(authMethod==='whatsapp'?(whatsappEnabled?'Enter your phone number to get a WhatsApp code.':'WhatsApp codes are not set up yet. Choose Email to sign in.'): 'Enter your email and password.',false);}
   }
 });
 $('authClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 async function runAction(action) {
   if(!client)return note('Account service is not connected yet.',true);
   const address=email.value.trim().toLowerCase();
   const secret=password.value;
   if(!/^.+@.+\..+$/.test(address)&&action!=='logout'&&action!=='change')
     return note('Enter a valid email address.',true);
   if(['login','signup','change'].includes(action)&&secret.length<8)
     return note('Password must be at least 8 characters.',true);
   loginBtn.disabled=signupBtn.disabled=resetBtn.disabled=recoveryBtn.disabled=true;
   try {
     let result;
     if(action==='login') result=await client.auth.signInWithPassword({email:address,password:secret});
     else if(action==='signup') result=await client.auth.signUp({
       email:address,password:secret,options:{emailRedirectTo:APP_URL}
     });
     else if(action==='reset') result=await client.auth.resetPasswordForEmail(address,{redirectTo:APP_URL});
     else if(action==='change') result=await client.auth.updateUser({password:secret});
     else return;
     if(result.error)throw result.error;
     password.value='';
     if(action==='signup') {
       if(result.data?.session){note('Your account is ready!',false);dialog.close();}
       else note('Check your email for a confirmation link, then come back to MADAR.',false);
     } else if(action==='reset')note('If the email is registered, you will receive a password reset link.',false);
     else if(action==='change'){note('Password updated successfully.',false);delete dialog.dataset.recovery;setMode('signedin');}
     else{note('Signed in successfully.',false);dialog.close();}
   } catch(e){
     const raw=String(e?.message||'Account request failed.');
     const friendly=/invalid login credentials/i.test(raw)
       ?'Email or password not recognized. New to MADAR? Click Create account first. Otherwise, check your details or use Forgot password?'
       :raw;
     note(friendly.slice(0,250),true);
   }
   finally{loginBtn.disabled=signupBtn.disabled=resetBtn.disabled=recoveryBtn.disabled=false;}
 }

 function displayAuthMethod(method){
   if(currentUser||dialog.dataset.recovery==='true')return;
   authMethod=method;
   setMode('guest');
   if(method==='whatsapp'){
     note(whatsappEnabled?'Enter your mobile number with country code. You will receive a WhatsApp code.':'WhatsApp codes need a messaging provider and are not enabled yet. You can still use Email.',!whatsappEnabled);
   }else note('Use your email and password to sign in or create an account.',false);
 }
 $('authUseWhatsApp').addEventListener('click',()=>displayAuthMethod('whatsapp'));
 $('authUseEmail').addEventListener('click',()=>displayAuthMethod('email'));
 function normalizePhone(input){
   let n=String(input||'').trim().replace(/[\s()-]/g,'');
   if(/^01[0125]\d{8}$/.test(n))n='+20'+n.slice(1);
   if(/^00[1-9]\d{7,14}$/.test(n))n='+'+n.slice(2);
   return /^\+[1-9]\d{7,14}$/.test(n)?n:null;
 }
 async function requestWhatsAppCode(){
   if(!client||!whatsappEnabled)return note('WhatsApp codes are not active yet. Use Email to sign in.',true);
   if(Date.now()-lastCodeSentAt<60000)return note('Please wait at least 60 seconds before requesting another code.',true);
   const phone=normalizePhone($('authPhone').value);
   if(!phone)return note('Enter a valid mobile number including country code, such as +201012345678.',true);
   const send=$('authSendWhatsApp'),resend=$('authResendWhatsApp');
   send.disabled=resend.disabled=true;
   try{
     const {error}=await client.auth.signInWithOtp({phone,options:{channel:'whatsapp',shouldCreateUser:true}});
     if(error)throw error;
     sentToPhone=phone;lastCodeSentAt=Date.now();
     $('authOtpPanel').hidden=false;
     $('authOtp').value='';$('authOtp').focus();
     note('A 6-digit code was requested on WhatsApp. Enter it below. Never share your code.',false);
     setTimeout(()=>{
       if(whatsappEnabled&&Date.now()-lastCodeSentAt>=59000){
         send.disabled=false;resend.disabled=false;
       }
     },60500);
   }catch(err){
     note('Could not send a WhatsApp code: '+String(err?.message||'Message service unavailable').slice(0,170),true);
     send.disabled=!whatsappEnabled;resend.disabled=false;
   }
 }
 async function verifyWhatsAppCode(){
   if(!client||!whatsappEnabled||!sentToPhone)return note('Request a WhatsApp code first.',true);
   const token=$('authOtp').value.trim();
   if(!/^\d{6}$/.test(token))return note('Please enter the 6-digit code from WhatsApp.',true);
   const btn=$('authVerifyWhatsApp');btn.disabled=true;
   try{
     // Supabase uses the "sms" OTP type for phone numbers even if the channel was WhatsApp.
     const {error}=await client.auth.verifyOtp({phone:sentToPhone,token,type:'sms'});
     if(error)throw error;
     $('authOtp').value='';sentToPhone=null;
     note('Phone verified. Welcome to MADAR!',false);
     dialog.close();
   }catch(err){note('The code could not be verified. Check the six digits or request a new code.',true);}
   finally{btn.disabled=false;}
 }
 $('authSendWhatsApp').addEventListener('click',requestWhatsAppCode);
 $('authResendWhatsApp').addEventListener('click',requestWhatsAppCode);
 $('authVerifyWhatsApp').addEventListener('click',verifyWhatsAppCode);
 $('authOtp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();verifyWhatsAppCode();}});

 $('authForm').addEventListener('submit',e=>{e.preventDefault();runAction(e.submitter?.value||'login');});
 resetBtn.addEventListener('click',()=>runAction('reset'));
 recoveryBtn.addEventListener('click',()=>runAction('change'));
 logoutBtn.addEventListener('click',async()=>{
   if(!client)return;
   try{
     const {error}=await client.auth.signOut();
     if(error)throw error;
     dialog.close();
   }catch(e){note(String(e?.message||'Could not sign out.'),true);}
 });
 init();
})();
