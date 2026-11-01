/* 06 product detail */
function gallery(p){return [p.img,p.img,p.img,p.img]}
function product(id='thaitea'){
  const p=P(id)||P('thaitea');const c=CREATORS[p.by];const gi=U.gi||0;const g=gallery(p);
  const total=p.unit==='ภาพ'?p.count:g.length;
  const rv=(REVIEWS[p.id]||REVIEWS._)[0];const fol=S.follows.includes(p.by);
  const more=PRODUCTS.filter(x=>x.by===p.by&&x.id!==p.id).slice(0,4);
  const inCart=S.cart.includes(p.id), own=owned(p.id);
  const html=`<div class="scr"><div class="scroll">
<div style="position:relative;height:410px;background:#eee" id="hero">
${g.map((im,i)=>`<div class="img" style="position:absolute;inset:0;background-image:url(${IMG(im)});${i?`background-size:${150+i*25}%;background-position:${['','30% 30%','70% 60%','50% 85%'][i]};`:''}opacity:${i===gi?1:0};transition:opacity .35s"></div>`).join('')}
<div style="position:absolute;left:0;right:0;top:0;height:120px;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent)"></div>
<button style="position:absolute;left:0;top:110px;bottom:40px;width:45%" onclick="U.gi=(${gi}+${g.length}-1)%${g.length};render()"></button><button style="position:absolute;right:0;top:110px;bottom:40px;width:45%" onclick="U.gi=(${gi}+1)%${g.length};render()"></button>
<div class="row sp" style="position:absolute;top:58px;left:20px;right:20px"><button class="ib w" onclick="U.gi=0;goBack()">${ic('back',22,'#16132B',2.2)}</button><div class="row g10"><button class="ib w" onclick="shareLink()">${ic('share',20,'#16132B',2)}</button><button class="ib w" onclick="toggleFav('${p.id}');render()">${isFav(p.id)?ic('heart',21,'#E5487A',2,'#E5487A'):ic('heart',21,'#16132B',2)}</button></div></div>
<div style="position:absolute;right:20px;bottom:44px;background:rgba(22,19,43,.6);backdrop-filter:blur(8px);color:#fff;font-size:13px;padding:5px 12px;border-radius:12px">${gi+1} / ${total}</div>
<div class="row g6" style="position:absolute;left:0;right:0;bottom:46px;justify-content:center">${g.map((_,i)=>`<span style="height:6px;border-radius:3px;width:${i===gi?18:6}px;background:${i===gi?'#fff':'rgba(255,255,255,.55)'}"></span>`).join('')}</div></div>
<div style="background:#fff;border-radius:28px 28px 0 0;margin-top:-28px;position:relative;padding:22px 20px 0">
<div class="row g8"><span class="tagp t-p">${TYPES[p.type]}</span>${p.commercial?`<span class="tagp t-g">${ic('check',14,'#16A34A',2.6)}ใช้เชิงพาณิชย์ได้</span>`:`<span class="tagp t-n">ใช้ส่วนตัว</span>`}</div>
<h1 style="font-size:23px;font-weight:600;line-height:1.4;margin-top:12px">${p.full||p.title}</h1>
<div class="row g6 f14" style="margin-top:6px">${star(16)}<b>${p.rating.toFixed(1)}</b><span class="mut">${p.reviews} รีวิว · ขายแล้ว ${p.sold} ครั้ง · ${p.count} ${p.unit} ${p.res}</span></div>
<div class="card row g12" style="margin-top:18px;padding:14px">
<div class="av" style="width:52px;height:52px;background-image:url(${IMG(c.av)});cursor:pointer" onclick="go('#/creator/${c.id}')"></div>
<div style="flex:1;cursor:pointer" onclick="go('#/creator/${c.id}')"><div class="row g6 b6 f16">${c.name}${c.verified?vbadge(17):''}</div><div class="f13 mut">ผลงาน ${c.works} · ผู้ติดตาม ${c.followers}</div></div>
<button class="btn ${fol?'o':'s'}" style="height:42px;padding:0 18px;font-size:14.5px" onclick="toggleFollow('${c.id}')">${fol?'ติดตามแล้ว':'ติดตาม'}</button></div>
<div class="section-h" style="padding:0;margin-top:22px"><h3>ตัวอย่าง${p.unit==='ภาพ'?'ภาพ':'ผลงาน'}ในชุดนี้</h3><a onclick="previewAll('${p.id}')">ดูครบ ${p.count} ${p.unit}</a></div>
<div class="row g8">${['30% 20%','70% 60%','50% 85%','40% 40%'].map((pos,i)=>`<div style="flex:1;height:84px;border-radius:14px;overflow:hidden;position:relative;cursor:pointer" onclick="previewAll('${p.id}')"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)});background-size:${i%2?260:200}%;background-position:${pos};${i===3?'filter:blur(1px) brightness(.55)':''}"></div>${i===3?`<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">+${Math.max(p.count-3,1)}</span>`:''}</div>`).join('')}</div>
<div class="card" style="margin-top:14px;padding:14px 16px;background:var(--soft)"><div class="row g8 f13"><span class="row g6">${ic('file',17,'var(--p)')}${p.fmt} ${p.size}</span><span class="mut">·</span><span>${p.res}</span><span class="mut">·</span><span>ดาวน์โหลดได้ไม่จำกัด</span></div></div>
<div class="section-h" style="padding:0"><h3>รีวิวจากผู้ซื้อ</h3><a onclick="toast('แสดงรีวิวทั้งหมด ${p.reviews} รายการ (ตัวอย่าง)','star')">ทั้งหมด</a></div>
<div class="card" style="padding:16px"><div class="row g10"><div class="av" style="width:40px;height:40px;background-image:url(${IMG(rv.av)})"></div><div style="flex:1"><div class="b6 f15">${rv.name}</div><div class="f12 mut">${rv.when}</div></div><div class="row" style="gap:2px">${star(14).repeat(rv.stars)}</div></div>
<p class="f14" style="margin-top:10px;line-height:1.6;color:var(--ink2)">${rv.text}</p></div>
${more.length?`<div class="section-h" style="padding:0"><h3>ผลงานอื่นของ${c.name}</h3><a onclick="go('#/creator/${c.id}')">ดูร้าน</a></div>
<div class="row g10" style="overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:0 20px">${more.map(m=>`<div style="flex:none;width:150px;cursor:pointer" onclick="U.gi=0;openProduct('${m.id}')"><div style="height:150px;border-radius:16px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(m.img)})"></div></div><div class="f14 b5" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.short}</div><div class="b6 f15">${baht(m.price)}</div></div>`).join('')}</div>`:''}
<div style="height:24px"></div></div></div>
<div class="bbar row g12"><div style="flex:none"><div class="f13 mut">ราคา</div><div style="font-size:24px;font-weight:700">${baht(p.price)}</div></div>
${own?`<button class="btn g" style="flex:1" onclick="go('#/library')">${ic('download',20,'#fff',2.2)}เปิดในคลังของฉัน</button>`:
`<button class="ib" style="width:56px;height:56px;border-radius:16px;background:var(--soft2)" onclick="addCart('${p.id}')">${inCart?ic('check',24,'var(--p)',2.4):ic('cart',24,'var(--p)',2)}</button>
<button class="btn g" style="flex:1" onclick="buyNow('${p.id}')">ซื้อเลย</button>`}</div>${sample()}</div>`;
  return {html,light:true};
}
function toggleFollow(id){if(S.follows.includes(id)){S.follows=S.follows.filter(x=>x!==id);toast('เลิกติดตามแล้ว','user')}else{S.follows.push(id);toast('ติดตาม '+CREATORS[id].name+' แล้ว','user')}save();render()}
function addCart(id){if(S.cart.includes(id)){toast('มีในตะกร้าแล้ว','cart');return}S.cart.push(id);save();toast('เพิ่มลงตะกร้าแล้ว','cart');render()}
function buyNow(id){if(!S.cart.includes(id))S.cart.push(id);save();go('#/cart')}
function previewAll(id){const p=P(id);const g=gallery(p);
  sheet(`<h3 style="font-size:19px;font-weight:600">${p.short} · ${p.count} ${p.unit}</h3><p class="f13 mut" style="margin:4px 0 14px">ภาพตัวอย่างมีลายน้ำ ไฟล์จริงไม่มีลายน้ำหลังชำระเงิน</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${Array.from({length:9},(_,i)=>`<div style="aspect-ratio:1;border-radius:12px;overflow:hidden;position:relative"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)});background-size:${180+(i%3)*50}%;background-position:${(i*37)%100}% ${(i*61)%100}%"></div><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);font-weight:600;font-size:12px;transform:rotate(-20deg)">ลูมิ ตัวอย่าง</span></div>`).join('')}</div>
<button class="btn g" style="width:100%;margin-top:18px" onclick="closeSheet();buyNow('${id}')">ซื้อเลย ${baht(p.price)}</button>`)}

/* 07 prompt pack */
function promptPage(id='prompt'){
  const p=P(id)||P('prompt');const c=CREATORS[p.by];const own=owned(p.id);const rv=REVIEWS.prompt[0];
  const ims=['fantasy','elephant','robot','rainy'];
  const html=`<div class="scr"><div class="scroll pt">
${topbar('',`<div class="row g10"><button class="ib" onclick="shareLink()">${ic('share',20,'#16132B',2)}</button><button class="ib" onclick="toggleFav('${p.id}');render()">${isFav(p.id)?ic('heart',21,'#E5487A',2,'#E5487A'):ic('heart',21,'#16132B',2)}</button></div>`)}
<div class="px row g8" style="height:300px;margin-top:4px;align-items:stretch">
<div style="flex:1.45;border-radius:22px;overflow:hidden;position:relative"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('fantasy')})"></div><span class="ovtag" style="left:12px;bottom:12px">ผลลัพธ์จริง 1/25</span></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px"><div style="flex:1;border-radius:18px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('elephant')})"></div></div>
<div style="flex:1;border-radius:18px;overflow:hidden;position:relative;cursor:pointer" onclick="previewAll('${p.id}')"><div class="img" style="width:100%;height:100%;background-image:url(${IMG('robot')});filter:brightness(.55)"></div><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:18px">+22 ภาพ</span></div></div></div>
<div class="px" style="margin-top:16px">
<div class="row g6" style="flex-wrap:wrap"><span class="tagp t-p">พรอมต์</span><span class="tagp t-g">${ic('check',14,'#16A34A',2.6)}ทดสอบแล้ว 25/25</span>${p.tools.map(t=>`<span class="tagp t-n">${t}</span>`).join('')}</div>
<h1 style="font-size:23px;font-weight:600;line-height:1.4;margin-top:12px">${p.title}</h1>
<div class="row g6 f14" style="margin-top:6px">${star(16)}<b>${p.rating}</b><span class="mut">${p.reviews} รีวิว · โดย</span><a class="purple b6" style="cursor:pointer" onclick="go('#/creator/nova')">${c.name}</a>${vbadge(15)}</div>
<div style="margin-top:18px;background:#1B1631;border-radius:20px;padding:16px;color:#fff;position:relative;overflow:hidden">
<div class="row sp"><span class="f13" style="color:#C9B6FF">พรอมต์ที่ 01 · ${PROMPTS[0].t}</span><button class="row g6 f13" style="color:#fff;background:rgba(255,255,255,.1);padding:6px 10px;border-radius:10px" onclick="copyPrompt(0)">${ic('copy',15,'#fff',2)}คัดลอก</button></div>
<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.65;margin-top:10px;color:#EDE7FF">${PROMPTS[0].txt}</div>
${own?PROMPTS.slice(1).map((x,i)=>`<div style="border-top:1px solid rgba(255,255,255,.1);margin-top:12px;padding-top:12px"><div class="row sp"><span class="f13" style="color:#C9B6FF">พรอมต์ที่ ${x.n} · ${x.t}</span><button class="row g6 f13" style="color:#fff;background:rgba(255,255,255,.1);padding:6px 10px;border-radius:10px" onclick="copyPrompt(${i+1})">${ic('copy',15,'#fff',2)}คัดลอก</button></div><div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.65;margin-top:8px;color:#EDE7FF">${x.txt}</div></div>`).join('')+`<div class="f13" style="margin-top:12px;color:#9FE3B5">${ic('check',14,'#9FE3B5',2.6)} ปลดล็อกแล้ว แสดงตัวอย่าง 4 จาก 25 พรอมต์</div>`:
`<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.65;margin-top:8px;filter:blur(5px);opacity:.75;user-select:none">${PROMPTS[1].txt} ${PROMPTS[2].txt}</div>
<div class="row g8 f14 b5" style="justify-content:center;margin-top:12px;color:#fff">${ic('lock',17,'#FFB020',2.2)}ปลดล็อกครบ 25 พรอมต์หลังชำระเงิน</div>`}</div>
<div class="row g8" style="margin-top:14px">
<div class="card" style="flex:1;padding:12px;text-align:center">${ic('video',24,'var(--p)')}<div class="f13 b6" style="margin-top:6px">วิดีโอสอน</div><div class="f12 mut">12 นาที</div></div>
<div class="card" style="flex:1;padding:12px;text-align:center">${ic('file',24,'var(--p)')}<div class="f13 b6" style="margin-top:6px">เทคนิคปรับแต่ง</div><div class="f12 mut">PDF 18 หน้า</div></div>
<div class="card" style="flex:1;padding:12px;text-align:center;background:#FFF4DC;border-color:#FFE2A3">${ic('refresh',24,'#C77A00')}<div class="f13 b6" style="margin-top:6px">ใช้ไม่ได้ คืนเงิน</div><div class="f12" style="color:#9A6A10">ภายใน 7 วัน</div></div></div>
<div class="card" style="padding:16px;margin-top:14px"><div class="row g10"><div class="av" style="width:40px;height:40px;background-image:url(${IMG(rv.av)})"></div><div style="flex:1"><div class="b6 f15">${rv.name}</div><div class="f12 mut">${rv.when} · ใช้กับ Grok Imagine</div></div><div class="row" style="gap:2px">${star(14).repeat(5)}</div></div>
<p class="f14" style="margin-top:10px;line-height:1.6;color:var(--ink2)">${rv.text}</p></div>
<div style="height:24px"></div></div></div>
<div class="bbar row g12">${own?`<div style="flex:none"><div class="f13 mut">สถานะ</div><div class="b6 f16" style="color:var(--green)">ซื้อแล้ว</div></div><button class="btn g" style="flex:1" onclick="copyPrompt(0)">${ic('copy',20,'#fff',2)}คัดลอกพรอมต์</button>`:
`<div style="flex:none"><div class="row g6"><span class="f14 mut" style="text-decoration:line-through">${baht(p.was)}</span><span class="tagp" style="height:22px;padding:0 8px;background:#FDEBF1;color:#E5487A;font-size:12px">ลด ${Math.round((1-p.price/p.was)*100)}%</span></div><div style="font-size:24px;font-weight:700">${baht(p.price)}</div></div>
<button class="btn g" style="flex:1" onclick="buyNow('${p.id}')">${ic('lock',19,'#fff',2.2)}ซื้อและปลดล็อก</button>`}</div>${sample()}</div>`;
  return {html};
}
function copyPrompt(i){navigator.clipboard?.writeText(PROMPTS[i].txt).catch(()=>{});toast('คัดลอกพรอมต์ที่ '+PROMPTS[i].n+' แล้ว','copy')}

/* 08 cart & checkout */
const PAY={promptpay:['พร้อมเพย์','สแกน QR จ่ายผ่านแอปธนาคาร','qr'],card:['บัตรเครดิต / เดบิต','Visa, Mastercard, JCB','card'],truemoney:['TrueMoney Wallet','ผูกเบอร์ 081-xxx-5678','wallet']};
function cartItems(){return S.cart.map(id=>id==='commission'?{id,short:'งานจ้าง: มาสคอตร้านผลไม้ปั่น',title:'งานจ้าง: มาสคอตร้านผลไม้ปั่น',price:1800,img:'mascot',by:'kenji',type:'character',commission:true}:P(id)).filter(Boolean)}
function totals(){const items=cartItems();const sub=items.reduce((a,b)=>a+b.price,0);const plus=S.plus?Math.round(sub*0.1*100)/100:0;const cp=S.coupon==='LUMI50'&&sub>0?50:0;return {items,sub,plus,cp,total:Math.max(0,Math.round((sub-plus-cp)*100)/100)}}
function cart(){
  const pay=U.pay||'promptpay';const t=totals();
  const html=`<div class="scr"><div class="scroll pt">${topbar('ตะกร้าและชำระเงิน',`<span class="f14 mut" style="width:46px;text-align:right">${t.items.length} ชิ้น</span>`)}
<div class="px">
${t.items.length?t.items.map(p=>`<div class="card row g12" style="padding:12px;margin-bottom:10px"><div style="width:72px;height:72px;border-radius:14px;overflow:hidden;flex:none;cursor:pointer" onclick="${p.commission?'':`openProduct('${p.id}')`}"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)})"></div></div>
<div style="flex:1;min-width:0"><div class="b6 f15" style="line-height:1.35">${p.title}</div><div class="f13 mut" style="margin-top:2px">${CREATORS[p.by].name} · ${p.commission?'เงินพักไว้กับลูมิ':TYPES[p.type]}</div>
<div class="row sp" style="margin-top:4px"><b class="f16">${baht(p.price)}</b><button onclick="rmCart('${p.id}')" style="padding:4px">${ic('trash',19,'#8A86A0',1.9)}</button></div></div></div>`).join(''):
`<div class="empty">${ic('cart',44,'#CFCBDC')}<div style="margin-top:10px">ตะกร้าของคุณยังว่างอยู่</div><button class="btn s" style="margin:16px auto 0;padding:0 22px;height:46px" onclick="go('#/home')">เลือกซื้อผลงาน</button></div>`}
${t.items.length?`
<div class="field" style="margin-top:6px;background:var(--soft2);border-style:dashed;border-color:#D9C8FF">${ic('tag',20,'var(--p)',2)}<input id="cp" placeholder="กรอกโค้ดส่วนลด" value="${esc(S.coupon)}" style="font-size:15px;text-transform:uppercase"><button class="purple b6 f15" onclick="applyCoupon()">${S.coupon==='LUMI50'?'ใช้แล้ว':'ใช้โค้ด'}</button></div>
<div class="f12 mut" style="margin:6px 4px 0">ลองใช้โค้ดตัวอย่าง <b>LUMI50</b> ลด ฿50</div>
<div class="lbl" style="margin-top:20px">วิธีชำระเงิน</div>
${Object.entries(PAY).map(([k,[n,d,i]])=>`<button class="card row g12" style="width:100%;padding:14px;margin-bottom:10px;text-align:left;${pay===k?'border:2px solid var(--p);background:var(--soft2)':''}" onclick="U.pay='${k}';render()">
<span style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:${k==='promptpay'?'#103D7C':k==='truemoney'?'#FF7A00':'#16132B'};flex:none">${k==='promptpay'?'<b style="color:#fff;font-size:10px;line-height:1.05;text-align:center">Prompt<br>Pay</b>':ic(i,22,'#fff',2)}</span>
<span style="flex:1"><span class="b6 f15" style="display:block">${n}</span><span class="f13 mut">${d}</span></span><span class="radio ${pay===k?'on':''}"></span></button>`).join('')}
<div class="card" style="padding:16px;margin-top:6px">
<div class="row sp f15"><span class="mut">ราคาสินค้า (${t.items.length} รายการ)</span><span>${baht(t.sub,1)}</span></div>
${S.plus?`<div class="row sp f15" style="margin-top:8px"><span class="row g6" style="color:var(--p)">${ic('crown',16,'#FFB020',2)}ส่วนลดสมาชิกลูมิ พลัส 10%</span><span style="color:var(--p)">-${baht(t.plus,1)}</span></div>`:''}
${t.cp?`<div class="row sp f15" style="margin-top:8px"><span style="color:var(--green)">โค้ด LUMI50</span><span style="color:var(--green)">-฿50.00</span></div>`:''}
<div style="height:1px;background:var(--line);margin:12px 0"></div>
<div class="row sp"><b class="f16">ยอดชำระ</b><b style="font-size:22px">${baht(t.total,1)}</b></div></div>
<div class="row g8 f13 mut" style="justify-content:center;margin:14px 0 20px">${ic('shield',16,'#16A34A',2)}ชำระเงินปลอดภัย ได้รับไฟล์ทันทีหลังชำระ</div>`:''}
</div></div>
${t.items.length?`<div class="bbar"><button class="btn g" style="width:100%" onclick="startPay()">ชำระเงิน ${baht(t.total,1)}</button></div>`:''}${sample()}</div>`;
  return {html};
}
function rmCart(id){S.cart=S.cart.filter(x=>x!==id);save();toast('นำออกจากตะกร้าแล้ว','trash');render()}
function applyCoupon(){const v=($('#cp').value||'').trim().toUpperCase();if(v==='LUMI50'){S.coupon=v;save();toast('ใช้โค้ดส่วนลดสำเร็จ ลด ฿50','tag');render()}else{S.coupon='';save();toast('โค้ดไม่ถูกต้อง ลองใช้ LUMI50','x');render()}}
function startPay(){
  const pay=U.pay||'promptpay';const t=totals();
  if(pay==='promptpay'){
    sheet(`<div style="text-align:center"><div class="b6" style="font-size:19px">สแกนเพื่อชำระด้วยพร้อมเพย์</div><div class="f13 mut" style="margin-top:2px">ยอดชำระ <b style="color:var(--ink)">${baht(t.total,1)}</b> · บริษัท ลูมิ มาร์เก็ต จำกัด (ตัวอย่าง)</div>
<div style="margin:16px auto 0;width:212px;padding:12px;border-radius:20px;border:1.5px solid var(--line);position:relative"><div style="background:#103D7C;color:#fff;border-radius:10px;padding:6px;font-size:13px;font-weight:600">THAI QR PAYMENT</div>${fakeQR()}
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="background:rgba(229,72,77,.92);color:#fff;font-weight:600;padding:4px 14px;border-radius:8px;transform:rotate(-12deg);font-size:15px">ตัวอย่าง ห้ามสแกน</span></div></div>
<div class="f13 mut" style="margin-top:10px">QR หมดอายุใน <b id="qrT" style="color:var(--ink)">09:59</b></div>
<button class="btn g" style="width:100%;margin-top:16px" onclick="processPay('พร้อมเพย์')">จำลองการสแกนชำระสำเร็จ</button><button class="btn o" style="width:100%;margin-top:10px" onclick="closeSheet()">ยกเลิก</button></div>`,()=>{let s=599;const iv=setInterval(()=>{const e=$('#qrT');if(!e){clearInterval(iv);return}s--;e.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000)});
  }else if(pay==='card'){
    sheet(`<div class="b6" style="font-size:19px">ชำระด้วยบัตร</div><div class="f13 mut" style="margin:2px 0 14px">ระบบจำลอง ห้ามกรอกบัตรจริง ใช้หมายเลขตัวอย่างที่กรอกไว้</div>
<div style="height:150px;border-radius:20px;background:linear-gradient(130deg,#2A1A5E,#6C2BD9 60%,#C13AE0);color:#fff;padding:18px;position:relative"><div class="row sp"><span class="b6">ลูมิ ตัวอย่าง</span>${ic('card',24,'#fff')}</div><div style="font-size:19px;letter-spacing:2px;margin-top:34px;font-family:ui-monospace,monospace">4242 4242 4242 4242</div><div class="row sp f13" style="margin-top:10px;opacity:.85"><span>SOMJAI JAIDEE</span><span>12/29</span></div></div>
<div class="lbl" style="margin-top:14px">หมายเลขบัตร</div><div class="field"><input value="4242 4242 4242 4242" readonly></div>
<div class="row g10" style="margin-top:10px"><div class="field" style="flex:1"><input value="12/29" readonly></div><div class="field" style="flex:1"><input value="123" readonly></div></div>
<button class="btn g" style="width:100%;margin-top:16px" onclick="processPay('บัตรเครดิต')">ชำระ ${baht(t.total,1)}</button>`);
  }else{
    sheet(`<div class="b6" style="font-size:19px">TrueMoney Wallet</div><div class="f13 mut" style="margin:2px 0 14px">ระบบจำลอง จะไม่มีการตัดเงินจริง</div>
<div class="lbl">เบอร์ที่ผูกกับวอลเล็ท</div><div class="field"><span class="f15">+66</span><input value="81 234 5678"></div>
<div class="card row sp" style="padding:14px;margin-top:12px;background:#FFF4EA;border-color:#FFD9B5"><span class="f14">ยอดเงินในวอลเล็ท (ตัวอย่าง)</span><b>฿2,140.00</b></div>
<button class="btn" style="width:100%;margin-top:16px;background:#FF7A00;color:#fff" onclick="processPay('TrueMoney')">ยืนยันชำระ ${baht(t.total,1)}</button>`);
  }
}
function fakeQR(){let r='';let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;const n=25,s=7;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const fin=(x<7&&y<7)||(x>17&&y<7)||(x<7&&y>17);let on;if(fin){const fx=x>17?x-18:x,fy=y>17?y-18:y;on=fx===0||fy===0||fx===6||fy===6||(fx>1&&fx<5&&fy>1&&fy<5)}else on=rnd()>.52;if(on)r+=`<rect x="${x*s}" y="${y*s}" width="${s}" height="${s}"/>`}
  return `<svg viewBox="0 0 175 175" width="186" height="186" style="margin-top:8px;display:block">${r}</svg>`}
function processPay(method){
  const t=totals();
  sheet(`<div style="text-align:center;padding:30px 0 20px"><div class="spin" style="margin:0 auto"></div><div class="b6 f16" style="margin-top:18px">กำลังยืนยันการชำระเงิน</div><div class="f13 mut" style="margin-top:4px">${method} · ${baht(t.total,1)}</div></div>`);
  setTimeout(()=>{
    const no='LM-'+new Date().toISOString().slice(2,10).replace(/-/g,'').slice(2)+'-'+String(Math.floor(10000+Math.random()*89999));
    const ids=S.cart.filter(x=>x!=='commission');
    S.orders.unshift({no,total:t.total,method,ids,commission:S.cart.includes('commission')});
    ids.forEach(id=>{if(!owned(id))S.purchases.unshift({id,date:'วันนี้'})});
    if(S.cart.includes('commission'))S.quote='accepted';S.cart=[];S.coupon='';save();closeSheet();go('#/success/'+no);
  },1500);
}

/* 09 success */
function success(no){
  const o=S.orders.find(x=>x.no===no)||{no:'LM-2611-08452',total:403.2,method:'พร้อมเพย์',ids:['thaitea','prompt']};
  const items=o.ids.map(P).filter(Boolean);
  const conf=Array.from({length:22},(_,i)=>{const cols=['#7B2FF2','#F0508A','#FFB020','#C13AE0','#16A34A','#2F7BF6'];return `<i class="conf" style="left:${(i*37)%100}%;top:${(i*53)%150}px;background:${cols[i%6]};transform:rotate(${i*41}deg);animation-delay:${(i%7)*.12}s;${i%3?'':'border-radius:50%'}"></i>`}).join('');
  const html=`<div class="scr"><div class="scroll pt">
<div class="top"><button class="ib" onclick="go('#/home')">${ic('x',22,'#16132B',2.2)}</button><span></span><span style="width:46px"></span></div>
<div style="position:relative;height:0">${conf}</div>
<div style="text-align:center;padding:0 24px"><div style="width:96px;height:96px;border-radius:48px;margin:6px auto 0;background:var(--grad);display:flex;align-items:center;justify-content:center;box-shadow:0 14px 32px rgba(193,58,224,.35)">${ic('check',48,'#fff',3)}</div>
<h1 style="font-size:26px;font-weight:600;margin-top:18px">ชำระเงินสำเร็จ</h1><p class="f14 mut" style="margin-top:4px">คำสั่งซื้อ #${o.no} · ${baht(o.total,1)} ผ่าน${o.method}</p></div>
<div class="px" style="margin-top:22px">
<div class="card" style="padding:16px"><div class="row sp"><b class="f16">ไฟล์ของคุณพร้อมแล้ว</b><span class="f13 mut">${items.length} รายการ</span></div>
${items.map((p,i)=>`<div class="row g12" style="margin-top:14px"><div style="width:56px;height:56px;border-radius:12px;overflow:hidden;flex:none"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)})"></div></div>
<div style="flex:1;min-width:0"><div class="b5 f14" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title}</div><div class="f12 mut">${p.fmt} · ${p.size}</div>
${i===0&&!U.dlDone?.[o.no]?`<div style="height:6px;border-radius:3px;background:var(--line);margin-top:6px;overflow:hidden"><div class="dlbar" style="height:100%;width:68%;background:var(--grad);border-radius:3px;transition:width .3s"></div></div>`:''}</div>
${i===0&&!U.dlDone?.[o.no]?`<span class="f13 purple b6 dlpct">68%</span>`:`<span class="row g6 f13" style="color:var(--green)">${ic('check',16,'#16A34A',2.6)}บันทึกแล้ว</span>`}</div>`).join('')}
${o.commission?`<div class="row g12" style="margin-top:14px"><div style="width:56px;height:56px;border-radius:12px;background:var(--soft2);display:flex;align-items:center;justify-content:center">${ic('shield',26,'var(--p)')}</div><div style="flex:1"><div class="b5 f14">งานจ้างมาสคอต ฿1,800</div><div class="f12 mut">ลูมิพักเงินไว้จนกว่าคุณยืนยันรับงาน</div></div></div>`:''}</div>
<div class="row g10" style="margin-top:12px;padding:14px;border-radius:16px;background:#FFF4DC">${ic('refresh',20,'#C77A00',2)}<span class="f13" style="color:#7A5300;line-height:1.55">หากไฟล์มีปัญหาหรือพรอมต์ใช้ไม่ได้ตามตัวอย่าง ขอคืนเงินได้ภายใน 7 วันจากหน้าคลังของฉัน</span></div>
<button class="btn s" style="width:100%;margin-top:14px" onclick="downloadZip('${o.no}')">${ic('download',20,'var(--p)',2.2)}ดาวน์โหลดทั้งหมดเป็นไฟล์ ZIP</button>
<div class="card" style="padding:16px;margin-top:14px;text-align:center"><div class="b5 f15">ให้คะแนนประสบการณ์การซื้อ</div><div class="row g10" style="justify-content:center;margin-top:10px" id="rate">${[1,2,3,4,5].map(i=>`<button onclick="S.rating=${i};save();render();toast('ขอบคุณสำหรับคะแนนครับ','star')">${star(32,i<=S.rating?'#F5A524':'#E2DFEA')}</button>`).join('')}</div></div>
<button class="btn g" style="width:100%;margin-top:18px" onclick="go('#/library')">ไปที่คลังของฉัน</button>
<button class="btn" style="width:100%;margin:6px 0 30px;color:var(--p)" onclick="go('#/home')">เลือกซื้อผลงานต่อ</button></div></div>${sample()}</div>`;
  return {html,after(){
    if(SHOT||U.dlDone?.[o.no])return;let p=68;const iv=setInterval(()=>{const b=$('.dlbar'),t=$('.dlpct');if(!b){clearInterval(iv);return}p+=4;b.style.width=p+'%';t.textContent=p+'%';if(p>=100){clearInterval(iv);U.dlDone=U.dlDone||{};U.dlDone[o.no]=1;setTimeout(render,300)}},180)}};
}
function downloadZip(no){
  const o=S.orders.find(x=>x.no===no)||{ids:['thaitea','prompt']};
  const txt='ไฟล์ตัวอย่างจากต้นแบบแอปลูมิ\nคำสั่งซื้อ '+no+'\n\n'+o.ids.map(id=>'- '+P(id).title).join('\n')+'\n\nนี่คือไฟล์จำลอง ไม่ใช่ไฟล์ผลงานจริง';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download='lumi-'+no+'-sample.txt';a.click();toast('เริ่มดาวน์โหลดไฟล์ตัวอย่างแล้ว','download');
}

/* 10 library */
function library(){
  const f=U.libF||'all';const all=S.purchases.map(x=>({...P(x.id),date:x.date})).filter(x=>x.id);
  const grp={img:['promo','character'],sticker:['sticker'],prompt:['prompt'],video:['video']};
  const n=k=>k==='all'?all.length:all.filter(p=>grp[k].includes(p.type)).length;
  const list=f==='all'?all:all.filter(p=>grp[f].includes(p.type));
  const act=p=>p.type==='prompt'?['เปิดพรอมต์','copy',`openProduct('${p.id}')`]:p.sub==='line'?['ส่งเข้า LINE','send',`toast('จำลองการส่งสติกเกอร์เข้า LINE แล้ว','send')`]:['ดาวน์โหลด','download',`toast('จำลองการดาวน์โหลด ${p.fmt} ${p.size}','download')`];
  const html=`<div class="scr"><div class="scroll pt">
<div class="row sp px" style="height:60px"><h1 style="font-size:24px;font-weight:600">คลังที่ซื้อแล้ว</h1><div class="row g10"><button class="ib" onclick="go('#/favorites')">${ic('heart',21,'#16132B',2)}</button><button class="ib" onclick="U.sq='';go('#/search')">${ic('search',21,'#16132B',2)}</button></div></div>
<div class="chips" style="margin-top:6px">${[['all','ทั้งหมด'],['img','ภาพ'],['sticker','สติกเกอร์'],['prompt','พรอมต์'],['video','วิดีโอ']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" onclick="U.libF='${k}';render()">${l}${n(k)?` <span style="opacity:.6">${n(k)}</span>`:''}</button>`).join('')}</div>
<div class="px" style="margin-top:16px">
${S.plus?`<div class="row g12" style="padding:16px;border-radius:20px;background:linear-gradient(110deg,#2A1A5E,#6C2BD9 70%,#9B3FE0);color:#fff;cursor:pointer" onclick="go('#/settings')"><div style="width:46px;height:46px;border-radius:14px;background:rgba(255,176,32,.18);display:flex;align-items:center;justify-content:center">${ic('crown',26,'#FFB020',2)}</div>
<div style="flex:1"><div class="b6 f15">ลูมิ พลัส · สมาชิก</div><div class="f13" style="opacity:.8">ลด 10% ทุกการซื้อ · ประหยัดแล้ว ฿386</div></div>${ic('right',20,'#fff',2)}</div>`:''}
<div style="margin-top:6px">${list.map(p=>{const [l,i,fn]=act(p);return `<div class="row g12" style="padding:14px 0;border-bottom:1px solid var(--line)"><div style="width:64px;height:64px;border-radius:14px;overflow:hidden;flex:none;cursor:pointer" onclick="openProduct('${p.id}')"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)});${p.pos?'background-position:'+p.pos:''}"></div></div>
<div style="flex:1;min-width:0"><div class="b6 f15" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title}</div><div class="f13 mut">${CREATORS[p.by].name} · ${p.date}</div><div class="f12 mut">${p.count} ${p.unit} · ${p.size}</div></div>
<button class="btn s" style="height:38px;padding:0 12px;font-size:13px;border-radius:12px;flex:none" onclick="${fn}">${ic(i,15,'var(--p)',2.2)}${l}</button></div>`}).join('')||'<div class="empty">ยังไม่มีผลงานในหมวดนี้</div>'}</div>
<div style="height:20px"></div></div></div>${tabbar('lib')}${sample()}</div>`;
  return {html};
}
function favorites(){
  const list=S.favs.map(P).filter(Boolean);
  return {html:`<div class="scr"><div class="scroll pt">${topbar('รายการโปรด')}${list.length?masonry(list):'<div class="empty">ยังไม่มีรายการโปรด กดรูปหัวใจที่ผลงานเพื่อบันทึก</div>'}<div style="height:20px"></div></div>${tabbar('lib')}${sample()}</div>`};
}
