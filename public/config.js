// ใส่ค่าจาก Supabase: Project Settings > API
// ค่า anon key เป็นกุญแจสาธารณะ ใส่ในหน้าเว็บได้ ความปลอดภัยอยู่ที่กฎ RLS ใน setup.sql
// ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด
window.APP_CONFIG = {
  SUPABASE_URL: "https://tpeiwzxnalhimxrnpdbz.supabase.co",
  // anon key แบบเดิม (JWT). ถ้าต้องการใช้ publishable key แบบใหม่ ให้แทนด้วย sb_publishable_... ได้
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZWl3enhuYWxoaW14cm5wZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjA3OTYsImV4cCI6MjEwNjQzNjc5Nn0.N0G4VoeAq_NzL5g-LQWV-6og79qZdLvjsOi9mzu2aVc",

  GRACE_SECONDS: 20,          // หยุดแชร์ติดต่อกันเกินกี่วินาทีถึงนับว่าผิดกติกา
  FRAME_SECONDS: 15,          // ผู้เรียนส่งภาพย่อทุกกี่วินาที (ห้องใหญ่ควรเพิ่ม)
  THUMB_WIDTH: 960,           // ความกว้างภาพที่ส่ง (พิกเซล) ยิ่งมากยิ่งชัดแต่ใช้ข้อมูลมากขึ้น เดิม 240
  THUMB_QUALITY: 0.5,         // คุณภาพ JPEG 0-1
  HEARTBEAT_SECONDS: 30,      // ผู้เรียนส่งสัญญาณว่ายังอยู่ทุกกี่วินาที
  OFFLINE_AFTER_SECONDS: 90,  // ไม่มีสัญญาณเกินกี่วินาทีถือว่าหลุดออกจากระบบ
  POLL_SECONDS: 10            // แดชบอร์ดผู้สอนรีเฟรชทุกกี่วินาที
};
