// ข้อมูลตัวอย่างทั้งหมด (ไม่ใช่ข้อมูลจริง)
const CREATORS={
 fasai:{id:'fasai',name:'ฟ้าใส ครีเอท',av:'av_fasai',verified:true,pro:true,loc:'เชียงใหม่',reply:'ตอบกลับภายใน 1 ชั่วโมง',bio:'ถนัดภาพโปรโมตอาหาร เครื่องดื่ม และภาพสีน้ำโทนอบอุ่น รับออกแบบภาพให้ร้านค้าและสติกเกอร์ LINE',works:148,sales:'9.6k',followers:'24k',rating:4.9,cover:'rainy'},
 kenji:{id:'kenji',name:'Kenji Art',av:'av_kenji',verified:true,pro:true,loc:'กรุงเทพฯ',reply:'ตอบกลับภายใน 1 ชั่วโมง',bio:'นักวาดคาแรกเตอร์และสติกเกอร์ LINE รับออกแบบมาสคอตร้านค้า',works:96,sales:'6.1k',followers:'18k',rating:5.0,cover:'shiba'},
 mint:{id:'mint',name:'มิ้นท์ สตูดิโอ',av:'av_mint',verified:true,pro:false,loc:'ขอนแก่น',reply:'ตอบกลับภายใน 3 ชั่วโมง',bio:'ออกแบบมาสคอต 3 มิติ และภาพเมนูอาหารไทย',works:72,sales:'3.4k',followers:'9.2k',rating:4.9,cover:'mascot'},
 nova:{id:'nova',name:'NOVA Lab',av:'av_nova',verified:true,pro:true,loc:'กรุงเทพฯ',reply:'ตอบกลับภายใน 2 ชั่วโมง',bio:'แพ็กพรอมต์ที่ทดสอบแล้ว และคาแรกเตอร์ไซไฟ',works:64,sales:'8.8k',followers:'31k',rating:4.8,cover:'robot'},
 pim:{id:'pim',name:'Pim Draw',av:'av_pim',verified:false,pro:false,loc:'ภูเก็ต',reply:'ตอบกลับภายใน 1 วัน',bio:'สติกเกอร์น่ารักและตัวละครดินปั้น',works:41,sales:'1.9k',followers:'5.4k',rating:4.8,cover:'toys'},
 brew:{id:'brew',name:'Brew Visual',av:'av_ton',verified:true,pro:true,loc:'กรุงเทพฯ',reply:'ตอบกลับภายใน 2 ชั่วโมง',bio:'ภาพโปรโมตร้านกาแฟและเครื่องดื่มเชิงพาณิชย์',works:55,sales:'4.2k',followers:'12k',rating:4.9,cover:'coffee'},
 glow:{id:'glow',name:'Glow Studio',av:'av_shop',verified:true,pro:false,loc:'กรุงเทพฯ',reply:'ตอบกลับภายใน 3 ชั่วโมง',bio:'ภาพและวิดีโอสินค้าความงาม',works:38,sales:'2.1k',followers:'7.7k',rating:4.7,cover:'serum'},
};
const TYPES={promo:'ภาพโปรโมต',sticker:'สติกเกอร์',character:'คาแรกเตอร์',prompt:'พรอมต์',video:'วิดีโอ'};
const PRODUCTS=[
 {id:'thaitea',type:'promo',title:'ชุดภาพโปรโมตชาไทย 20 ภาพ',full:'ชุดภาพโปรโมตชาไทยสำหรับร้านเครื่องดื่ม',short:'ภาพโปรโมตชาไทย',price:249,rating:4.9,reviews:328,sold:'1.2k',count:20,unit:'ภาพ',res:'4K',by:'fasai',img:'thaitea',h:250,commercial:true,size:'186 MB',fmt:'ZIP'},
 {id:'mascot',type:'character',title:'มาสคอตมะม่วง พร้อมท่าทาง',short:'มาสคอตมะม่วง',price:590,rating:4.9,reviews:96,sold:'410',count:8,unit:'ท่า',res:'PNG และ AI',by:'mint',img:'mascot',h:200,commercial:true,size:'64 MB',fmt:'ZIP'},
 {id:'serum',type:'promo',title:'ภาพสินค้าสกินแคร์โทนกล้วยไม้',short:'ภาพสินค้าสกินแคร์',price:299,rating:4.8,reviews:120,sold:'640',count:12,unit:'ภาพ',res:'4K',by:'fasai',img:'serum',h:230,ad:true,commercial:true,size:'92 MB',fmt:'ZIP'},
 {id:'shiba',type:'sticker',sub:'line',title:'ชิบะอารมณ์ดี 40 ตัว',short:'ชิบะอารมณ์ดี',price:89,rating:5.0,reviews:210,sold:'2.3k',count:40,unit:'ตัว',res:'PNG พร้อมส่ง LINE',by:'kenji',img:'shiba',h:205,commercial:false,size:'12 MB',fmt:'ZIP'},
 {id:'cats',type:'sticker',sub:'line',title:'แมวส้มจอมงอน 24 ตัว',short:'แมวส้มจอมงอน',price:69,rating:4.8,reviews:154,sold:'1.8k',count:24,unit:'ตัว',res:'PNG พร้อมส่ง LINE',by:'fasai',img:'cats',h:170,ad:true,commercial:false,size:'9 MB',fmt:'ZIP'},
 {id:'prompt',type:'prompt',title:'แพ็กพรอมต์ภาพบุคคลแฟนตาซี 25 แบบ',short:'พรอมต์ภาพแฟนตาซี',price:199,was:290,rating:4.8,reviews:412,sold:'3.1k',count:25,unit:'พรอมต์',res:'PDF 4 MB',by:'nova',img:'fantasy',h:240,commercial:true,size:'4 MB',fmt:'PDF',tools:['Grok Imagine','Midjourney']},
 {id:'coffee',type:'promo',title:'ชุดภาพโปรโมตร้านกาแฟ 30 ภาพ',short:'ภาพโปรโมตร้านกาแฟ',price:390,was:590,rating:4.9,reviews:188,sold:'920',count:30,unit:'ภาพ',res:'4K',by:'brew',img:'coffee',h:190,ad:true,commercial:true,size:'240 MB',fmt:'ZIP'},
 {id:'coldbrew',type:'promo',title:'ภาพโปรโมตกาแฟเย็น',short:'ภาพโปรโมตกาแฟเย็น',price:159,rating:4.9,reviews:64,sold:'380',count:10,unit:'ภาพ',res:'4K',by:'brew',img:'coffee',pos:'75% 50%',h:210,ad:true,commercial:true,size:'80 MB',fmt:'ZIP'},
 {id:'perfume',type:'video',title:'วิดีโอเปิดตัวน้ำหอม 15 วินาที',short:'วิดีโอเปิดตัวน้ำหอม',price:490,rating:4.7,reviews:38,sold:'120',count:3,unit:'คลิป',res:'4K 9:16',by:'glow',img:'perfume',h:220,commercial:true,size:'310 MB',fmt:'MP4'},
 {id:'toys',type:'sticker',sub:'die',title:'ตุ๊กตาดินปั้นแสนหวาน 16 ตัว',short:'ตุ๊กตาดินปั้น',price:129,rating:4.8,reviews:52,sold:'300',count:16,unit:'ตัว',res:'PNG ไดคัต',by:'pim',img:'toys',h:180,commercial:false,size:'22 MB',fmt:'ZIP'},
 {id:'house',type:'promo',title:'ร้านกาแฟไม้ไอโซเมตริก',short:'ร้านกาแฟไอโซเมตริก',price:390,rating:4.9,reviews:44,sold:'210',count:6,unit:'มุม',res:'4K',by:'fasai',img:'house',h:210,commercial:true,size:'58 MB',fmt:'ZIP'},
 {id:'rainy',type:'promo',title:'เมืองฝนพรำยามค่ำคืน',short:'เมืองฝนพรำ',price:149,rating:4.9,reviews:77,sold:'530',count:8,unit:'ภาพ',res:'4K',by:'fasai',img:'rainy',h:180,commercial:true,size:'70 MB',fmt:'ZIP'},
 {id:'stickyrice',type:'promo',title:'ภาพเมนูข้าวเหนียวมะม่วง',short:'ภาพเมนูข้าวเหนียวมะม่วง',price:119,rating:4.9,reviews:58,sold:'470',count:6,unit:'ภาพ',res:'4K',by:'fasai',img:'stickyrice',h:200,commercial:true,size:'40 MB',fmt:'ZIP'},
 {id:'elephant',type:'promo',title:'ภาพสีน้ำช้างน้อยกับดอกไม้',short:'ภาพสีน้ำช้างน้อย',price:129,rating:5.0,reviews:31,sold:'190',count:5,unit:'ภาพ',res:'4K',by:'fasai',img:'elephant',h:190,commercial:true,size:'36 MB',fmt:'ZIP'},
 {id:'robot',type:'character',title:'คาแรกเตอร์หุ่นยนต์ส้มขาว',short:'หุ่นยนต์ส้มขาว',price:350,rating:4.8,reviews:40,sold:'150',count:10,unit:'ท่า',res:'PNG 4K',by:'nova',img:'robot',h:240,commercial:true,size:'88 MB',fmt:'ZIP'},
 {id:'padthai',type:'promo',title:'ภาพเมนูผัดไทยกุ้งสด',short:'ภาพเมนูผัดไทย',price:159,rating:4.8,reviews:49,sold:'260',count:8,unit:'ภาพ',res:'4K',by:'mint',img:'padthai',h:170,commercial:true,size:'52 MB',fmt:'ZIP'},
 {id:'bakery',type:'promo',title:'ภาพเบเกอรี่โทนอบอุ่น',short:'ภาพเบเกอรี่',price:179,rating:4.7,reviews:22,sold:'140',count:10,unit:'ภาพ',res:'4K',by:'brew',img:'bakery',h:170,commercial:true,size:'64 MB',fmt:'ZIP'},
 {id:'cafe',type:'promo',title:'ภาพสีน้ำบรรยากาศคาเฟ่',short:'ภาพสีน้ำคาเฟ่',price:149,rating:4.8,reviews:35,sold:'200',count:6,unit:'ภาพ',res:'4K',by:'pim',img:'cafe',h:180,commercial:true,size:'44 MB',fmt:'ZIP'},
];
const P=id=>PRODUCTS.find(p=>p.id===id);
const PROMPTS=[
 {n:'01',t:'ภาพบุคคลชุดไทยประยุกต์',txt:'cinematic portrait of a young woman, ornate golden headdress, teal silk, floating gold particles, rim light, 85mm, ultra detailed --ar 3:4'},
 {n:'02',t:'นักรบแสงจันทร์',txt:'fantasy warrior in silver armor under moonlight, mist, dramatic backlight, painterly, high detail --ar 3:4'},
 {n:'03',t:'เจ้าหญิงป่าลึก',txt:'forest princess with flower crown, glowing fireflies, soft volumetric light, ethereal mood --ar 3:4'},
 {n:'04',t:'นักเวทย์ไฟ',txt:'fire mage portrait, embers swirling, warm orange palette, cinematic depth of field --ar 3:4'},
];
const REVIEWS={
 thaitea:[{name:'ร้านชาบ้านนา',av:'av_shop',stars:5,when:'2 วันก่อน',text:'ภาพสวยมาก โพสต์ลงเพจแล้วลูกค้าทักเพิ่มขึ้นชัดเจน ไฟล์ใหญ่พอพิมพ์ป้ายหน้าร้านได้'}],
 prompt:[{name:'ต้นกล้า ดีไซน์',av:'av_ton',stars:5,when:'เมื่อวาน',text:'ใช้ตามได้ทันที ได้ภาพเหมือนตัวอย่างจริง วิดีโอสอนเข้าใจง่ายมาก'}],
 _:[{name:'ร้านขนมคุณแม่',av:'av_pim',stars:5,when:'3 วันก่อน',text:'คุณภาพดี ตรงตามตัวอย่าง ครีเอเตอร์ตอบเร็ว'}],
};
const SEED_PURCHASES=[
 {id:'shiba',date:'28 ต.ค.'},{id:'perfume',date:'20 ต.ค.'},{id:'mascot',date:'12 ต.ค.'},
 {id:'cats',date:'8 ต.ค.'},{id:'rainy',date:'2 ต.ค.'},{id:'stickyrice',date:'28 ก.ย.'},{id:'robot',date:'20 ก.ย.'},{id:'house',date:'15 ก.ย.'},{id:'toys',date:'9 ก.ย.'},{id:'padthai',date:'1 ก.ย.'},{id:'coldbrew',date:'25 ส.ค.'},{id:'elephant',date:'18 ส.ค.'}
];
const NOTIS=[
 {id:1,kind:'sale',day:'วันนี้',icon:'cart',col:'#16A34A',bg:'#EAF8EF',html:'<b>ขายได้ 1 ชิ้น</b> ภาพโปรโมตชาไทย ได้รับ <b style="color:#16A34A">฿211.65</b>',meta:'การขาย · 5 นาที',img:'thaitea',unread:true,go:'#/dashboard'},
 {id:2,kind:'review',day:'วันนี้',icon:'star',col:'#F5A524',bg:'#FFF6E3',html:'<b>ร้านชาบ้านนา</b> ให้ 5 ดาว "ภาพสวยมาก ลูกค้าทักเพิ่มขึ้นชัดเจน"',meta:'รีวิว · 32 นาที',unread:true,go:'#/product/thaitea'},
 {id:3,kind:'system',day:'วันนี้',icon:'shield',col:'#6C2BD9',bg:'#F1EAFF',html:'ผลงาน <b>ชุดภาพเมนูขนมไทย</b> ผ่านการตรวจลิขสิทธิ์และเผยแพร่แล้ว',meta:'ระบบ · 1 ชั่วโมง',img:'stickyrice',go:'#/creator/fasai'},
 {id:4,kind:'msg',day:'วันนี้',icon:'msg',col:'#2F7BF6',bg:'#EAF2FF',html:'<b>Kenji Art</b> ส่งใบเสนอราคางานมาสคอตร้านผลไม้',meta:'ข้อความ · 2 ชั่วโมง',unread:true,go:'#/chat/kenji'},
 {id:5,kind:'system',day:'เมื่อวาน',icon:'zap',col:'#E5487A',bg:'#FDEBF1',html:'โปรโมตแพ็กเกจพรีเมียมมีคนเห็นแล้ว <b>48,200</b> ครั้ง ยอดขายเพิ่มขึ้น 3 เท่า',meta:'โปรโมต · เมื่อวาน 18:20',go:'#/promote'},
 {id:6,kind:'system',day:'เมื่อวาน',icon:'user',col:'#6C2BD9',bg:'#F1EAFF',html:'<b>มิ้นท์ สตูดิโอ</b> และอีก 24 คน เริ่มติดตามร้านของคุณ',meta:'ผู้ติดตาม · เมื่อวาน 12:05',go:'#/creator/fasai'},
 {id:7,kind:'sale',day:'เมื่อวาน',icon:'wallet',col:'#16A34A',bg:'#EAF8EF',html:'โอนเงิน <b>฿12,500.00</b> เข้าบัญชีกสิกรไทย ลงท้าย 4821 เรียบร้อย',meta:'การเงิน · เมื่อวาน 09:00',go:'#/dashboard'},
];
const ADMIN_QUEUE=[
 {id:'q1',risk:'high',title:'กบเจ้าชาย 3D ชุดสติกเกอร์',by:'toy_maker99',when:'14 นาทีก่อน',img:'toys',checks:[['คล้ายตัวละครที่มีลิขสิทธิ์','78%','bad'],['ตรวจพบโลโก้หรือแบรนด์','ไม่พบ','ok'],['ลายน้ำจากเว็บอื่น','ไม่พบ','ok']],note:'ระบบพบภาพคล้ายกับตัวละครในคลังอ้างอิง 2 รายการ ควรขอหลักฐานการสร้างจากครีเอเตอร์',cat:'risk'},
 {id:'q2',risk:'auto',title:'คาแรกเตอร์หุ่นยนต์ส้มขาว',by:'NOVA Lab',when:'22 นาทีก่อน',img:'robot',checks:[['คล้ายตัวละครที่มีลิขสิทธิ์','6%','ok'],['ตรวจพบโลโก้หรือแบรนด์','ไม่พบ','ok'],['เนื้อหาไม่เหมาะสม','ผ่าน','ok']],cat:'new'},
 {id:'q3',risk:'report',title:'ภาพสินค้าสกินแคร์',by:'glowup_th',when:'1 ชั่วโมงก่อน',img:'serum',small:true,meta:'ถูกรายงาน 2 ครั้ง · ใช้ภาพผู้อื่น',cat:'report'},
 {id:'q4',risk:'auto',title:'ภาพเมนูผัดไทยกุ้งสด',by:'มิ้นท์ สตูดิโอ',when:'2 ชั่วโมงก่อน',img:'padthai',checks:[['คล้ายตัวละครที่มีลิขสิทธิ์','0%','ok'],['ตรวจพบโลโก้หรือแบรนด์','ไม่พบ','ok'],['เนื้อหาไม่เหมาะสม','ผ่าน','ok']],cat:'new'},
];
const DASH={
 '7':{sales:'312 ครั้ง',salesD:'+18%',net:'฿46,880',netD:'+22%',views:'18,240',viewsD:'+9%',conv:'3.4%',convD:'+0.6%',range:'1 – 14 พ.ย.',bars:[30,42,36,55,48,70,52,76,64,82,58,74,80,100]},
 '30':{sales:'1,284 ครั้ง',salesD:'+12%',net:'฿186,420',netD:'+15%',views:'72,900',viewsD:'+11%',conv:'3.1%',convD:'+0.3%',range:'16 ต.ค. – 14 พ.ย.',bars:[40,52,46,60,58,66,62,70,74,68,80,86,90,100]},
 'all':{sales:'9,640 ครั้ง',salesD:'ตั้งแต่เปิดร้าน',net:'฿1,284,300',netD:'14 เดือน',views:'612,000',viewsD:'ทั้งหมด',conv:'2.9%',convD:'เฉลี่ย',range:'ก.ย. 68 – พ.ย. 69',bars:[12,18,24,30,34,40,46,52,58,66,72,80,90,100]},
};
