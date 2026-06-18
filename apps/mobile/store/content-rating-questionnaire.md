# Content rating questionnaire — answer stubs (M6·T5.2)

Complete the official questionnaires in **App Store Connect** (Age Rating) and **Google Play Console** (Content rating → IARC). Answers below are stubs — adjust if store wording differs.

**App category:** News / Reference / Education (informational, not a game)  
**Sensitive content:** Armed conflict statistics and links to third-party news/OSINT (no embedded graphic media)

---

## Apple — Age Rating (2025 questionnaire themes)

| Topic | Answer | Notes |
|-------|--------|-------|
| Cartoon or fantasy violence | None | |
| Realistic violence | Infrequent/Mild or Frequent/Mild — **verify against current Apple definitions** | Statistical framing; no graphic imagery in-app |
| Prolonged graphic sadistic violence | None | Evidence is linked, not shown |
| Profanity or crude humor | None / Infrequent | Source pages may vary; not in-app |
| Mature/suggestive themes | None | |
| Horror/fear themes | None | |
| Medical/treatment information | None | Wounded counts are statistical |
| Alcohol, tobacco, drugs | None | |
| Gambling | None | |
| Sexual content or nudity | None | |
| Unrestricted web access | **Yes** (if declaring browser for source links) or **No** if only deep-linked domains | Opens news/social URLs for evidence |
| User-generated content | **No** | Read-only evidence browser |
| Messaging / chat | No | |
| Made for Kids | **No** | |

**Expected rating:** 12+ or 17+ depending on "realistic violence" interpretation for conflict statistics — confirm with Apple's current matrix.

---

## Google Play — IARC stub answers

| Question theme | Suggested answer |
|----------------|------------------|
| Violence | Mild or Moderate — conflict statistics, no graphic depictions in-app |
| Sexuality | None |
| Language | None or Mild |
| Controlled substances | None |
| User interaction (users can communicate) | No |
| Shares user location | No |
| Unrestricted internet | Yes — opens external evidence URLs |
| Digital purchases | No |
| Gambling | No |

**Expected rating:** Teen (ESRB) / PEGI 12–16 equivalent — IARC will compute per region.

---

## Mac App Store (iPad app on Apple Silicon)

Uses the **same** Apple age rating as the iOS build. Enable "Designed for iPad" distribution; no separate binary.

---

## Pre-submit checklist

- [ ] Screenshots show counter + map, not graphic source material
- [ ] Store description uses neutral framing (see `description.txt`)
- [ ] Privacy labels match `privacy-nutrition-notes.md` and `/privacy` page
- [ ] Reviewer notes explain linked-not-embedded evidence policy
- [ ] Content rights: only PeaceClock UI assets; map tiles per provider ToS