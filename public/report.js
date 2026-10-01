// คำนวณสถานะและเวลาเข้าเรียนของผู้เรียนแต่ละคนจากบันทึกเหตุการณ์ (events)
// ใช้ได้ทั้งในเบราว์เซอร์ (window.AttendanceReport) และ Node (require) เพื่อทดสอบ
(function (root) {
  "use strict";

  // events: [{ student_id, student_name, type, created_at }] เรียงตาม id จากน้อยไปมาก
  // opts: { now (ms), graceMs, timeoutMs }
  //   graceMs   = หยุดแชร์ติดต่อกันเกินกี่ ms ถึงนับเป็นผิดกติกา
  //   timeoutMs = ไม่มีสัญญาณ (heartbeat/เหตุการณ์) เกินกี่ ms ถือว่าหลุดออกจากระบบ
  function compute(events, opts) {
    const now = opts.now, graceMs = opts.graceMs, timeoutMs = opts.timeoutMs;
    const byStudent = new Map();

    for (const e of events) {
      const t = Date.parse(e.created_at);
      if (!Number.isFinite(t)) continue;
      let s = byStudent.get(e.student_id);
      if (!s) {
        s = {
          studentId: e.student_id, name: e.student_name,
          state: null, last: null, firstSeen: t, lastSeen: t,
          sharedMs: 0, stoppedMs: 0, offlineMs: 0,
          stopCount: 0, violations: 0, run: 0, counted: false,
        };
        byStudent.set(e.student_id, s);
      }
      advance(s, t, timeoutMs, graceMs);
      s.name = e.student_name;
      s.lastSeen = t;
      switch (e.type) {
        case "join":
          s.state = "stopped"; break;
        case "share_started":
          s.state = "sharing"; s.run = 0; s.counted = false; break;
        case "share_stopped":
          if (s.state === "sharing") s.stopCount++;
          s.state = "stopped"; break;
        case "share_rejected":
          if (s.state === null) s.state = "stopped"; break;
        case "heartbeat_sharing":
          if (s.state !== "sharing") { s.run = 0; s.counted = false; }
          s.state = "sharing"; break;
        case "heartbeat_stopped":
          if (s.state === "sharing") s.stopCount++; // เหตุการณ์ share_stopped ตกหล่น
          s.state = "stopped"; break;
        default: break;
      }
      s.last = t;
    }

    const out = [];
    for (const s of byStudent.values()) {
      advance(s, now, timeoutMs, graceMs);
      const silentMs = now - s.lastSeen;
      const status = silentMs > timeoutMs ? "offline" : (s.state || "stopped");
      const stoppedForMs = status === "stopped" ? s.run : 0;
      out.push({
        studentId: s.studentId, name: s.name, status,
        alert: status === "stopped" && s.run > graceMs,
        stoppedFor: Math.round(stoppedForMs / 1000),
        sharedSec: Math.round(s.sharedMs / 1000),
        stoppedSec: Math.round(s.stoppedMs / 1000),
        offlineSec: Math.round(s.offlineMs / 1000),
        stopCount: s.stopCount, violations: s.violations,
        firstSeen: s.firstSeen, lastSeen: s.lastSeen,
      });
    }
    return out;
  }

  // นับเวลาจากเหตุการณ์ล่าสุดถึง until ตามสถานะปัจจุบัน
  // ช่วงที่เกิน timeout นับเป็น "หลุด" และตัดรอบการหยุดแชร์ต่อเนื่อง
  function advance(s, until, timeoutMs, graceMs) {
    if (s.last === null) return;
    const dt = until - s.last;
    if (dt <= 0) return;
    const onMs = Math.min(dt, timeoutMs);
    const offMs = dt - onMs;
    if (s.state === "sharing") {
      s.sharedMs += onMs; s.run = 0; s.counted = false;
    } else {
      s.stoppedMs += onMs;
      s.run += onMs;
      if (!s.counted && s.run > graceMs) { s.violations++; s.counted = true; }
    }
    if (offMs > 0) { s.offlineMs += offMs; s.run = 0; s.counted = false; }
    s.last = until;
  }

  function toCsv(rows, classId) {
    const head = ["ห้อง", "ชื่อ", "สถานะล่าสุด", "เวลาแชร์จอ(วินาที)", "เวลาที่หยุดแชร์(วินาที)", "เวลาที่หลุดออกจากระบบ(วินาที)", "จำนวนครั้งที่หยุดแชร์", "จำนวนครั้งที่ผิดกติกา", "% แชร์จอ", "เข้าครั้งแรก"];
    const lines = [head.join(",")];
    for (const r of rows) {
      const total = r.sharedSec + r.stoppedSec + r.offlineSec;
      const pct = total ? ((r.sharedSec / total) * 100).toFixed(1) : "0.0";
      const cells = [classId, r.name, r.status, r.sharedSec, r.stoppedSec, r.offlineSec, r.stopCount, r.violations, pct, new Date(r.firstSeen).toISOString()];
      lines.push(cells.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(","));
    }
    return "﻿" + lines.join("\n");
  }

  const api = { compute, toCsv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AttendanceReport = api;
})(typeof window !== "undefined" ? window : globalThis);
