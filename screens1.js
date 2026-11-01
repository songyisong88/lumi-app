/* 01 splash */
const SPL=[['ตลาดผลงาน AI ของคนไทย<br>ซื้อง่าย ใช้ได้ทันที','ภาพโปรโมต สติกเกอร์ คาแรกเตอร์ พรอมต์ และวิดีโอ จากครีเอเตอร์ไทยและทั่วโลก ซื้อแล้วนำไปใช้ได้ทันที'],
['เปิดร้านขายผลงานของคุณ<br>รับเงินเข้าบัญชีทุกสัปดาห์','อัปโหลดผลงาน ตั้งราคาเอง ลูมิดูแลการชำระเงินและส่งไฟล์ให้ผู้ซื้อ ค่าธรรมเนียมเพียง 15%'],
['ตรวจลิขสิทธิ์ทุกผลงาน<br>ซื้อได้อย่างมั่นใจ','ทุกผลงานผ่านการตรวจก่อนเผยแพร่ หากพรอมต์ใช้งานไม่ได้ตามตัวอย่าง ขอคืนเงินได้ภายใน 7 วัน']];
let splT;
function splash(){
  U.spl=U.spl||0;
  const html=`<div class="scr" style="background:#1A0B35">
<div class="img" style="position:absolute;inset:0;background-image:url(${IMG('splashbg')})"></div>
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,11,53,.1) 0%,rgba(26,11,53,.05) 45%,rgba(22,8,44,.9) 66%,#160830 100%)"></div>
<div style="position:absolute;left:30px;top:96px;width:172px;height:232px;border-radius:24px;border:5px solid #fff;transform:rotate(-8deg);box-shadow:0 20px 40px rgba(0,0,0,.4);overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('fantasy')})"></div></div>
<div style="position:absolute;right:28px;top:78px;width:170px;height:212px;border-radius:24px;border:5px solid #fff;transform:rotate(7deg);box-shadow:0 20px 40px rgba(0,0,0,.4);overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('thaitea')})"></div></div>
<div style="position:absolute;left:96px;top:222px;width:186px;height:196px;border-radius:24px;border:5px solid #fff;transform:rotate(-2deg);box-shadow:0 24px 48px rgba(0,0,0,.45);overflow:hidden;background:#fff"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('mascot')})"></div></div>
<div style="position:absolute;left:22px;top:350px;height:40px;padding:0 14px;border-radius:20px;background:#fff;display:flex;align-items:center;gap:6px;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,.25)">${star(15)}<b>4.9</b><span class="mut">รีวิว 1.2k</span></div>
<div style="position:absolute;right:24px;top:300px;height:42px;padding:0 16px;border-radius:21px;background:#fff;display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,.25)">${ic('check',18,'#16A34A',2.6)}ขายได้ ฿249</div>
<div style="position:absolute;left:28px;right:28px;bottom:0;color:#fff">
<div class="row g10">${lumiLogo(44)}<span style="font-size:24px;font-weight:600">ลูมิ</span></div>
<h1 id="splT" style="font-size:26px;line-height:1.4;font-weight:600;margin-top:16px;min-height:72px;white-space:nowrap">${SPL[U.spl][0]}</h1>
<p id="splD" style="font-size:14.5px;opacity:.82;margin-top:10px;line-height:1.6;min-height:46px">${SPL[U.spl][1]}</p>
<div class="row g6" style="margin:20px 0 26px" id="splDots">${SPL.map((_,i)=>`<button onclick="setSpl(${i})" style="height:7px;border-radius:4px;width:${i===U.spl?28:7}px;background:${i===U.spl?'#fff':'rgba(255,255,255,.4)'};transition:all .3s"></button>`).join('')}</div>
<button class="btn g" style="width:100%" onclick="go('#/login')">เริ่มต้นใช้งาน</button>
<div style="text-align:center;font-size:14.5px;margin:18px 0 44px;opacity:.85">มีบัญชีอยู่แล้ว <a onclick="U.loginTab=1;go('#/login')" style="font-weight:600;cursor:pointer">เข้าสู่ระบบ</a></div></div>
${sample(true)}</div>`;
  return {html,light:true,hiLight:true,after(){clearInterval(splT);if(!SHOT) splT=setInterval(()=>{if(!location.hash.startsWith('#/splash')&&location.hash){clearInterval(splT);return}setSpl((U.spl+1)%3)},4200)}};
}
function setSpl(i){U.spl=i;const t=$('#splT');if(!t)return;t.innerHTML=SPL[i][0];$('#splD').innerHTML=SPL[i][1];
  document.querySelectorAll('#splDots button').forEach((b,j)=>{b.style.width=(j===i?28:7)+'px';b.style.background=j===i?'#fff':'rgba(255,255,255,.4)'})}

/* 02 login */
function login(){
  const tab=U.loginTab||0, role=S.role;
  const html=`<div class="scr"><div class="scroll pt">
${topbar('',`<span class="f13 mut" style="width:60px;text-align:right">ภาษาไทย</span>`)}
<div class="px">
<div class="row g10" style="margin-top:6px"><div class="row">${['av_fasai','av_kenji','av_mint','av_nova'].map((a,i)=>`<div class="av" style="width:44px;height:44px;background-image:url(${IMG(a)});border:2.5px solid #fff;margin-left:${i?-12:0}px"></div>`).join('')}</div>
<div class="f13 mut" style="line-height:1.4">ครีเอเตอร์กว่า <b style="color:var(--ink)">3,200</b> คน<br>เปิดร้านกับเราแล้ว</div></div>
<h1 style="font-size:28px;font-weight:600;margin-top:22px">ยินดีต้อนรับสู่ <span class="gtext">ลูมิ</span></h1>
<p class="mut f15" style="margin-top:4px">สมัครฟรี ซื้อผลงานหรือเปิดร้านขายได้ในบัญชีเดียว</p>
<div style="margin-top:20px;background:var(--soft);border-radius:16px;padding:5px;display:flex">${['สมัครสมาชิก','เข้าสู่ระบบ'].map((t,i)=>`<button onclick="U.loginTab=${i};render()" style="flex:1;height:46px;border-radius:12px;font-size:15px;font-weight:${i===tab?600:500};${i===tab?'background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);color:var(--ink)':'color:var(--mut)'}">${t}</button>`).join('')}</div>
<button class="btn" style="width:100%;margin-top:14px;background:#06C755;color:#fff" onclick="socialLogin('LINE')"><span style="width:28px;height:28px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center">${ic('msg',17,'#06C755',2.4)}</span>ดำเนินการต่อด้วย LINE</button>
<div class="row g10" style="margin-top:12px"><button class="btn o" style="flex:1" onclick="socialLogin('Google')"><svg width="22" height="22" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Google</button>
<button class="btn o" style="flex:1" onclick="socialLogin('Apple')">${ic('apple',22,'#000',0,'#000')}Apple</button></div>
<div class="row g10" style="margin:20px 0 14px"><div style="flex:1;height:1px;background:var(--line)"></div><span class="f13 mut">หรือใช้เบอร์โทรศัพท์</span><div style="flex:1;height:1px;background:var(--line)"></div></div>
<div class="lbl">เบอร์โทรศัพท์</div>
<div class="field"><span class="row g6 f15">+66 ${ic('down',16,'#8A86A0')}</span><span style="width:1px;height:24px;background:var(--line)"></span><input id="phone" inputmode="tel" value="${esc(U.phone||'081 234 5678')}" oninput="U.phone=this.value"></div>
${tab===0?`<div class="lbl" style="margin-top:16px">ฉันต้องการใช้ลูมิเพื่อ</div>
<div class="row g10">${[['buy','cart','ซื้อผลงาน','หาภาพและพรอมต์'],['sell','tag','ขายผลงาน','เปิดร้านครีเอเตอร์']].map(([k,i,t,d])=>`<button onclick="S.role='${k}';save();render()" style="flex:1;text-align:left;padding:14px;border-radius:18px;position:relative;border:${role===k?'2px solid var(--p);background:var(--soft2)':'1.5px solid var(--line);background:#fff'}">${ic(i,24,'var(--p)')}<div class="b6 f16" style="margin-top:10px">${t}</div><div class="f13 mut">${d}</div>
<span style="position:absolute;top:14px;right:14px">${role===k?`<span style="width:24px;height:24px;border-radius:12px;background:var(--p);display:flex;align-items:center;justify-content:center">${ic('check',15,'#fff',3)}</span>`:'<span class="radio"></span>'}</span></button>`).join('')}</div>`:''}
<button class="btn g" style="width:100%;margin-top:22px" onclick="sendOtp()">รับรหัส OTP</button>
<p class="f13 mut" style="text-align:center;margin:16px 0 40px;line-height:1.6">เมื่อดำเนินการต่อ แสดงว่าคุณยอมรับ <a class="purple b5">ข้อกำหนดการใช้งาน</a><br>และ <a class="purple b5">นโยบายความเป็นส่วนตัว</a> ของลูมิ</p>
</div></div>${sample()}</div>`;
  return {html};
}
function socialLogin(n){toast(`จำลองการเข้าสู่ระบบด้วย ${n} สำเร็จ`);S.loggedIn=true;save();setTimeout(()=>go('#/home'),700)}
function sendOtp(){
  const ph=($('#phone')?.value||'').replace(/\D/g,'');
  if(ph.length<9){toast('กรุณากรอกเบอร์โทรศัพท์ให้ครบ','x');return}
  sheet(`<h3 style="font-size:20px;font-weight:600">กรอกรหัส OTP</h3><p class="mut f14" style="margin-top:4px">ส่งรหัส 6 หลักไปที่ +66 ${esc($('#phone').value)} แล้ว</p>
<div class="otp" style="margin:22px 0 10px">${[0,1,2,3,4,5].map(i=>`<input maxlength="1" inputmode="numeric" data-i="${i}">`).join('')}</div>
<div class="row sp f13" style="margin-bottom:18px"><span class="mut">ระบบจำลอง: รหัสตัวอย่างคือ <b style="color:var(--ink)">123456</b></span><a class="purple b6" style="cursor:pointer" onclick="fillOtp()">กรอกให้อัตโนมัติ</a></div>
<button class="btn g" style="width:100%" onclick="verifyOtp()">ยืนยันรหัส</button>
<p class="f13 mut" style="text-align:center;margin-top:14px">ขอรหัสใหม่ได้ใน <b id="otpT">00:59</b></p>`,s=>{
    const ins=[...s.querySelectorAll('.otp input')];ins[0].focus();
    ins.forEach((el,i)=>{el.oninput=()=>{el.value=el.value.replace(/\D/g,'');if(el.value&&ins[i+1])ins[i+1].focus();if(ins.every(x=>x.value))verifyOtp()};el.onkeydown=e=>{if(e.key==='Backspace'&&!el.value&&ins[i-1])ins[i-1].focus()}});
    let t=59;const iv=setInterval(()=>{const e=$('#otpT');if(!e){clearInterval(iv);return}t--;e.textContent='00:'+String(Math.max(t,0)).padStart(2,'0');if(t<=0)clearInterval(iv)},1000);
  });
}
function fillOtp(){document.querySelectorAll('.otp input').forEach((e,i)=>e.value='123456'[i]);verifyOtp()}
function verifyOtp(){
  const v=[...document.querySelectorAll('.otp input')].map(e=>e.value).join('');
  if(v!=='123456'){toast('รหัสไม่ถูกต้อง ในระบบจำลองใช้ 123456','x');return}
  S.loggedIn=true;save();closeSheet();toast('ยืนยันตัวตนสำเร็จ ยินดีต้อนรับครับ');setTimeout(()=>go(S.role==='sell'?'#/dashboard':'#/home'),600);
}

/* 03 home */
const HOMECATS=[['all','ทั้งหมด'],['promo','ภาพโปรโมต'],['sticker','สติกเกอร์'],['character','คาแรกเตอร์'],['prompt','พรอมต์'],['video','วิดีโอ']];
const BANNERS=[{id:'coffee',t:'ชุดภาพโปรโมตร้านกาแฟ<br>30 ภาพ',s:'โดย Brew Visual · ใช้เชิงพาณิชย์ได้',img:'coffee',pos:'70% 50%'},{id:'prompt',t:'แพ็กพรอมต์ภาพบุคคล<br>แฟนตาซี 25 แบบ',s:'โดย NOVA Lab · ทดสอบแล้วทุกพรอมต์',img:'fantasy',pos:'50% 25%'},{id:'mascot',t:'มาสคอตมะม่วง<br>พร้อมท่าทาง 8 ท่า',s:'โดย มิ้นท์ สตูดิโอ · ไฟล์ PNG และ AI',img:'mascot',pos:'50% 40%'}];
let banT;
function home(){
  const cat=U.homeCat||'all';
  let list=PRODUCTS.filter(p=>!['coldbrew','coffee','bakery','cafe','padthai'].includes(p.id));
  if(cat!=='all') list=PRODUCTS.filter(p=>p.type===cat);
  const unread=NOTIS.filter(n=>n.unread&&!S.readNotis.includes(n.id)).length;
  const bi=U.ban||0;
  const html=`<div class="scr"><div class="scroll pt" id="homeScroll">
<div class="row sp px" style="height:60px"><div class="row g10">${lumiLogo(38)}<span style="font-size:22px;font-weight:600">ลูมิ</span></div>
<div class="row g10"><button class="ib" onclick="go('#/notifications')">${ic('bell',22,'#16132B',2)}${unread?'<span class="dot"></span>':''}</button>
<button class="ib" onclick="go('#/cart')">${ic('cart',22,'#16132B',2)}${S.cart.length?`<span class="cnt">${S.cart.length}</span>`:''}</button></div></div>
<div class="px" style="margin-top:8px"><div class="field" style="background:var(--soft);border:0;height:54px;cursor:text" onclick="go('#/search')">${ic('search',22,'#8A86A0',2)}<span class="mut f15" style="flex:1">ค้นหาภาพ สติกเกอร์ หรือพรอมต์</span>${ic('camera',22,'var(--p)',2)}</div></div>
<div class="chips" style="margin-top:16px">${HOMECATS.map(([k,l])=>`<button class="chip ${cat===k?'on':''}" onclick="U.homeCat='${k}';render()">${l}</button>`).join('')}</div>
<div style="margin:18px 20px 0;position:relative;height:200px;border-radius:24px;overflow:hidden;cursor:pointer" id="banner" onclick="openProduct(BANNERS[U.ban||0].id)">
${BANNERS.map((b,i)=>`<div class="bn" style="position:absolute;inset:0;opacity:${i===bi?1:0};transition:opacity .5s"><div class="img" style="position:absolute;inset:0;background-image:url(${IMG(b.img)});background-position:${b.pos}"></div>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(25,14,8,.9) 0%,rgba(25,14,8,.55) 50%,rgba(0,0,0,0) 85%)"></div>
<div style="position:absolute;left:18px;top:16px;right:18px;color:#fff"><span class="tagp" style="background:rgba(255,255,255,.18);color:#fff;height:26px">แนะนำ · โฆษณา</span>
<div style="font-size:21px;font-weight:600;line-height:1.35;margin-top:10px">${b.t}</div><div class="f13" style="opacity:.85;margin-top:2px">${b.s}</div>
<div class="row g10" style="margin-top:12px"><span style="background:#fff;color:var(--ink);border-radius:12px;padding:6px 14px;font-weight:600;font-size:17px">${baht(P(b.id).price)}</span>${P(b.id).was?`<span style="text-decoration:line-through;opacity:.7;font-size:16px">${baht(P(b.id).was)}</span>`:''}</div></div></div>`).join('')}</div>
<div class="row g6" style="justify-content:center;margin-top:10px" id="banDots">${BANNERS.map((_,i)=>`<span style="height:6px;border-radius:3px;width:${i===bi?22:6}px;background:${i===bi?'var(--p)':'#D9D5E5'};transition:all .3s"></span>`).join('')}</div>
<div class="section-h" style="margin-top:12px"><h3>${cat==='all'?'มาแรงวันนี้':HOMECATS.find(c=>c[0]===cat)[1]+'ยอดนิยม'}</h3><a onclick="${cat==='sticker'?"go('#/category/sticker')":`U.sq='';U.f=Object.assign(defF(),{types:${cat==='all'?'[]':`['${cat}']`}});go('#/search')`}">ดูทั้งหมด</a></div>
${list.length?masonry(list):'<div class="empty">ยังไม่มีผลงานในหมวดนี้</div>'}
<div style="height:24px"></div></div>${tabbar('home')}${sample()}</div>`;
  return {html,after(v){
    clearInterval(banT);if(SHOT)return;
    banT=setInterval(()=>{const b=document.querySelectorAll('#banner .bn');if(!b.length){clearInterval(banT);return}U.ban=((U.ban||0)+1)%3;
      b.forEach((e,i)=>e.style.opacity=i===U.ban?1:0);document.querySelectorAll('#banDots span').forEach((e,i)=>{e.style.width=(i===U.ban?22:6)+'px';e.style.background=i===U.ban?'var(--p)':'#D9D5E5'})},4000);
  }};
}

/* 04 search */
function defF(){return {types:['promo'],max:300,rating:4.5,commercial:true,thai:false,sort:'best'}}
const SORTS={best:'ขายดีที่สุด',new:'ใหม่ล่าสุด',low:'ราคาต่ำไปสูง',rate:'คะแนนสูงสุด'};
function applySearch(f,q){
  let l=PRODUCTS.filter(p=>(!f.types.length||f.types.includes(p.type))&&p.price<=f.max&&p.rating>=f.rating&&(!f.commercial||p.commercial)&&(!f.thai||['fasai','mint','pim','brew','glow','kenji'].includes(p.by)));
  if(q){const w=q.replace('ภาพโปรโมต','').replace('เครื่องดื่ม','').trim();const words=q.split(/\s+/);
    const l2=l.filter(p=>(p.title+(p.full||'')+TYPES[p.type]+CREATORS[p.by].name).includes(q)||['ชา','กาแฟ','เครื่องดื่ม'].some(k=>q.includes(k)&&(p.title+p.short).match(/ชา|กาแฟ/)));
    if(l2.length||!w) l=l2.length?l2:l; else l=l.filter(p=>(p.title+CREATORS[p.by].name).includes(w));}
  const k={best:(a,b)=>parseFloat(b.sold)*(b.sold.includes('k')?1000:1)-parseFloat(a.sold)*(a.sold.includes('k')?1000:1),new:()=>0,low:(a,b)=>a.price-b.price,rate:(a,b)=>b.rating-a.rating}[f.sort];
  return l.sort(k);
}
const fakeCount=(n,f)=>n?Math.round(642*n*(f.max>=1000?1.6:f.max/300)*(f.commercial?1:1.25)*(f.thai?.7:1)*(f.rating<4.5?1.3:1)*(1+Math.max(0,f.types.length-1)*.8)):0;
function search(){
  U.f=U.f||defF();if(U.sq===undefined)U.sq='ภาพโปรโมตเครื่องดื่ม';
  const f=U.f, res=applySearch(f,U.sq);
  const nf=(f.types.length?1:0)+(f.max<1000?1:0)+(f.rating>0?1:0)+(f.commercial?1:0)+(f.thai?1:0);
  const html=`<div class="scr"><div class="scroll pt">
<div class="row g10 px" style="height:64px"><button class="ib" onclick="goBack()">${ic('back',22,'#16132B',2.2)}</button>
<div class="field" style="flex:1;height:50px;border:1.5px solid var(--p);background:var(--soft2)">${ic('search',20,'var(--p)',2.2)}<input id="sq" value="${esc(U.sq)}" placeholder="ค้นหาผลงาน" onkeydown="if(event.key==='Enter'){U.sq=this.value;render()}" style="font-size:15.5px;font-weight:500">${U.sq?`<button onclick="U.sq='';render()">${ic('x',18,'#8A86A0',2)}</button>`:''}</div></div>
<div class="chips" style="margin-top:6px"><button class="chip on" onclick="openFilter()">${ic('sliders',18,'#fff',2)}ตัวกรอง ${nf}</button>
${f.types.map(t=>`<button class="chip" style="background:#EFE6FF;color:var(--p)" onclick="openFilter()">${TYPES[t]} ${ic('down',14,'var(--p)',2.2)}</button>`).join('')}
<button class="chip" style="background:#EFE6FF;color:var(--p)" onclick="openFilter()">${f.max>=1000?'ทุกราคา':'ไม่เกิน '+baht(f.max)}</button>
${f.commercial?`<button class="chip" style="background:#EFE6FF;color:var(--p)" onclick="openFilter()">คะแนน ${f.rating}+</button>`:''}</div>
<div class="row sp px f13" style="margin:14px 0 12px"><span class="mut">พบ <b style="color:var(--ink)">${fakeCount(res.length,f).toLocaleString()}</b> ผลงาน</span>
<button class="row g6" onclick="cycleSort()">เรียงตาม: ${SORTS[f.sort]} ${ic('down',14,'#16132B',2)}</button></div>
${res.length?masonry(res):`<div class="empty">${ic('search',40,'#CFCBDC')}<div style="margin-top:10px">ไม่พบผลงานที่ตรงกับตัวกรอง<br>ลองปรับช่วงราคาหรือประเภทผลงาน</div><button class="btn s" style="margin:16px auto 0;padding:0 20px;height:44px" onclick="U.f=defF();U.f.types=[];render()">ล้างตัวกรอง</button></div>`}
<div style="height:20px"></div></div>${tabbar('search')}${sample()}</div>`;
  return {html,after(){if(U.openF){U.openF=false;openFilter()}}};
}
function cycleSort(){const k=Object.keys(SORTS);U.f.sort=k[(k.indexOf(U.f.sort)+1)%k.length];render();toast('เรียงตาม '+SORTS[U.f.sort],'sliders')}
function openFilter(){U.f=U.f||defF();
  const f=JSON.parse(JSON.stringify(U.f));
  const draw=s=>{
    const cnt=fakeCount(applySearch(f,U.sq).length,f);const pct=Math.min(f.max,1000)/1000*100;
    s.innerHTML=`<div class="grab"></div><div class="row sp"><h3 style="font-size:20px;font-weight:600">ตัวกรอง</h3><a class="purple b5 f15" style="cursor:pointer" data-a="clear">ล้างทั้งหมด</a></div>
<div class="lbl" style="margin-top:16px">ประเภทผลงาน</div><div class="row g8" style="flex-wrap:wrap">${Object.entries(TYPES).map(([k,l])=>`<button class="chip ${f.types.includes(k)?'on':''}" data-t="${k}">${l}</button>`).join('')}</div>
<div class="row sp" style="margin-top:20px"><span class="lbl" style="margin:0">ช่วงราคา</span><b class="f15">฿0 – ${f.max>=1000?'฿1,000+':baht(f.max)}</b></div>
<div style="position:relative;height:28px;margin-top:10px"><div style="position:absolute;top:12px;left:0;right:0;height:4px;border-radius:2px;background:var(--line)"></div><div style="position:absolute;top:12px;left:0;width:${pct}%;height:4px;border-radius:2px;background:var(--grad)"></div>
<div style="position:absolute;top:1px;left:0;width:26px;height:26px;border-radius:13px;background:#fff;border:4px solid var(--p)"></div>
<input type="range" class="rng" min="0" max="1000" step="10" value="${Math.min(f.max,1000)}" data-r="1"></div>
<div class="lbl" style="margin-top:18px">คะแนนรีวิว</div><div class="row g8">${[[0,'ทั้งหมด'],[4.5,'4.5 ขึ้นไป'],[4,'4.0 ขึ้นไป']].map(([v,l])=>`<button class="chip ${f.rating===v?'on':''}" data-rt="${v}">${v?star(15):''}${l}</button>`).join('')}</div>
<div class="row sp" style="margin-top:20px"><div><div class="b5 f15">ใช้เชิงพาณิชย์ได้เท่านั้น</div><div class="f13 mut">นำไปใช้โฆษณาร้านค้าได้ถูกต้อง</div></div><div class="switch ${f.commercial?'on':''}" data-s="commercial"></div></div>
<div class="row sp" style="margin-top:16px"><div><div class="b5 f15">ครีเอเตอร์ไทย</div><div class="f13 mut">แสดงเฉพาะผลงานจากครีเอเตอร์ในไทย</div></div><div class="switch ${f.thai?'on':''}" data-s="thai"></div></div>
<div class="row g10" style="margin-top:24px"><button class="btn o" style="flex:1" data-a="cancel">ยกเลิก</button><button class="btn g" style="flex:1.8" data-a="apply">แสดง ${cnt.toLocaleString()} ผลงาน</button></div>`;
    s.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{const t=b.dataset.t;f.types=f.types.includes(t)?f.types.filter(x=>x!==t):[...f.types,t];draw(s)});
    s.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{f.rating=+b.dataset.rt;draw(s)});
    s.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{f[b.dataset.s]=!f[b.dataset.s];draw(s)});
    const r=s.querySelector('[data-r]');r.oninput=()=>{f.max=Math.max(50,+r.value);const fill=r.previousElementSibling.previousElementSibling;const p=(f.max/1000*100);fill.style.width=p+'%';s.querySelector('.row.sp b').textContent='฿0 – '+(f.max>=1000?'฿1,000+':baht(f.max))};r.onchange=()=>draw(s);
    s.querySelector('[data-a=clear]').onclick=()=>{Object.assign(f,{types:[],max:1000,rating:0,commercial:false,thai:false});draw(s)};
    s.querySelector('[data-a=cancel]').onclick=closeSheet;
    s.querySelector('[data-a=apply]').onclick=()=>{U.f=f;closeSheet();render()};
  };
  sheet('',draw);
}

/* 05 category */
const CATS={sticker:{t:'สติกเกอร์',img:'toys',meta:'12,480 ผลงาน · ครีเอเตอร์ 860 คน · พร้อมส่งขึ้น LINE',subs:[['all','ทั้งหมด'],['line','สติกเกอร์ LINE'],['emoji','อีโมจิ'],['die','ไดคัตพิมพ์ได้'],['anim','ขยับได้']]},
 promo:{t:'ภาพโปรโมต',img:'coffee',meta:'28,900 ผลงาน · ครีเอเตอร์ 1,420 คน · ใช้เชิงพาณิชย์ได้',subs:[['all','ทั้งหมด'],['food','อาหารและเครื่องดื่ม'],['beauty','ความงาม'],['fest','เทศกาล']]},
 character:{t:'คาแรกเตอร์',img:'mascot',meta:'6,320 ผลงาน · ครีเอเตอร์ 540 คน',subs:[['all','ทั้งหมด'],['mascot','มาสคอต'],['3d','3 มิติ']]},
 prompt:{t:'พรอมต์',img:'fantasy',meta:'4,180 แพ็ก · ทดสอบแล้วทุกพรอมต์',subs:[['all','ทั้งหมด'],['portrait','ภาพบุคคล'],['product','ภาพสินค้า']]},
 video:{t:'วิดีโอ',img:'perfume',meta:'2,040 คลิป · พร้อมลงโซเชียล',subs:[['all','ทั้งหมด'],['ad','โฆษณาสั้น']]}};
function category(id='sticker'){
  const c=CATS[id]||CATS.sticker;const sub=U.catSub||'all';
  let list=PRODUCTS.filter(p=>p.type===id);if(id==='sticker'&&sub!=='all')list=list.filter(p=>p.sub===sub);
  if(id==='sticker') list=[P('shiba'),P('cats'),P('toys')].filter(p=>list.includes(p)).concat(list.filter(p=>!['shiba','cats','toys'].includes(p.id)));
  const crs=['kenji','fasai','mint','nova','pim'];
  const html=`<div class="scr"><div class="scroll">
<div style="position:relative;height:300px"><div class="img" style="position:absolute;inset:0;background-image:url(${IMG(c.img)});background-position:center 35%"></div>
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(40,20,60,.55) 85%)"></div>
<div class="row sp" style="position:absolute;top:58px;left:20px;right:20px"><button class="ib w" onclick="goBack()">${ic('back',22,'#16132B',2.2)}</button><div class="row g10"><button class="ib w" onclick="U.sq='${c.t}';U.f=Object.assign(defF(),{types:['${id}'],max:1000,rating:0,commercial:false});go('#/search')">${ic('search',20,'#16132B',2.2)}</button><button class="ib w" onclick="shareLink()">${ic('share',20,'#16132B',2)}</button></div></div>
<div style="position:absolute;left:20px;bottom:44px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.3)"><h1 style="font-size:32px;font-weight:600">${c.t}</h1><div class="f14" style="opacity:.92">${c.meta}</div></div></div>
<div style="background:#fff;border-radius:28px 28px 0 0;margin-top:-28px;position:relative;padding-top:20px">
<div class="chips">${c.subs.map(([k,l])=>`<button class="chip ${sub===k?'on':''}" onclick="U.catSub='${k}';render()">${l}</button>`).join('')}</div>
<div class="section-h"><h3>ครีเอเตอร์เด่นในหมวดนี้</h3><a onclick="go('#/creator/kenji')">ดูทั้งหมด</a></div>
<div class="row" style="gap:14px;padding:0 20px;overflow-x:auto;scrollbar-width:none">${crs.map(k=>`<button onclick="go('#/creator/${k}')" style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:none"><div style="width:74px;height:74px;border-radius:37px;padding:3px;background:linear-gradient(135deg,#7B2FF2,#F0508A)"><div class="av" style="width:100%;height:100%;border:3px solid #fff;background-image:url(${IMG(CREATORS[k].av)})"></div></div><span class="f13 b5">${CREATORS[k].name.replace(' ครีเอท','').replace(' สตูดิโอ','')}</span></button>`).join('')}</div>
<div class="section-h"><h3>ผลงานทั้งหมด</h3><button class="row g6 f13" onclick="toast('เรียงตามใหม่ล่าสุด','sliders')">ใหม่ล่าสุด ${ic('down',14,'#16132B',2)}</button></div>
${list.length?masonry(list,{noad:false}):'<div class="empty">ยังไม่มีผลงานในหมวดย่อยนี้</div>'}<div style="height:20px"></div></div></div>
${tabbar('search')}${sample()}</div>`;
  return {html,light:true};
}
function shareLink(){navigator.clipboard?.writeText(location.href).catch(()=>{});toast('คัดลอกลิงก์แล้ว','copy')}
