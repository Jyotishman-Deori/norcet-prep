# Content formats handbook

The canonical shape of every content type you can add, so the bank keeps growing.
**Hard rule: no long dashes (`—`) or double hyphens (`--`) in any user-facing text.**
Use a period, comma, or colon. The Content Studio validator rejects them.

Where each type is authored:

| Content | Where | Deploy needed? |
|---|---|---|
| Question banks (Quick/Mock/Topic/Advanced pool) | Admin -> Upload bank | No |
| Previous papers | Admin -> Upload bank -> type "Previous paper" | No |
| Dosage drills | Admin -> Content Studio -> Dosage | No |
| Concept cards (Learn) | Admin -> Content Studio -> Concept cards | No |
| Reference values | Admin -> Content Studio -> Reference | No |
| Quotes (Home) | Admin -> Content Studio -> Quotes | No |
| Clinical games (Ward Boss, Drip Zone, etc.) | Repo `src/data/*.js` edit | Yes (code) |

---

## Question (practice bank + previous paper)

`correct` is a **0-based index array** (`A=0, B=1, C=2, D=3`). `mcq` = exactly one
correct; `msq` = multiple. `image`/`video` optional (see Media below).

```json
{
  "q": "Normal adult resting pulse rate?",
  "type": "mcq",
  "topic": "fund",
  "sub": "Vital Signs",
  "options": ["40-60 bpm", "60-100 bpm", "100-120 bpm", "120-140 bpm"],
  "correct": [1],
  "exp": "Normal adult resting pulse is 60 to 100 bpm.",
  "wrong": { "0": "Bradycardia", "2": "Mild tachycardia" },
  "memoryTip": "Optional intuition or mnemonic.",
  "difficulty": "easy",
  "source": "NORCET 2023 PYQ",
  "image": "https://pub-YOURBUCKET.r2.dev/q/figure.png",
  "video": "https://youtu.be/VIDEOID",
  "isPYQ": true,
  "pyqYear": 2024
}
```

- **Practice banks**: `exp` is REQUIRED (the app's promise: never a bare answer key).
- **Previous papers**: `exp` is OPTIONAL (papers ship answer-only, author over time).
  Set the bank type to "Previous paper" and give it a year; it lands in the Previous
  Papers archive and runs as a timed paper in original order.

## Media (images + video)

Question figures live on **Cloudflare R2** (zero egress). In the Bank editor, use
**Upload images** to send a file and copy its public URL into the question's `image`
field, or paste any https URL / inline `data:` URI. Video is a LINK in `video`
(YouTube preferred; renders a tap-to-play card). Setup: `docs/media-r2.md`.

## Dosage drill

```json
{
  "id": "d-custom-1",
  "type": "tablets",
  "q": "Ordered 500 mg PO. Stock 250 mg tablets. How many tablets?",
  "answer": 2,
  "unit": "tablet(s)",
  "tolerance": 0,
  "steps": ["Desired / on-hand = 500 / 250 = 2"],
  "intuition": "Two 250s make the 500."
}
```
`answer` numeric; `tolerance` optional (0 = exact). `steps`/`intuition` optional.

## Concept card group (Learn)

One group = one sub-topic bundle of cards. `body` is a string, OR an array of
strings for `keypoints`.

```json
{
  "topicId": "fund",
  "sub": "Vital Signs",
  "cards": [
    { "type": "concept", "title": "Normal ranges", "body": "Pulse 60 to 100 bpm...", "clinicalNote": "Optional bedside story." },
    { "type": "mnemonic", "title": "ABCDE", "body": "Airway, Breathing..." },
    { "type": "keypoints", "title": "Red flags", "body": ["Tachy + low BP = shock", "Silent chest = severe asthma"] }
  ]
}
```
`type` is `concept | mnemonic | keypoints`. If the `sub` already exists in the
built-in cards, your cards are appended to it.

## Reference value

```json
{ "cat": "labs", "section": "Electrolytes", "label": "Potassium", "value": "3.5 to 5.0 mmol/L", "note": "Watch the heart at the extremes" }
```
`cat` groups the list (labs, dosages, ...); `section` sub-groups; `note` optional.

## Quote (Home)

```json
{ "text": "Discipline is choosing what you want most over what you want now.", "source": "Anonymous" }
```
Public-domain or original only. No long dashes.

---

## How packs merge

Content Studio saves each type to `cpack:<type>` in the shared store. At load the
app merges your pack OVER the bundled base: dosage dedupes by `id` (base wins),
quotes dedupe by exact text, reference appends, concept cards append into the
matching sub. Old/offline clients that cannot read the pack simply show the base.
