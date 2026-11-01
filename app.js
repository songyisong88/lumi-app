'use strict';
/* ===== state ===== */
const LS='lumi-proto-v1';
const DEF={loggedIn:false,role:'buy',cart:['thaitea','prompt'],purchases:SEED_PURCHASES.slice(),favs:['thaitea'],follows:[],readNotis:[],chat:null,orders:[],promoPkg:'premium',plus:true,notif:true,rating:4,adminDone:{},drafts:[],myWorks:[],coupon:''};
let S=load();
function load(){try{return Object.assign({},DEF,JSON.parse(localStorage.getItem(LS)||'{}'))}catch(e){return {...DEF}}}
function save(){localStorage.setItem(LS,JSON.stringify(S))}
function resetAll(){localStorage.removeItem(LS);S=load();location.hash='#/splash';render()}
const U={}; // ui temp state per screen
const IMG=n=>`img/${n}.jpg`;
const baht=(n,d)=>'฿'+Number(n).toLocaleString('en-US',{minimumFractionDigits:d?2:0,maximumFractionDigits:d?2:0});
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isFav=id=>S.favs.includes(id);
const owned=id=>S.purchases.some(x=>x.id===id);
const params=new URLSearchParams(location.search);
const SHOT=params.has('shot');

/* ===== frame ===== */
function setupFrame(){
  if(SHOT) document.body.classList.add('shot');
  const mob=()=>{if(!SHOT) document.body.classList.toggle('mobile',window.innerWidth<520)};
  mob();window.addEventListener('resize',mob);
}
function statusBar(light){return `<div class="sb ${light?'light':''}"><span>9:41</span><span class="r">
<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.3 10.3 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.5 8.5 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4c-1.8 0-3.4.7-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3zm0 3.5c-.6 0-1.1.2-1.5.6L8 11.6l1.5-1.7c-.4-.4-.9-.6-1.5-.6z"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" opacity=".45"/></svg></span></div>`}

/* ===== toast / sheet ===== */
let toastT;
function toast(msg,icon='check'){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');t.className='toast';t.innerHTML=ic(icon,16,'#fff',2.4)+`<span>${msg}</span>`;
  $('#device').appendChild(t);clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),2200);
}
function sheet(html,onMount){
  closeSheet();
  const m=document.createElement('div');m.className='mask';m.onclick=closeSheet;
  const s=document.createElement('div');s.className='sheet';s.innerHTML='<div class="grab"></div>'+html;
  $('#device').append(m,s);onMount&&onMount(s);return s;
}
function closeSheet(){document.querySelectorAll('#device>.mask,#device>.sheet').forEach(e=>e.remove())}

/* ===== shared parts ===== */
function tabbar(on){
  const t=(k,icn,l,h)=>`<button class="tab ${on===k?'on':''}" onclick="go('${h}')">${ic(icn,26,'currentColor',on===k?2.2:1.8)}<span>${l}</span></button>`;
  return `<nav class="tabbar">${t('home','home','หน้าแรก','#/home')}${t('search','search','ค้นหา','#/search')}
<button class="tab" onclick="go('#/sell')"><div class="mid">${ic('plus',30,'#fff',2.4)}</div><span class="midl">ลงขาย</span></button>
${t('lib','grid','คลังที่ซื้อแล้ว','#/library')}${t('me','user','โปรไฟล์','#/me')}</nav>`;
}
function topbar(title,right='',back=true,cls=''){
  return `<div class="top ${cls}">${back?`<button class="ib" onclick="goBack()">${ic('back',22,'#16132B',2.2)}</button>`:'<span style="width:46px"></span>'}<h2>${title}</h2>${right||'<span style="width:46px"></span>'}</div>`;
}
function sample(light){return `<div class="sample ${light?'light':''}">ข้อมูลตัวอย่าง</div>`}
function heartBtn(id,pos=''){return `<button class="heart" style="${pos}" onclick="event.stopPropagation();toggleFav('${id}',this)">${isFav(id)?ic('heart',18,'#E5487A',2,'#E5487A'):ic('heart',18,'#16132B',2)}</button>`}
function toggleFav(id,el){
  if(isFav(id)){S.favs=S.favs.filter(x=>x!==id);toast('นำออกจากรายการโปรดแล้ว','heart')}else{S.favs.push(id);toast('บันทึกในรายการโปรดแล้ว','heart')}
  save();if(el) el.innerHTML=isFav(id)?ic('heart',18,'#E5487A',2,'#E5487A'):ic('heart',18,'#16132B',2);
}
function card(p,opt={}){
  const c=CREATORS[p.by];const h=opt.h||p.h;
  return `<div class="pc" onclick="openProduct('${p.id}')"><div class="ph" style="height:${h}px"><div class="img" style="background-image:url(${IMG(p.img)});${p.pos?'background-position:'+p.pos:''}"></div>
${p.ad&&!opt.noad?'<div class="adtag" style="top:10px;left:10px">แนะนำ · โฆษณา</div>':''}${heartBtn(p.id)}
${opt.notype?'':`<div class="ovtag" style="left:10px;bottom:10px">${p.sub==='line'?'สติกเกอร์ LINE':TYPES[p.type]}</div>`}</div>
<div class="t">${p.title}</div><div class="row sp" style="margin-top:2px"><span class="pr">${baht(p.price)}</span><span class="rt">${star(13)}${p.rating.toFixed(1)}</span></div>
<div class="by"><div class="av" style="width:20px;height:20px;background-image:url(${IMG(c.av)})"></div>${c.name}</div></div>`;
}
function masonry(list,opt){
  const cols=[[],[]],hs=[0,0];
  list.forEach(p=>{const k=hs[0]<=hs[1]?0:1;cols[k].push(card(p,opt));hs[k]+=(p.h+90)});
  return `<div class="mas"><div class="col">${cols[0].join('')}</div><div class="col">${cols[1].join('')}</div></div>`;
}
function openProduct(id){const p=P(id);go(p.type==='prompt'?'#/prompt/'+id:'#/product/'+id)}

/* ===== router ===== */
const hist=[];
function go(h){location.hash=h}
function goBack(){if(hist.length>1){hist.pop();const h=hist.pop();location.hash=h}else location.hash='#/home'}
const getRoutes=()=>({splash,login,home,search,category,product,prompt:promptPage,cart,success,library,creator,sell,dashboard,promote,notifications,chat,me:settings,settings,admin,favorites});
function render(){
  let h=location.hash||'#/splash';
  if(hist[hist.length-1]!==h) hist.push(h);
  const [name,arg]=h.slice(2).split('/');
  const R=getRoutes();const fn=R[name]||R.home;
  closeSheet();
  const out=fn(arg);
  const v=$('#view');
  v.innerHTML=out.html+statusBar(out.light)+`<div class="hi ${out.hiLight?'light':''}"></div>`;
  out.after&&out.after(v);
  document.querySelectorAll('#side .nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href').split('/')[1]===name));
}
window.addEventListener('hashchange',render);
