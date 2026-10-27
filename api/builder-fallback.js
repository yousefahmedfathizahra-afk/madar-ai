'use strict';
// Safe, responsive and functional OFFLINE fallback when Gemini is slow or
// quota-limited. Returns a starter/demo site, NEVER pretends it is bespoke AI.
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function categoryFor(input){
 const text=String(input).toLowerCase();
 if(/متجر|بيع|مشتريات|منتجات|ملابس|shop|store|e.?commerce|product/i.test(text))return 'store';
 if(/مطعم|كافيه|كافيه|مطاعم|restaurant|cafe|food/i.test(text))return 'food';
 if(/مدرس|تعليم|كورسات|دروس|اكاديمي|أكاديمي|school|learn|academy|course/i.test(text))return 'education';
 if(/تواصل|اجتماعي|مجتمع|منشورات|سوشيال|social|community|posts|feed/i.test(text))return 'community';
 if(/مستشف|طبيب|عياده|عيادة|صحه|صحة|clinic|medical|doctor/i.test(text))return 'clinic';
 if(/شركة|خدمات|agency|business|company|service/i.test(text))return 'company';
 return 'general';
}
const PRESETS={
 store:{type:'متجر إلكتروني',tab:'المنتجات',items:[['تيشيرت مميز','359 ج.م','👕'],['حقيبة أنيقة','579 ج.م','👜'],['حذاء رياضي','899 ج.م','👟'],['ساعة عصرية','1299 ج.م','⌚'],['سماعات بلوتوث','649 ج.م','🎧'],['نظارة شمسية','299 ج.م','🕶️']],action:'أضف للسلة'},
 food:{type:'مطعم',tab:'المنيو',items:[['برجر مشوي','185 ج.م','🍔'],['بيتزا جبن','245 ج.م','🍕'],['سلطة طازجة','95 ج.م','🥗'],['مكرونة كريمي','210 ج.م','🍝'],['عصير طبيعي','65 ج.م','🥤'],['حلوى اليوم','90 ج.م','🍰']],action:'أضف للطلب'},
 education:{type:'منصة تعليمية',tab:'الكورسات',items:[['أساسيات البرمجة','8 دروس','💻'],['الرياضيات ببساطة','12 درس','📐'],['اللغة الإنجليزية','10 دروس','📘'],['مهارات التصميم','7 دروس','🎨'],['العلوم والتجارب','9 دروس','🔬'],['التفكير الإبداعي','6 دروس','💡']],action:'شوف التفاصيل'},
 community:{type:'منصة اجتماعية',tab:'المنشورات',items:[['أهلاً بالمجتمع','منذ قليل','💬'],['شارك أفكارك','منذ ساعة','✨'],['مشاريع الأعضاء','اليوم','🚀'],['صور وإبداعات','اليوم','📷'],['تعلم حاجة جديدة','أمس','📚'],['أخبار المجتمع','أمس','📢']],action:'تفاعل'},
 clinic:{type:'موقع عيادة',tab:'الخدمات',items:[['كشف عام','خدمة','🩺'],['متابعة صحية','خدمة','💗'],['التحاليل','خدمة','🧪'],['الاستشارات','خدمة','👨‍⚕️'],['تنظيم المواعيد','خدمة','📆'],['نصائح صحية','محتوى','🌿']],action:'تفاصيل الخدمة'},
 company:{type:'موقع شركة',tab:'الخدمات',items:[['تطوير المواقع','خدمة','🌐'],['الهوية البصرية','خدمة','🎨'],['التسويق الرقمي','خدمة','📈'],['الاستشارات','خدمة','🤝'],['الدعم الفني','خدمة','🛠️'],['إدارة المشروعات','خدمة','🗂️']],action:'عرض التفاصيل'},
 general:{type:'موقع إلكتروني',tab:'الأقسام',items:[['خدماتنا','قسم','🚀'],['أعمالنا','قسم','🎯'],['المدونة','قسم','📰'],['الأسئلة الشائعة','قسم','💬'],['فريق العمل','قسم','👥'],['تواصل معنا','قسم','📩']],action:'عرض التفاصيل'}
};
function nameFrom(prompt,config){
 const match=String(prompt).match(/(?:اسمها|اسمه|باسم|اسمو|اسم المشروع|called|named)\s*[:：]?\s*[«"“]?([^\n،.!؟؛"”»]{2,40})/i);
 return (match?match[1].split(/\s+(?:فيه|فيها|وفيه|وفيها|اللي|with|وتكون|وبها|باللغة|بالعربي|حيث)\s+/)[0].trim():config.type).slice(0,45);
}
module.exports=function fallbackWebsite(prompt,spec=null){
 const kind=spec?.category&&PRESETS[spec.category]?spec.category:categoryFor(prompt);
 const original=PRESETS[kind];
 const proposed=Array.isArray(spec?.items)?spec.items.filter(x=>Array.isArray(x)&&x.length>=3&&x[0]?.length>1).slice(0,6):[];
 const config={...original,items:proposed.length>=3?proposed:original.items};
 const brandName=String(spec?.brand||nameFrom(prompt,config)).trim().slice(0,45);
 const brand=esc(brandName),heroTitle=esc(String(spec?.hero||'مساحة جديدة لأفكار أكبر').slice(0,100));
 const tagline=esc(String(spec?.subtitle||('اكتشف تجربة متكاملة عبر '+config.type+' بتصميم عربي أنيق، وأقسام سهلة الاستخدام وتجربة متجاوبة مع الموبايل.')).slice(0,245));
 const accent=/^#[a-fA-F0-9]{6}$/.test(String(spec?.accent||''))?spec.accent:null;
 const label=esc(config.tab),type=esc(config.type);
 const description=esc(String(prompt).slice(0,220));
 const html=[
 '<div id="app" dir="rtl"><header class="site-header"><button class="logo" data-view="home" aria-label="الرئيسية"><span class="logo-icon">✦</span><span>'+brand+'</span></button>',
 '<button class="menu-btn" id="menu-btn" aria-label="القائمة" aria-expanded="false">☰</button>',
 '<nav id="nav" aria-label="التنقل الرئيسي"><button data-view="home" class="nav-active">الرئيسية</button><button data-view="list">'+label+'</button><button data-view="about">من نحن</button><button data-view="contact">تواصل معنا</button></nav>',
 '<button class="counter" data-view="cart" id="cart-btn" aria-label="العناصر المحفوظة">🛒 <span id="count">0</span></button></header>',
 '<main><section class="view" data-page="home"><div class="hero"><div class="hero-text"><span class="eyebrow">مرحباً بك في '+brand+'</span>',
 '<h1>'+heroTitle+'<span class="dot">.</span></h1><p>'+tagline+'</p>',
 '<div class="hero-actions"><button class="primary" data-view="list">استكشف '+label+'</button><button class="secondary" data-view="about">اعرف أكثر</button></div>',
 '<div class="stats"><div><strong>+6</strong><small>خيارات متنوعة</small></div><div><strong>100%</strong><small>متوافق مع الموبايل</small></div><div><strong>عربي</strong><small>تجربة RTL</small></div></div></div>',
 '<div class="hero-art" aria-hidden="true"><div class="big-bubble">✦</div><div class="glass g1">تصميم بسيط</div><div class="glass g2">تجربة تفاعلية ✨</div><div class="shape-a"></div><div class="shape-b"></div></div></div>',
 '<section class="intro"><div><span class="eyebrow">اختياراتنا</span><h2>ابدأ من هنا</h2><p>جرّب الأقسام والبحث والأزرار وشوف الموقع وهو بيتفاعل معاك.</p></div><button class="outline" data-view="list">عرض الكل ←</button></section>',
 '<div class="cards" id="home-cards"></div></section>',
 '<section class="view hidden" data-page="list"><div class="page-head"><span class="eyebrow">استكشف</span><h1>'+label+'</h1><p>ابحث أو اضغط على أي بطاقة لاستعراض التفاصيل.</p>',
 '<label class="search-label">🔎 <input id="search" type="search" placeholder="ابحث هنا..." autocomplete="off" aria-label="بحث"></label></div><div class="cards" id="list-cards"></div><p class="empty hidden" id="no-results">مفيش نتائج للكلمة دي. جرّب بحث تاني.</p></section>',
 '<section class="view hidden" data-page="about"><div class="page-head"><span class="eyebrow">قصتنا</span><h1>أهلاً بيك في '+brand+'</h1><p>إحنا بنهتم بتقديم تجربة سهلة وواضحة من أول زيارة.</p></div>',
 '<div class="info-panel"><h2>فكرتنا</h2><p>'+description+'</p><p>دي واجهة تجريبية قابلة للتطوير. البيانات المعروضة أمثلة للتوضيح وليست خدمة حقيقية.</p><button class="primary" data-view="contact">اتواصل معانا</button></div></section>',
 '<section class="view hidden" data-page="cart"><div class="page-head"><span class="eyebrow">اختياراتك</span><h1>المحفوظات والسلة</h1><p>كل الإضافات هنا محلية داخل المعاينة فقط.</p></div><div id="cart-items" class="info-panel"></div></section>',
 '<section class="view hidden" data-page="contact"><div class="page-head"><span class="eyebrow">تواصل</span><h1>يسعدنا نسمع منك</h1><p>ابعت لنا رسالة تجريبية وتعرف طريقة عمل النموذج.</p></div>',
 '<form id="contact-form" class="contact-form"><label>اسمك<input name="name" required maxlength="70" placeholder="اكتب اسمك"></label><label>رسالتك<textarea name="message" required maxlength="500" rows="4" placeholder="اكتب رسالتك"></textarea></label><button class="primary" type="submit">إرسال تجريبي</button></form>',
 '<p class="notice">ملحوظة: ده نموذج محلي تجريبي؛ الرسائل لا تُرسل لأي جهة. الخدمة تحتاج خادمًا لربط نموذج حقيقي.</p></section></main>',
 '<div class="toast" id="toast" role="status" aria-live="polite"></div><footer><div><strong>'+brand+'</strong><p>تجربة ويب عربية بتصميم بسيط.</p></div><div><button data-view="home">الرئيسية</button><button data-view="list">'+label+'</button><button data-view="contact">التواصل</button></div><small>نموذج تجريبي قابل للتطوير · مصنوع بواسطة MADAR</small></footer></div>'
 ].join('');
 const css=[
 '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Tahoma,"Segoe UI",Arial,sans-serif;color:#192b39;background:#f7f9fc}button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #f0bd57;outline-offset:2px}',
 '.site-header{height:78px;max-width:1230px;margin:auto;padding:0 26px;display:flex;align-items:center;gap:24px}.logo{border:0;background:transparent;font-size:1.3rem;font-weight:900;display:flex;align-items:center;gap:10px;white-space:nowrap}.logo-icon{display:grid;place-items:center;width:39px;height:39px;color:white;border-radius:12px;background:#174e68}nav{margin:auto;display:flex;gap:8px;align-items:center}nav button,footer button{border:0;background:transparent;color:#465967;padding:10px 12px;font-weight:600;border-radius:9px}nav button:hover,nav .nav-active{background:#e5f0f3;color:#174e68}.counter{border:0;background:#e4f1f4;color:#174e68;border-radius:12px;padding:12px 15px;font-weight:bold}.menu-btn{display:none;border:0;background:#e4f1f4;padding:9px 13px;border-radius:9px}',
 'main{min-height:63vh;max-width:1230px;margin:auto;padding:0 26px 64px}.hidden{display:none!important}.hero{min-height:440px;background:#0c364a;color:#fff;border-radius:24px;display:grid;grid-template-columns:1.15fr .85fr;overflow:hidden;position:relative}.hero-text{padding:64px 60px;z-index:1}.eyebrow{color:#0c9f99;background:#dff7f1;padding:6px 13px;border-radius:30px;font-weight:800;font-size:.82rem;display:inline-block}.hero .eyebrow{color:#a6e8d8;background:#155368}.hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1.18;letter-spacing:-2px;max-width:670px;margin:22px 0}.dot{color:#f3b974}.hero p{max-width:570px;color:#d2e4e8;font-size:1.02rem;line-height:2}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:27px}.primary,.secondary,.outline{border:0;padding:13px 23px;border-radius:11px;font-weight:800}.primary{background:#f5b865;color:#192b39}.secondary{background:#ffffff1b;color:#fff;border:1px solid #ffffff44}.outline{background:#ecf6f8;color:#16536e}.stats{display:flex;gap:26px;margin-top:45px}.stats div{display:flex;flex-direction:column;gap:5px}.stats strong{color:#fff;font-size:1.2rem}.stats small{color:#b5d7df}',
 '.hero-art{position:relative;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 65% 40%,#247e85,#0e4454 55%,#0b3045 85%)}.big-bubble{font-size:10rem;filter:drop-shadow(0 15px 35px #021922aa);color:#f6c77d;border:1px solid #87cecf88;border-radius:40px;padding:16px 55px;transform:rotate(-12deg);background:#ffffff18}.glass{position:absolute;background:#fff;color:#174e68;padding:15px 22px;border-radius:13px;box-shadow:0 12px 40px #001c3666;font-weight:800}.g1{right:10%;top:17%;transform:rotate(5deg)}.g2{bottom:14%;left:10%;transform:rotate(-6deg)}.shape-a,.shape-b{position:absolute;border-radius:50%;border:1px solid #8de0ca80;width:270px;height:270px}.shape-a{right:-110px;top:-140px}.shape-b{bottom:-210px;left:-110px;width:380px;height:380px}',
 '.intro,.page-head{padding:56px 0 27px}.intro{display:flex;justify-content:space-between;align-items:end;gap:20px}.intro h2,.page-head h1{font-size:clamp(1.7rem,3.6vw,2.8rem);margin:14px 0}.intro p,.page-head p{color:#697987;line-height:1.9}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{background:white;border:1px solid #e2e8ee;border-radius:17px;overflow:hidden;box-shadow:0 6px 25px #2e486a0d;transition:transform .2s}.card:hover{transform:translateY(-4px)}.card-graphic{height:135px;display:grid;place-items:center;font-size:3.6rem;background:linear-gradient(135deg,#e9f1f5,#d6efe8)}.card-body{padding:21px}.card h3{font-size:1.1rem;margin:0 0 10px}.card p{color:#697987;line-height:1.7;font-size:.85rem;margin:6px 0 16px}.card-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px}.card-bottom span{font-weight:800;color:#13576d}.card-bottom button{border:0;border-radius:10px;background:#163f55;color:#fff;font-size:.81rem;padding:11px 14px}',
 '.search-label{margin:24px 0 0;display:flex;align-items:center;background:#fff;border:1px solid #dfe8ed;max-width:580px;padding:0 18px;border-radius:12px}.search-label input{width:100%;border:0;outline:0;padding:17px;background:transparent}.info-panel{padding:28px;background:#fff;border-radius:18px;border:1px solid #e2e8ef;line-height:2}.info-panel h2{margin:0}.info-panel p{max-width:780px}.contact-form{background:white;border:1px solid #e2e8ef;border-radius:18px;padding:26px;max-width:600px;display:grid;gap:18px}.contact-form label{display:grid;gap:8px;font-weight:700}.contact-form input,.contact-form textarea{padding:14px;border:1px solid #dae3e8;border-radius:10px;width:100%;background:#f9fafb}.notice{font-size:.85rem;color:#997032;line-height:1.7}.toast{position:fixed;left:24px;bottom:24px;padding:13px 22px;background:#16445b;color:white;border-radius:12px;max-width:330px;box-shadow:0 10px 30px #17384833;display:none;z-index:10}footer{border-top:1px solid #e2e8ee;padding:38px max(24px,calc((100vw - 1180px)/2));background:#eef4f7;display:flex;flex-wrap:wrap;justify-content:space-between;gap:25px;color:#546472}footer div{max-width:280px}footer strong{font-size:1.25rem;color:#144b62}footer button{font-size:.85rem;padding:8px}',
 '@media(max-width:800px){.hero{grid-template-columns:1fr}.hero-text{padding:46px 30px}.hero-art{min-height:240px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.menu-btn{display:block;margin-right:auto}nav{display:none;position:absolute;z-index:8;top:70px;left:20px;right:20px;flex-direction:column;background:white;padding:12px;border:1px solid #e2e8ee;border-radius:14px;box-shadow:0 20px 45px #112c4522}nav.open{display:flex}nav button{width:100%;text-align:right}}',
 '@media(max-width:520px){.site-header{gap:10px;height:72px;padding:0 14px}.logo{font-size:1.05rem}.counter{padding:10px}main{padding:0 14px 45px}.hero{border-radius:16px}.hero-text{padding:40px 23px}.hero h1{letter-spacing:-1px}.hero-art{min-height:185px}.big-bubble{font-size:6rem}.stats{gap:14px;margin-top:25px}.cards{grid-template-columns:1fr}.intro{align-items:flex-start;flex-direction:column;padding:35px 0 22px}.page-head{padding:35px 0 18px}.glass{font-size:.8rem;padding:10px}.contact-form{padding:18px}}'
 ].join('\n');
 const themeCss=accent?css.replace(/#0c364a/gi,accent):css;
 const items=JSON.stringify(config.items);
 const action=JSON.stringify(config.action);
 const mode=JSON.stringify(kind);
 const js=[
 '(function(){ "use strict";',
 'const items='+items+',action='+action+',mode='+mode+';',
 'const cart={};const cards=document.getElementById("list-cards"),homeCards=document.getElementById("home-cards");',
 'const safe=(s)=>String(s).replace(/[&<>"\\u0027]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\u0027":"&#39;"}[c]));',
 'function card(item,i){return \x27<article class="card"><div class="card-graphic" aria-hidden="true">\x27+item[2]+\x27</div><div class="card-body"><h3>\x27+safe(item[0])+\x27</h3><p>اكتشف التفاصيل والخصائص في هذا القسم التجريبي.</p><div class="card-bottom"><span>\x27+safe(item[1])+\x27</span><button type="button" data-item="\x27+i+\x27">\x27+action+\x27</button></div></div></article>\x27}',
 'function render(filter){const q=String(filter||"").trim().toLowerCase();cards.innerHTML=items.map((x,i)=>[x,i]).filter(([x])=>x[0].toLowerCase().includes(q)).map(([x,i])=>card(x,i)).join("");document.getElementById("no-results").classList.toggle("hidden",cards.children.length>0);homeCards.innerHTML=items.slice(0,3).map((x,i)=>card(x,i)).join("")}',
 'function toast(text){const t=document.getElementById("toast");t.textContent=text;t.style.display="block";clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display="none",3200)}',
 'function count(){document.getElementById("count").textContent=Object.values(cart).reduce((a,b)=>a+b,0)}',
 'function renderCart(){const el=document.getElementById("cart-items");const rows=Object.entries(cart).filter(([,n])=>n>0);el.replaceChildren();if(!rows.length){const p=document.createElement("p");p.textContent="لسه مفيش عناصر محفوظة. استكشف الأقسام وأضف اختياراتك.";el.append(p);return}for(const [id,n] of rows){const div=document.createElement("p");div.textContent=items[Number(id)][0]+" × "+n+" — "+items[Number(id)][1]+" ";const btn=document.createElement("button");btn.className="outline";btn.textContent="حذف عنصر";btn.addEventListener("click",()=>{delete cart[id];count();renderCart()});div.append(btn);el.append(div)}const end=document.createElement("p");end.textContent="دي سلة تجريبية محلية فقط. لا توجد عمليات دفع أو طلبات حقيقية.";el.append(end)}',
 'function show(page){if(!["home","list","about","cart","contact"].includes(page))return;document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("hidden",x.dataset.page!==page));document.querySelectorAll("#nav button").forEach(x=>x.classList.toggle("nav-active",x.dataset.view===page));document.getElementById("nav").classList.remove("open");document.getElementById("menu-btn").setAttribute("aria-expanded","false");if(page==="cart")renderCart();window.scrollTo({top:0,behavior:"smooth"})}',
 'document.addEventListener("click",e=>{const view=e.target.closest("[data-view]");if(view){show(view.dataset.view);return}const item=e.target.closest("[data-item]");if(item){const i=Number(item.dataset.item);if(!items[i])return;if(mode==="store"||mode==="food"){cart[i]=(cart[i]||0)+1;count();toast("اتضاف للسلة: "+items[i][0])}else toast(items[i][0]+" — محتوى تجريبي. الخدمات الحقيقية تحتاج ربط خادم.")}});',
 'document.getElementById("search").addEventListener("input",e=>render(e.target.value));',
 'document.getElementById("menu-btn").addEventListener("click",()=>{const nav=document.getElementById("nav");const open=nav.classList.toggle("open");document.getElementById("menu-btn").setAttribute("aria-expanded",String(open))});',
 'document.getElementById("contact-form").addEventListener("submit",e=>{e.preventDefault();toast("الرسالة اتعرضت محلياً فقط ولم يتم إرسالها.");e.target.reset()});',
 'render("");count();show("home");})();'
 ].join('\n');
 return{title:brandName,
  html,css:themeCss,js,
  explanation:(spec?'تم تخصيص الاسم والمحتوى والألوان بحسب وصفك. ':'')+'الموقع قالب تفاعلي تجريبي متجاوب، وليس تنفيذًا كاملًا للخدمات الخلفية أو كل التفاصيل. تقدر تعاينه وتعدله وتحمله الآن.'};
};
