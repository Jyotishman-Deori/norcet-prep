// =====================================================================
// SECTION LOCK  —  pure sectional-timing math for the High-Stress Drill
// (master-plan NEW-07.4).
// =====================================================================
// No React, no storage. The real NORCET Prelims runs 5 sections of 20
// questions with a rigid 18-minute clock EACH: when a section's clock
// ends it locks for good, and candidates who never trained for that
// panic-guess through the final 2 minutes. This module describes those
// sections so the Advanced Test engine can run a section-locked drill.
//
// Verified format (src/lib/pacing.js): PRELIMS 5 x 20 Q x 18 min.
// The drill keeps the per-section shape at ANY multiple of the section
// size (20 Qs = 1 section, 100 Qs = the full 5-section experience).
// A non-multiple final section still gets proportional time (ceil at
// least 1 minute) so an odd pool can never produce a 0-minute section.
// =====================================================================

export const SECTION_SIZE = 20;        // questions per section
export const SECTION_MINUTES = 18;     // rigid clock per section
export const STRESS_WINDOW_SEC = 90;   // spec: visual trigger in the final 90s
export const CRITICAL_WINDOW_SEC = 30; // last-moments escalation

// buildSections(100) -> 5 sections of 20 Qs / 18 min each.
// Returns [{ index, start, end, count, seconds }] with `end` exclusive.
export function buildSections(questionCount, { size = SECTION_SIZE, minutes = SECTION_MINUTES } = {}) {
  const n = Math.max(0, Math.floor(questionCount) || 0);
  if (n === 0) return [];
  const sections = [];
  for (let start = 0, i = 0; start < n; start += size, i += 1) {
    const end = Math.min(n, start + size);
    const count = end - start;
    // Full sections get the rigid clock; a short trailing section gets
    // proportional time, never less than one minute.
    const secs = count === size
      ? minutes * 60
      : Math.max(60, Math.round((count / size) * minutes * 60));
    sections.push({ index: i, start, end, count, seconds: secs });
  }
  return sections;
}

export function totalSeconds(sections) {
  return (sections || []).reduce((s, x) => s + x.seconds, 0);
}

// Which section a question index belongs to (-1 when out of range).
export function sectionForIndex(sections, qIndex) {
  if (!Array.isArray(sections)) return -1;
  for (const s of sections) {
    if (qIndex >= s.start && qIndex < s.end) return s.index;
  }
  return -1;
}

// The stress phase for the CURRENT section's remaining seconds:
// 'calm' -> normal; 'tense' -> the spec's final-90s visual trigger;
// 'critical' -> last 30 seconds.
export function stressPhase(secondsLeft) {
  if (secondsLeft <= CRITICAL_WINDOW_SEC) return 'critical';
  if (secondsLeft <= STRESS_WINDOW_SEC) return 'tense';
  return 'calm';
}

export function sectionLabel(section, sections) {
  if (!section) return '';
  return `Section ${section.index + 1} of ${(sections || []).length} · Q${section.start + 1} to ${section.end}`;
}
