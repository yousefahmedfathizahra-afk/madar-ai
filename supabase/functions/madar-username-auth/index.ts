import { createClient } from "npm:@supabase/supabase-js@2.110.8";

/* Username-only onboarding via Supabase Auth. No email/phone requested from users.
 * The internal reserved example.com identifier is never delivered to a mailbox.
 * Secret keys remain only inside Supabase Edge Function environment variables.
 */
const SITE="https://madar-ai-yousef.vercel.app";
const cors={
 "Access-Control-Allow-Origin":SITE,
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Max-Age":"600",
 "Vary":"Origin",
 "Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff"
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{...cors,"Content-Type":"application/json;charset=utf-8"}
});
const validUsername=(s:unknown):s is string=>typeof s==="string"&&/^[a-z][a-z0-9_]{2,19}$/.test(s);
const validPassword=(s:unknown):s is string=>typeof s==="string"&&s.length>=10&&s.length<=128&&/\S/.test(s);
const emailFor=(username:string)=>"madar_"+username+"@example.com";
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const digest=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const generateRecovery=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 const raw=hex(bytes);
 return {raw,formatted:raw.match(/.{1,8}/g)!.join("-")};
};
const cleanRecovery=(text:unknown)=>typeof text==="string"?text.toLowerCase().replace(/[\s-]/g,""):"";
function safeEquals(a:string,b:string){
 if(a.length!==b.length)return false;
 let d=0;
 for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
 return d===0;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS"){
  if(req.headers.get("origin")!==SITE)return respond({error:"Origin not allowed"},403);
  return new Response(null,{status:204,headers:cors});
 }
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 if(req.headers.get("origin")!==SITE)return respond({error:"Origin not allowed"},403);
 if(!(req.headers.get("content-type")||"").startsWith("application/json"))return respond({error:"JSON required"},415);
 if(Number(req.headers.get("content-length")||0)>6000)return respond({error:"Request too large"},413);
 try{
  const body=await req.json();
  if(!body||typeof body!=="object"||JSON.stringify(body).length>6000)return respond({error:"Invalid request"},400);
  const action=body.action;
  const username=typeof body.username==="string"?body.username.trim().toLowerCase():"";
  if(!validUsername(username))return respond({error:"Username must be 3–20 letters, numbers, or underscores, and start with a letter."},400);
  if(!["register","recover"].includes(action))return respond({error:"Unsupported request"},400);
  if(!validPassword(body.password))return respond({error:"Password must be 10–128 characters."},400);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const secret=secretKeys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!secret)return respond({error:"Account service not configured"},503);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim().slice(0,65);
  const ipHash=(await digest(ip)).slice(0,30);
  const limit=action==="register"?5:8;
  const key=action+":"+ipHash;
  const {data:permitted,error:limitError}=await admin.rpc("madar_auth_check_limit",{
    p_key:key,p_limit:limit,p_window_seconds:86400
  });
  if(limitError)return respond({error:"Account service is temporarily unavailable"},503);
  if(!permitted)return respond({error:"Too many attempts today. Please try again tomorrow."},429);

  if(action==="register"){
   const {data:created,error:createError}=await admin.auth.admin.createUser({
      email:emailFor(username),
      password:body.password,
      email_confirm:true,
      app_metadata:{madar_username:username}
   });
   if(createError){
      const duplicate=/already|exists|duplicate|registered/i.test(createError.message||"");
      return respond({error:duplicate?"This username is taken. Choose a different one.":"Could not create your account. Check your username and password."},duplicate?409:400);
   }
   if(!created?.user?.id)return respond({error:"Could not create account"},503);
   const code=generateRecovery();
   const {error:dbError}=await admin.from("madar_username_recovery").insert({
     user_id:created.user.id,username,recovery_hash:await digest(code.raw)
   });
   if(dbError){
      await admin.auth.admin.deleteUser(created.user.id);
      return respond({error:"Account service could not save your recovery code. Please try again."},503);
   }
   return respond({ok:true,recoveryCode:code.formatted,username},201);
  }

  const recovery=cleanRecovery(body.recoveryCode);
  if(!/^[0-9a-f]{48}$/.test(recovery))return respond({error:"Invalid username or recovery code."},401);
  const {data:record,error:readError}=await admin.from("madar_username_recovery")
     .select("user_id,recovery_hash").eq("username",username).maybeSingle();
  if(readError)return respond({error:"Account recovery is temporarily unavailable."},503);
  const hash=await digest(recovery);
  if(!record||!safeEquals(hash,String(record.recovery_hash)))return respond({error:"Invalid username or recovery code."},401);
  const {error:updateError}=await admin.auth.admin.updateUserById(record.user_id,{password:body.password});
  if(updateError)return respond({error:"Could not reset password."},503);
  const next=generateRecovery();
  const {error:rotateError}=await admin.from("madar_username_recovery")
    .update({recovery_hash:await digest(next.raw)}).eq("user_id",record.user_id);
  if(rotateError)return respond({error:"Password updated, but recovery code rotation failed. Contact the site owner."},503);
  return respond({ok:true,recoveryCode:next.formatted,username});
 }catch(e){
   console.error("MADAR account request failed",e instanceof Error?e.name:"unknown");
   return respond({error:"Account service could not process your request."},500);
 }
});
