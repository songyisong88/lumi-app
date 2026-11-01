/* 13 dashboard */
function dashboard(){
  const r=U.dr||'7';const d=DASH[r];const mx=Math.max(...d.bars);
  const stats=[['ยอดขาย',d.sales,d.salesD,'cart'],['รายได้สุทธิ',d.net,d.netD,'wallet'],['ยอดเข้าชม',d.views,d.viewsD,'eye'],['อัตราซื้อ',d.conv,d.convD,'trend']];
  const best=[['thaitea',128,'฿27,088'],['cats',96,'฿5,630'],['rainy',61,'฿7,740']];
  const html=`<div class="scr"><div class="scroll pt">
<div class="row sp px" style="height:64px"><div class="row g10"><div class="av" style="width:46px;height:46px;background-image:url(${IMG('av_fasai')})"></div><div><div class="f13 mut">สวัสดี ฟ้าใส</div><div class="b6" style="font-size:19px">แดชบอร์ดครีเอเตอร์</div></div></div>
<button class="ib" onclick="go('#/notifications')">${ic('bell',22,'#16132B',2)}<span class="dot"></span></button></div>
<div class="px" style="margin-top:8px"><div style="border-radius:24px;padding:20px;color:#fff;background:linear-gradient(125deg,#5B21B6,#7B2FF2 45%,#C13AE0);position:relative;overflow:hidden">
<div style="position:absolute;right:-30px;top:-30px;width:140px;height:140px;border-radius:70px;background:rgba(255,255,255,.08)"></div><div style="position:absolute;right:30px;bottom:-50px;width:110px;height:110px;border-radius:55px;background:rgba(255,255,255,.06)"></div>
<div class="f14" style="opacity:.85">ยอดเงินที่ถอนได้</div><div style="font-size:32px;font-weight:700;margin-top:2px" id="bal">${S.withdrawn?'฿0.00':'฿18,420.50'}</div>
<div class="f13" style="opacity:.8;margin-top:2px">รอโอนเข้าบัญชี ${S.withdrawn?'฿21,630.50':'฿3,210.00'} · โอนทุกวันจันทร์</div>
<div class="row g10" style="margin-top:16px"><button class="btn" style="flex:1;height:46px;background:#fff;color:var(--p);font-size:15px" onclick="withdraw()">${ic('wallet',18,'var(--p)',2.2)}ถอนเงิน</button><button class="btn" style="flex:1;height:46px;background:rgba(255,255,255,.16);color:#fff;font-size:15px" onclick="payoutHist()">ประวัติการโอน</button></div></div></div>
<div class="chips" style="margin-top:18px">${[['7','7 วัน'],['30','30 วัน'],['all','ทั้งหมด']].map(([k,l])=>`<button class="chip ${r===k?'on':''}" onclick="U.dr='${k}';render()">${l}</button>`).join('')}</div>
<div class="px" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">${stats.map(([l,v,dd,i])=>`<div class="card" style="padding:14px"><div class="row sp"><span class="f13 mut">${l}</span>${ic(i,18,'var(--p)')}</div><div class="b6" style="font-size:20px;margin-top:4px">${v}</div><div class="f12" style="color:${dd.startsWith('+')?'var(--green)':'var(--mut)'}">${dd.startsWith('+')?'▲ '+dd:dd}</div></div>`).join('')}</div>
<div class="px" style="margin-top:14px"><div class="card" style="padding:16px"><div class="row sp"><b class="f15">รายได้รายวัน</b><span class="f13 mut">${d.range}</span></div>
<div class="row" style="align-items:flex-end;gap:6px;height:130px;margin-top:14px">${d.bars.map((b,i)=>`<div style="flex:1;height:${b/mx*100}%;border-radius:6px;background:${i===d.bars.length-1?'var(--grad)':'#E6DBFF'};transform-origin:bottom;animation:grow .5s ${i*.03}s both"></div>`).join('')}</div>
<div class="row sp f12 mut" style="margin-top:6px"><span>${d.range.split(' – ')[0]}</span><span>${d.range.split(' – ')[1]}</span></div></div></div>
<div class="section-h"><h3>ผลงานขายดี</h3><a onclick="go('#/creator/fasai')">ดูทั้งหมด</a></div>
<div class="px">${best.map(([id,n,v],i)=>{const p=P(id);return `<div class="row g12" style="padding:10px 0;${i?'border-top:1px solid var(--line)':''};cursor:pointer" onclick="openProduct('${id}')"><span class="b6 mut" style="width:16px">${i+1}</span><div style="width:52px;height:52px;border-radius:12px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)})"></div></div><div style="flex:1"><div class="b5 f15">${p.short}</div><div class="f13 mut">ขาย ${n} ครั้ง</div></div><b class="f15">${v}</b></div>`}).join('')}
<button class="card row g12" style="width:100%;padding:14px;margin-top:10px;background:#FFF4DC;border-color:#FFE2A3;text-align:left" onclick="go('#/promote')">${ic('zap',22,'#C77A00',2)}<span style="flex:1"><span class="b6 f15" style="display:block">โปรโมตผลงานขายดี</span><span class="f13" style="color:#7A5300">ขึ้นแบนเนอร์หน้าแรก เริ่มต้น ฿99</span></span>${ic('right',18,'#C77A00',2)}</button></div>
<div style="height:24px"></div></div>${tabbar('me')}${sample()}</div>`;
  return {html};
}
function withdraw(){if(S.withdrawn){toast('ไม่มียอดที่ถอนได้ในตอนนี้','wallet');return}
  sheet(`<div class="b6" style="font-size:19px">ถอนเงินเข้าบัญชี</div><div class="card row g12" style="padding:14px;margin-top:14px"><span style="width:42px;height:42px;border-radius:12px;background:#138F2D;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">K</span><div style="flex:1"><div class="b6 f15">ธนาคารกสิกรไทย</div><div class="f13 mut">xxx-x-x4821-x · ฟ้าใส ครีเอท</div></div></div>
<div class="row sp" style="margin-top:14px"><span class="mut">จำนวนเงิน</span><b style="font-size:22px">฿18,420.50</b></div><div class="row sp f13" style="margin-top:4px"><span class="mut">ค่าธรรมเนียมการโอน</span><span style="color:var(--green)">ฟรี</span></div>
<p class="f12 mut" style="margin-top:10px">ระบบจำลอง จะไม่มีการโอนเงินจริง</p><button class="btn g" style="width:100%;margin-top:14px" onclick="S.withdrawn=true;save();closeSheet();toast('ส่งคำขอถอนเงินแล้ว เข้าบัญชีวันจันทร์','wallet');render()">ยืนยันถอนเงิน</button>`)}
function payoutHist(){sheet(`<div class="b6" style="font-size:19px">ประวัติการโอน</div>${[['3 พ.ย. 2569','฿12,500.00'],['27 ต.ค. 2569','฿9,860.00'],['20 ต.ค. 2569','฿11,240.50'],['13 ต.ค. 2569','฿8,420.00']].map(([d,v])=>`<div class="row sp" style="padding:14px 0;border-bottom:1px solid var(--line)"><div><div class="b5 f15">${v}</div><div class="f13 mut">${d} · กสิกรไทย 4821</div></div><span class="tagp t-g">สำเร็จ</span></div>`).join('')}`)}

/* 14 promote */
const PKGS=[['start','เริ่มต้น',99,'1 วัน','~3,000'],['pop','ยอดนิยม',390,'7 วัน','~25,000'],['premium','พรีเมียม',1290,'7 วัน','~120,000']];
function promote(){
  const k=S.promoPkg;const pk=PKGS.find(x=>x[0]===k);const p=P(U.promoItem||'thaitea');
  const html=`<div class="scr"><div class="scroll pt">${topbar('โปรโมตผลงาน',`<button class="ib" onclick="toast('โฆษณาแสดงป้าย แนะนำ · โฆษณา เสมอ','help')">${ic('help',20,'#16132B',2)}</button>`)}
<div class="px"><div style="border-radius:24px;padding:18px 18px 0;background:linear-gradient(160deg,#F3ECFF,#FDEBF4);overflow:hidden">
<div class="f13 b6" style="color:var(--p)">ตัวอย่างตำแหน่ง</div><div class="f14 mut">${k==='start'?'การ์ดแนะนำในผลการค้นหา':'แบนเนอร์หน้าแรกแถวบนสุด'}</div>
<div style="margin:14px auto 0;width:236px;height:200px;border-radius:30px 30px 0 0;background:#fff;border:6px solid #16132B;border-bottom:0;padding:12px 10px 0;overflow:hidden">
<div class="row sp" style="padding:0 2px"><div class="row g6">${lumiLogo(18)}<b class="f12">ลูมิ</b></div><div class="row g6"><span style="width:16px;height:16px;border-radius:5px;background:var(--soft)"></span><span style="width:16px;height:16px;border-radius:5px;background:var(--soft)"></span></div></div>
<div style="height:20px;border-radius:7px;background:var(--soft);margin-top:8px"></div>
<div style="height:96px;border-radius:12px;margin-top:8px;position:relative;overflow:hidden;outline:2.5px solid #F0508A;outline-offset:-2.5px;animation:pulse 1.6s infinite"><div class="img" style="position:absolute;inset:0;background-image:url(${IMG(p.img)})"></div><div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.6),transparent)"></div><span style="position:absolute;left:8px;top:7px;background:rgba(255,255,255,.2);color:#fff;font-size:8.5px;padding:1px 6px;border-radius:6px">แนะนำ · โฆษณา</span><div style="position:absolute;left:8px;top:26px;color:#fff;font-size:11px;font-weight:600;line-height:1.3;width:110px">${p.short}</div><span style="position:absolute;left:8px;bottom:8px;background:#fff;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:600">${baht(p.price)}</span></div>
<div class="row g6" style="margin-top:8px"><div style="flex:1;height:50px;border-radius:10px;background:var(--soft)"></div><div style="flex:1;height:50px;border-radius:10px;background:var(--soft)"></div></div></div></div>
<div class="lbl" style="margin-top:18px">ผลงานที่จะโปรโมต</div>
<button class="card row g12" style="width:100%;padding:12px;text-align:left" onclick="pickPromo()"><div style="width:48px;height:48px;border-radius:12px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)})"></div></div><span style="flex:1"><span class="b6 f15" style="display:block">${p.short}</span><span class="f13 mut">${baht(p.price)} · ขายแล้ว ${p.sold} ครั้ง</span></span><span class="purple b5 f14">เปลี่ยน</span></button>
<div class="lbl" style="margin-top:18px">เลือกแพ็กเกจ</div>
${PKGS.map(([id,n,pr,dur,reach])=>`<button class="card row g12" style="width:100%;padding:14px 16px;margin-bottom:10px;text-align:left;position:relative;${k===id?'border:2px solid var(--p);background:var(--soft2)':''}" onclick="S.promoPkg='${id}';save();render()">
<span style="flex:1"><span class="row g8"><span class="b6 f16">${n}</span>${id==='premium'?'<span class="tagp" style="height:22px;font-size:11.5px;background:var(--mango);color:#3A2600">คุ้มที่สุด</span>':''}</span><span class="f13 mut" style="display:block;margin-top:2px">${dur} · คนเห็นประมาณ ${reach} ครั้ง</span></span>
<span style="text-align:right"><b style="font-size:19px">${baht(pr)}</b></span><span class="radio ${k===id?'on':''}"></span></button>`).join('')}
<div class="row g10" style="padding:14px;border-radius:16px;background:var(--soft);margin-top:4px">${ic('eye',20,'var(--p)')}<span class="f13" style="color:var(--ink2);line-height:1.55">ผลงานที่โปรโมตจะแสดงป้าย "แนะนำ · โฆษณา" เสมอ เพื่อความโปร่งใสต่อผู้ซื้อ</span></div>
<div style="height:20px"></div></div></div>
<div class="bbar"><button class="btn g" style="width:100%" onclick="payPromo()">ชำระ ${baht(pk[2])} และเริ่มโปรโมต</button></div>${sample()}</div>`;
  return {html};
}
function pickPromo(){sheet(`<div class="b6" style="font-size:19px">เลือกผลงาน</div>${PRODUCTS.filter(p=>p.by==='fasai').map(p=>`<button class="row g12" style="width:100%;padding:10px 0;border-bottom:1px solid var(--line);text-align:left" onclick="U.promoItem='${p.id}';closeSheet();render()"><div style="width:48px;height:48px;border-radius:12px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(p.img)})"></div></div><span style="flex:1" class="b5 f15">${p.short}</span><span class="radio ${(U.promoItem||'thaitea')===p.id?'on':''}"></span></button>`).join('')}`)}
function payPromo(){const pk=PKGS.find(x=>x[0]===S.promoPkg);sheet(`<div style="text-align:center;padding:24px 0 14px"><div class="spin" style="margin:0 auto"></div><div class="b6 f16" style="margin-top:16px">กำลังชำระค่าโปรโมต ${baht(pk[2])}</div><div class="f13 mut">หักจากยอดเงินในร้าน (จำลอง)</div></div>`);
  setTimeout(()=>{closeSheet();sheet(`<div style="text-align:center;padding:8px 0"><div style="width:72px;height:72px;border-radius:36px;margin:0 auto;background:var(--grad);display:flex;align-items:center;justify-content:center">${ic('zap',34,'#fff',2.4)}</div><div class="b6" style="font-size:20px;margin-top:14px">เริ่มโปรโมตแล้ว</div><p class="f14 mut" style="margin-top:4px">แพ็กเกจ${pk[1]} ${pk[3]} · คนเห็นประมาณ ${pk[4]} ครั้ง</p><button class="btn g" style="width:100%;margin-top:18px" onclick="closeSheet();go('#/dashboard')">ไปที่แดชบอร์ด</button></div>`)},1300)}

/* 15 notifications */
function notifications(){
  const f=U.nf||'all';const isU=n=>n.unread&&!S.readNotis.includes(n.id);
  const cnt=k=>NOTIS.filter(n=>n.kind===k&&isU(n)).length;
  const list=NOTIS.filter(n=>f==='all'||n.kind===f);
  const days=[...new Set(list.map(n=>n.day))];
  const html=`<div class="scr"><div class="scroll pt">${topbar('การแจ้งเตือน',`<button class="purple b5 f14" style="white-space:nowrap;text-align:right" onclick="S.readNotis=NOTIS.map(n=>n.id);save();render();toast('อ่านทั้งหมดแล้ว')">อ่านทั้งหมดแล้ว</button>`)}
<div class="chips" style="margin-top:4px">${[['all','ทั้งหมด'],['sale','การขาย'],['msg','ข้อความ'],['review','รีวิว'],['system','ระบบ']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" onclick="U.nf='${k}';render()">${l}${k!=='all'&&cnt(k)?` <span style="min-width:20px;height:20px;border-radius:10px;background:${f===k?'#fff':'var(--p)'};color:${f===k?'var(--ink)':'#fff'};font-size:12px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px">${cnt(k)}</span>`:''}</button>`).join('')}</div>
${days.map(d=>`<div class="px f14 b6 mut" style="margin:18px 0 6px">${d}</div>${list.filter(n=>n.day===d).map(n=>`<button class="row g12" style="width:100%;text-align:left;padding:14px 20px;align-items:flex-start;background:${isU(n)?'#F8F4FF':'transparent'}" onclick="openNoti(${n.id})">
<span style="width:46px;height:46px;border-radius:15px;background:${n.bg};display:flex;align-items:center;justify-content:center;flex:none">${ic(n.icon,22,n.col,2)}</span>
<span style="flex:1;min-width:0"><span class="f14" style="display:block;line-height:1.5;color:var(--ink)">${n.html}</span><span class="f12 mut">${n.meta}</span></span>
${n.img?`<span style="width:48px;height:48px;border-radius:12px;overflow:hidden;flex:none"><span class="img" style="display:block;width:100%;height:100%;background-image:url(${IMG(n.img)})"></span></span>`:''}
${isU(n)?'<span style="width:9px;height:9px;border-radius:5px;background:#F0508A;flex:none;margin-top:6px"></span>':''}</button>`).join('')}`).join('')}
${list.length?'':'<div class="empty">ไม่มีการแจ้งเตือนในหมวดนี้</div>'}<div style="height:24px"></div></div>${tabbar('me')}${sample()}</div>`;
  return {html};
}
function openNoti(id){if(!S.readNotis.includes(id))S.readNotis.push(id);save();go(NOTIS.find(n=>n.id===id).go)}

/* 16 chat */
function chatSeed(){return [{t:'req'},{me:1,txt:'สวัสดีครับ อยากได้มาสคอตเป็นมะม่วงยิ้มแย้ม ใส่หมวกฟาง โทนสีสดใส ใช้ทำป้ายร้านและสติกเกอร์ครับ',time:'10:24'},{txt:'สวัสดีครับ ยินดีรับงานนี้ครับ ผมร่างแบบแรกให้ดูก่อนนะครับ',time:'10:31'},{t:'draft',time:'10:32'},{t:'quote',time:'10:33'}]}
function chat(id='kenji'){
  const c=CREATORS[id]||CREATORS.kenji;S.chat=S.chat||chatSeed();const st=S.quote||'open';
  const bub=m=>{
    if(m.t==='req')return `<div class="card" style="padding:14px;margin:4px 0 14px;border-color:#E4D8FF;background:var(--soft2)"><div class="row g8 f13 purple b6">${ic('file',16,'var(--p)',2)}คำขอจ้างงาน</div><div class="b6 f15" style="margin-top:6px">ออกแบบมาสคอตร้านผลไม้ปั่น</div><div class="row g12 f13 mut" style="margin-top:4px"><span>งบประมาณ <b style="color:var(--ink)">฿1,500</b></span><span>ต้องการภายใน 5 วัน</span></div><div class="row g6" style="margin-top:10px">${['mascot','stickyrice','cats'].map(i=>`<div style="width:56px;height:56px;border-radius:10px;overflow:hidden"><div class="img" style="width:100%;height:100%;background-image:url(${IMG(i)})"></div></div>`).join('')}<span class="f12 mut" style="margin-left:4px">ภาพอ้างอิง 3 ภาพ</span></div></div>`;
    if(m.t==='draft')return `<div class="row g8" style="align-items:flex-end;margin-bottom:12px"><div class="av" style="width:30px;height:30px;background-image:url(${IMG(c.av)})"></div><div style="width:190px;border-radius:18px 18px 18px 6px;overflow:hidden;position:relative"><div class="img" style="width:100%;height:170px;background-image:url(${IMG('mascot')})"></div><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-weight:700;transform:rotate(-22deg);font-size:15px">KENJI ART</span><span class="ovtag" style="left:8px;bottom:8px;font-size:11px">ภาพร่าง มีลายน้ำ</span></div></div>`;
    if(m.t==='quote')return `<div class="row g8" style="align-items:flex-end;margin-bottom:12px"><div class="av" style="width:30px;height:30px;background-image:url(${IMG(c.av)})"></div><div class="card" style="flex:1;padding:14px;border-radius:18px 18px 18px 6px"><div class="row sp"><span class="f13 mut">ใบเสนอราคา</span>${st==='accepted'?'<span class="tagp t-g" style="height:24px">ชำระแล้ว</span>':''}</div><div style="font-size:24px;font-weight:700;margin-top:2px">฿1,800</div><div class="f13 mut">ส่งงาน 3 วัน · แก้ไข 2 ครั้ง · PNG และ AI 8 ท่า</div>
${st==='accepted'?'':`<div class="row g8" style="margin-top:12px"><button class="btn o" style="flex:1;height:42px;font-size:14px" onclick="negotiate()">ขอต่อรอง</button><button class="btn g" style="flex:1.4;height:42px;font-size:14px" onclick="acceptQuote()">ยอมรับและชำระ</button></div>`}
<div class="row g6 f12" style="margin-top:10px;color:var(--green)">${ic('shield',14,'#16A34A',2)}ลูมิพักเงินไว้จนกว่าคุณจะยืนยันรับงาน</div></div></div>`;
    return m.me?`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><div style="max-width:76%;background:var(--grad);color:#fff;padding:11px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.55">${esc(m.txt)}<div style="font-size:11px;opacity:.75;text-align:right;margin-top:2px">${m.time} · อ่านแล้ว</div></div></div>`
      :`<div class="row g8" style="align-items:flex-end;margin-bottom:12px"><div class="av" style="width:30px;height:30px;flex:none;background-image:url(${IMG(c.av)})"></div><div style="max-width:74%;background:var(--soft);padding:11px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.55">${esc(m.txt)}<div class="mut" style="font-size:11px;margin-top:2px">${m.time}</div></div></div>`;
  };
  const html=`<div class="scr"><div class="pt" style="flex:none;border-bottom:1px solid var(--line)"><div class="top" style="gap:10px"><button class="ib" onclick="goBack()">${ic('back',22,'#16132B',2.2)}</button>
<div class="row g10" style="flex:1;cursor:pointer" onclick="go('#/creator/${c.id}')"><div style="position:relative"><div class="av" style="width:42px;height:42px;background-image:url(${IMG(c.av)})"></div><span style="position:absolute;right:0;bottom:0;width:12px;height:12px;border-radius:6px;background:#22C55E;border:2px solid #fff"></span></div><div><div class="row g6 b6 f15">${c.name}${vbadge(15)}</div><div class="f12" style="color:var(--green)">ออนไลน์ · ${c.reply}</div></div></div>
<button class="ib" onclick="toast('ระบบจำลอง ยังไม่รองรับการโทร','phone')">${ic('phone',20,'#16132B',2)}</button></div></div>
<div class="scroll" id="chatScroll" style="padding:12px 20px 10px"><div class="f12 mut" style="text-align:center;margin-bottom:8px">วันนี้</div>${S.chat.map(bub).join('')}<div id="typing"></div></div>
<div class="row g8" style="padding:10px 16px 34px;border-top:1px solid var(--line);flex:none;background:#fff"><button class="ib" style="width:44px;height:44px" onclick="toast('แนบไฟล์ (จำลอง)','clip')">${ic('clip',21,'#16132B',2)}</button>
<div class="field" style="flex:1;height:46px;border-radius:23px;background:var(--soft);border:0"><input id="msg" placeholder="พิมพ์ข้อความ" onkeydown="if(event.key==='Enter')sendMsg()" style="font-size:15px"></div>
<button style="width:46px;height:46px;border-radius:23px;background:var(--grad);display:flex;align-items:center;justify-content:center;flex:none" onclick="sendMsg()">${ic('send',20,'#fff',2.2)}</button></div>${sample()}</div>`;
  return {html,after(){const s=$('#chatScroll');if(s&&!SHOT)s.scrollTop=s.scrollHeight}};
}
function nowT(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
const REPLIES=['ได้เลยครับ เดี๋ยวผมปรับให้ตามนี้นะครับ','รับทราบครับ ถ้าสะดวกส่งภาพอ้างอิงเพิ่มได้เลยครับ','ขอบคุณครับ ผมจะส่งงานแก้ไขภายในพรุ่งนี้ครับ'];
function sendMsg(){const i=$('#msg');const v=i.value.trim();if(!v)return;S.chat.push({me:1,txt:v,time:nowT()});save();render();
  setTimeout(()=>{const t=$('#typing');if(t)t.innerHTML=`<div class="f12 mut" style="margin-left:38px">${'Kenji Art'} กำลังพิมพ์...</div>`;const s=$('#chatScroll');if(s)s.scrollTop=s.scrollHeight},500);
  setTimeout(()=>{S.chat.push({txt:REPLIES[(S.chat.length)%3]+' (ข้อความตอบกลับอัตโนมัติจำลอง)',time:nowT()});save();if(location.hash.startsWith('#/chat'))render()},1700)}
function negotiate(){const i=$('#msg');i.value='สวัสดีครับ ขอต่อรองเป็น ฿1,500 ตามงบได้ไหมครับ ลดจำนวนท่าเหลือ 6 ท่าก็ได้ครับ';i.focus()}
function acceptQuote(){if(!S.cart.includes('commission'))S.cart.unshift('commission');save();toast('เพิ่มงานจ้าง ฿1,800 ลงตะกร้าแล้ว','cart');setTimeout(()=>go('#/cart'),500)}
