/* MADAR: username-only sign-in powered by Supabase Auth.
   No email/phone required from visitors. Passwords are never stored by MADAR.
   Recovery codes are generated on the server and shown only once. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const app=window.MADAR_APP;if(!app)return;
const dialog=$('authDialog'),accountBtn=$('accountBtn'),status=$('authStatus');
const usernameEl=$('authUsername'),passwordEl=$('authPassword'),recoveryEl=$('authRecoveryCode');
const form=$('authForm'),loginBtn=$('authLogin'),signupBtn=$('authSignup');
const recoverBtn=$('authRecovery'),resetBtn=$('authReset'),backBtn=$('authBackLogin');
const savedCode=$('authSavedCode'),codeLabel=$('authNewRecoveryCode');
const logoutBtn=$('authLogout'),userBadge=$('authUser');
let client=null,config=null,currentUser=null,connectedUserId=null,booting=null,syncTimer=null;
let mode='login',busy=false,pending=null;
const cleanUsername=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
const validUsername=name=>name.length>0&&[...name].length<=80&&new TextEncoder().encode(name).length<=512&&!/[\x00-\x1f\x7f-\x9f]/u.test(name);
// Keep earlier accounts compatible, including usernames that existed before this update.
const internalEmail=async name=>{
 if(/^[a-z][a-z0-9_]{2,19}$/.test(name))return 'madar_'+name+'@example.com';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(name));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return 'madar_u_'+hash.slice(0,40)+'@example.com';
};
const displayName=(user)=>String(user?.app_metadata?.madar_username||'Account').slice(0,22);

function note(message,bad){
 status.textContent=message||'';
 status.style.color=bad?'#eb91a2':'var(--text)';
}
function display(next){
 mode=next;
 const guest=['login','recover'].includes(mode);
 form.hidden=!guest;
 usernameEl.disabled=passwordEl.disabled=recoveryEl.disabled=!guest;
 $('authRecoveryFields').hidden=mode!=='recover';
 loginBtn.hidden=mode!=='login';signupBtn.hidden=mode!=='login';
 recoverBtn.hidden=mode!=='recover';
 resetBtn.hidden=mode!=='login';backBtn.hidden=mode!=='recover';
 logoutBtn.hidden=mode!=='signedin';userBadge.hidden=mode!=='signedin';
 savedCode.hidden=mode!=='code';
 $('authPasswordLabel').textContent=mode==='recover'?'New password':'Password';
 passwordEl.autocomplete=mode==='recover'?'new-password':'current-password';
 if(mode==='signedin')userBadge.textContent='Signed in as '+displayName(currentUser);
}
function openDialog(){
 if(!dialog.open)dialog.showModal();
 if(mode==='code')return;
 if(!client){display('disabled');note('Connecting to account service...',false);return;}
 if(currentUser){display('signedin');note(connectedUserId?'Your account is connected and chats sync privately.':'Account connected; private chat sync is unavailable.',!connectedUserId);}
 else{display('login');note('Sign in using only your username and password.',false);}
}
function loadSdk(){
 return new Promise((resolve,reject)=>{
  if(window.supabase?.createClient)return resolve(window.supabase);
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.8/dist/umd/supabase.js';
  script.crossOrigin='anonymous';
  script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(Error('Account library could not load.'));
  script.onerror=()=>reject(Error('Account library is temporarily unavailable.'));
  document.head.append(script);
 });
}
async function init(){
 if(booting)return booting;
 booting=(async()=>{
  const r=await fetch('/api/auth-config',{cache:'no-store'});
  if(!r.ok)throw Error('Account settings could not load.');
  config=await r.json();
  if(!config?.configured)throw Error('Accounts are not configured.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!String(config.publishableKey||'').startsWith('sb_publishable_'))throw Error('Invalid account settings.');
  const sdk=await loadSdk();
  client=sdk.createClient(config.url,config.publishableKey,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  client.auth.onAuthStateChange((event,session)=>{
    setTimeout(()=>updateAccount(session,event),0);
  });
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  await updateAccount(data.session,'INITIAL_SESSION');
  if(dialog.open&&mode==='disabled')openDialog();
  return true;
 })().catch(e=>{
   console.warn('MADAR account setup',String(e?.message||'unavailable').slice(0,110));
   if(dialog.open){display('disabled');note('Accounts are temporarily unavailable. You can still chat as a guest.',true);}
   return false;
 });
 return booting;
}
async function updateAccount(session){
 const user=session?.user||null;
 currentUser=user;
 accountBtn.textContent=user?'● '+displayName(user):'Sign in';
 accountBtn.title=user?'Manage your MADAR account':'Sign in or create a MADAR account';
 if(user?.id===connectedUserId)return;
 if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}
 connectedUserId=null;
 if(!user){app.leaveCloud();return;}
 try{
  const {data,error}=await client.from('madar_chats').select('id,title,messages,updated_at')
   .eq('user_id',user.id).order('updated_at',{ascending:false}).limit(35);
  if(error)throw error;
  if(currentUser?.id!==user.id)return;
  connectedUserId=user.id;
  app.enterCloud(user.id,(data||[]).map(row=>({
    id:row.id,title:row.title,updatedAt:Date.parse(row.updated_at)||Date.now(),
    messages:Array.isArray(row.messages)?row.messages:[]
  })));
 }catch{
   app.notice('Signed in, but chat syncing is currently unavailable.');
 }
}
window.MADAR_CLOUD={
 queueSave(chats){
  if(!client||!connectedUserId||currentUser?.id!==connectedUserId)return;
  clearTimeout(syncTimer);
  const owner=connectedUserId;
  const snapshot=chats.slice(0,35).map(c=>({
   id:c.id,user_id:owner,title:String(c.title||'New chat').slice(0,70),
   messages:(c.messages||[]).slice(-100).map(m=>({
    role:m.role,content:String(m.content||'').slice(0,5000),
    sources:Array.isArray(m.sources)?m.sources.slice(0,3):[],
    toolType:['image','builder'].includes(m.toolType)?m.toolType:undefined,
    toolKey:typeof m.toolKey==='string'?m.toolKey.slice(0,110):undefined
   })),
   updated_at:new Date(Number(c.updatedAt)||Date.now()).toISOString()
  }));
  syncTimer=setTimeout(async()=>{
   if(!snapshot.length||connectedUserId!==owner)return;
   try{
    const {error}=await client.from('madar_chats').upsert(snapshot,{onConflict:'id'});
    if(error)throw error;
   }catch{app.notice('Could not sync this conversation. Please check your connection.');}
  },1100);
 },
 async deleteChat(id){
  if(!client||!connectedUserId)return;
  const owner=connectedUserId;
  try{
   const {error}=await client.from('madar_chats').delete().eq('id',id).eq('user_id',owner);
   if(error)throw error;
  }catch{app.notice('Could not delete the conversation from your cloud account.');}
 }
};
async function edgeRequest(action,data){
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),18000);
 try{
  const r=await fetch(config.url+'/functions/v1/madar-username-auth',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':config.publishableKey},
   body:JSON.stringify({action,...data}),signal:abort.signal
  });
  const result=await r.json().catch(()=>null);
  if(!r.ok)throw Error(result?.error||'Account service unavailable.');
  return result;
 }finally{clearTimeout(timeout);}
}
async function login(username,password){
 if(!client)throw Error('Account connection is unavailable.');
 const {error}=await client.auth.signInWithPassword({
  email:await internalEmail(username),password
 });
 if(error)throw Error('Username or password is incorrect. New here? Click Create account.');
}
function showRecoveryCode(code,username,password){
 pending={username,password};
 codeLabel.textContent=code;
 display('code');
 note('Important: copy and save this private recovery code. You will not see it again.',false);
}
function validInput(){
 const name=cleanUsername(usernameEl.value),pass=passwordEl.value;
 if(!validUsername(name))throw Error('Write any name you like, up to 80 characters. Arabic, spaces and symbols are welcome.');
 if(typeof pass!=='string'||pass.length<10||pass.length>128)throw Error('Password must have at least 10 characters.');
 return {username:name,password:pass};
}
async function submit(action){
 if(busy||!client)return;
 busy=true;loginBtn.disabled=signupBtn.disabled=recoverBtn.disabled=true;
 try{
  const input=validInput();
  if(action==='login'){
   await login(input.username,input.password);
   passwordEl.value='';dialog.close();
  }else if(action==='signup'){
   const result=await edgeRequest('register',input);
   if(!result?.recoveryCode)throw Error('Recovery code was not returned. Contact the owner.');
   showRecoveryCode(result.recoveryCode,input.username,input.password);
  }else if(action==='recover'){
   if(!recoveryEl.value.trim())throw Error('Enter your recovery code.');
   const result=await edgeRequest('recover',{...input,recoveryCode:recoveryEl.value.trim()});
   if(!result?.recoveryCode)throw Error('Recovery code was not returned.');
   recoveryEl.value='';
   showRecoveryCode(result.recoveryCode,input.username,input.password);
  }
 }catch(e){note(String(e?.message||'Could not sign in.').slice(0,230),true);}
 finally{busy=false;loginBtn.disabled=signupBtn.disabled=recoverBtn.disabled=false;}
}
accountBtn.addEventListener('click',async()=>{
 openDialog();
 if(!booting)await init();
 if(client&&dialog.open&&mode==='disabled')openDialog();
});
form.addEventListener('submit',e=>{e.preventDefault();submit(e.submitter?.value||'login');});
resetBtn.addEventListener('click',()=>{
 passwordEl.value='';recoveryEl.value='';display('recover');
 note('Use the recovery code you saved when you registered. Enter your new password.',false);
});
backBtn.addEventListener('click',()=>{
 passwordEl.value='';recoveryEl.value='';display('login');
 note('Sign in or create an account with no email.',false);
});
$('authCopyRecovery').addEventListener('click',async()=>{
 try{
  await navigator.clipboard.writeText(codeLabel.textContent||'');
  note('Recovery code copied. Save it somewhere private.',false);
 }catch{note('Select and copy the recovery code manually, then save it privately.',true);}
});
$('authSavedRecovery').addEventListener('click',async()=>{
 if(!pending||busy)return;
 busy=true;
 try{
  await login(pending.username,pending.password);
  pending=null;codeLabel.textContent='';passwordEl.value='';display('signedin');
  dialog.close();
 }catch(e){note(String(e?.message||'Could not sign in.').slice(0,220),true);}
 finally{busy=false;}
});
function closeDialog(){
 if(mode==='code'&&codeLabel.textContent){
  if(!confirm('Did you safely save your recovery code? You cannot see it again after closing this window.'))return;
 }
 pending=null;codeLabel.textContent='';passwordEl.value='';recoveryEl.value='';
 dialog.close();
 if(!currentUser)display('login');
}
$('authClose').addEventListener('click',closeDialog);
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
logoutBtn.addEventListener('click',async()=>{
 if(!client)return;
 try{
  const {error}=await client.auth.signOut();
  if(error)throw error;
  dialog.close();display('login');note('Signed out.',false);
 }catch(e){note(String(e?.message||'Could not sign out.'),true);}
});
init();
})();
