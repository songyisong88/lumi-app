# งานตั้งค่า Supabase Auth สำหรับพี่ภพ (โปรเจกต์ zjohosifusewcaqpmyra เท่านั้น ห้ามแตะ laoshilama)
อัปเดต 3 พ.ย. 2026 ~15:10 (เวลาไทย)

ทำไมต้องคลิกเอง: เครื่องมือที่ผู้ช่วยมีเข้าถึงฐานข้อมูลได้ แต่ตั้งค่า Auth (Site URL / Redirect / Email templates) ไม่ได้

## 1) URL Configuration — Authentication → URL Configuration
- Site URL: `https://lumi-app-11m.pages.dev`  (ตอนนี้ยังเป็น `http://localhost:3000` → ลิงก์ในอีเมลพาไปที่อยู่ผิด)
- Redirect URLs → Add URL ทีละอัน:
  - `https://lumi-app-11m.pages.dev/**`
  - `https://lumi-demo-50k.pages.dev/**`
  - `https://songyisong88.github.io/lumi-app/**`
- Save

## 2) Confirm email — Authentication → Sign In / Providers → Email
- "Confirm email" ต้องเปิด (ON) — ตรวจแล้วจาก /auth/v1/settings: `mailer_autoconfirm=false` = เปิดอยู่แล้ว แค่ดูให้แน่ใจว่ายังเปิด
- "Email OTP Length" = 6 (หน้าเว็บมีช่องรหัส 6 ช่อง)
- "Email OTP Expiration" แนะนำ 3600 วินาที (1 ชม.)

## 3) Email Templates — Authentication → Emails → Templates
หน้าเว็บให้ใส่รหัส 6 หลัก แต่อีเมลแบบเดิมมีแค่ลิงก์ ให้วางข้อความด้านล่างแทนของเดิม (มีทั้งรหัสและลิงก์สำรอง)

### Confirm signup
Subject: `รหัสยืนยันอีเมล LUMI: {{ .Token }}`
```html
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
  <h2 style="margin:0 0 12px">ยืนยันอีเมลของคุณ</h2>
  <p>ใส่รหัส 6 หลักนี้ในหน้าสมัครสมาชิก</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">{{ .Token }}</p>
  <p>หรือกดลิงก์นี้เพื่อยืนยันแทน: <a href="{{ .ConfirmationURL }}">ยืนยันอีเมล</a></p>
  <p style="color:#888;font-size:13px">รหัสใช้ได้ครั้งเดียวและหมดอายุภายใน 1 ชั่วโมง ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไร</p>
</div>
```

### Magic Link (ใช้ตอน "เข้าด้วยรหัสทางอีเมล")
Subject: `รหัสเข้าสู่ระบบ LUMI: {{ .Token }}`
```html
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
  <h2 style="margin:0 0 12px">รหัสเข้าสู่ระบบ</h2>
  <p>ใส่รหัส 6 หลักนี้ในหน้าเข้าสู่ระบบ</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">{{ .Token }}</p>
  <p>หรือกดลิงก์นี้เพื่อเข้าสู่ระบบแทน: <a href="{{ .ConfirmationURL }}">เข้าสู่ระบบ</a></p>
  <p style="color:#888;font-size:13px">รหัสใช้ได้ครั้งเดียว ห้ามบอกรหัสนี้กับใคร ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร</p>
</div>
```

### Reset Password (หน้า "ลืมรหัสผ่าน" ก็ใช้รหัส 6 หลักเช่นกัน)
Subject: `รหัสตั้งรหัสผ่านใหม่ LUMI: {{ .Token }}`
```html
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
  <h2 style="margin:0 0 12px">ตั้งรหัสผ่านใหม่</h2>
  <p>ใส่รหัส 6 หลักนี้ในหน้าลืมรหัสผ่าน</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">{{ .Token }}</p>
  <p>หรือกดลิงก์นี้แทน: <a href="{{ .ConfirmationURL }}">ตั้งรหัสผ่านใหม่</a></p>
  <p style="color:#888;font-size:13px">ห้ามบอกรหัสนี้กับใคร ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้</p>
</div>
```
(เมื่อเปลี่ยนชื่อเป็น Pixeeno บนเว็บจริงแล้ว ค่อยแก้คำว่า LUMI ในหัวข้ออีเมล)

## 4) หลังทำเสร็จ บอกผู้ช่วย แล้วผู้ช่วยจะสมัครบัญชีทดสอบ lumi-qa-* ใหม่ เพื่อตรวจว่า
- อีเมลมีรหัส 6 หลัก และกรอกรหัสแล้วเข้าได้
- ลิงก์สำรองพาไป https://lumi-app-11m.pages.dev ไม่ใช่ localhost

หมายเหตุ: อีเมลระบบฟรีของ Supabase ส่งได้น้อยมากต่อชั่วโมง ใช้ทดสอบได้ แต่ก่อนเปิดให้คนทั่วไปต้องตั้ง Custom SMTP (Resend + โดเมนของเรา)
