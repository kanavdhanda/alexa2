# Asset Generation Prompts

This document contains generation prompts for visual assets used in the Flagship Demo. Each asset currently has a placeholder in place; regenerate these with the prompts below to upgrade visual fidelity.

---

## Hero Splash — `frontend/public/hero.png`

**Target:** 1920×1080 (16:9), cinematic hero image for demo landing.

**Generation Prompt:**

> A warm, inviting Indian living room at golden hour (dusk). A sleek smart speaker sits on a wooden side table, glowing softly with a cyan accent light. Through the windows, you can see the last rays of sunlight. Subtle cyan network threads flow through the walls and furniture, representing connectivity and data flow. The scene is cinematic, professionally photographed, with shallow depth of field. Warm terracotta and cream tones dominate. The mood is aspirational and modern yet rooted in home comfort. No text.

**Current Status:** Placeholder in use.

---

## Khata Ledger Texture — `frontend/public/khata-paper.png`

**Target:** Seamless or large tileable texture (~2048×2048 or larger).

**Generation Prompt:**

> Aged, cream-colored paper texture resembling a traditional Indian ledger (khata) page. The paper has a slightly worn, matte finish with subtle color variation (hints of tan and sepia). A faint red margin line runs vertically on the left edge (classic ledger style). Subtle horizontal guide lines (very faint, barely visible) suggest ruled notebook paper. Dust speckles and slight creases add authenticity. Photograph or render quality, high resolution, suitable for tiling as a background texture.

**Current Status:** Placeholder in use.

---

## Vendor Avatars — `frontend/public/vendors/{avatar-name}.png`

**Target:** Four separate 256×256 PNG avatars, friendly flat illustration style.

**Generation Prompt (unified for all four):**

> Create four friendly, flat-illustration vendor avatars in a consistent, cheerful style. Each character is drawn in a minimalist Indian aesthetic:
>
> 1. **Doodhwala (Milkman)** — A smiling man with a traditional white kurta, carrying a bicycle with milk cans. Include the bicycle and subtle dairy imagery. Warm earth tones.
> 2. **Dhobi (Washer)** — A figure in casual attire holding or standing next to an iron, with folded clothes nearby. Include subtle laundry imagery. Blues and greens.
> 3. **Maid (House Helper)** — A person in practical household clothing, holding or near cleaning supplies. Include a broom or cloth. Neutral, professional tones.
> 4. **Newspaper Vendor** — A cheerful figure holding rolled newspapers or a newspaper bundle, perhaps with a cap. Include subtle newsprint imagery. Bold, warm tones.
>
> Each avatar should fit in a 256×256 square with transparent background. All avatars should share the same illustration style, line weight, and color palette for consistency. Expressions should be warm, welcoming, and approachable. Suitable for use as profile avatars in a vendor ledger app.

**Current Status:** Placeholders in use.

---

## Optional: 20-Second Intro Video — `frontend/public/intro-video.mp4`

**Target:** 20 seconds, 1920×1080, H.264 or WebM codec, suitable for web autoplay (muted).

**Generation Prompt:**

> Create a 20-second cinematic intro video for a smart home demo. Open on a black screen with a subtle cyan glow. Pan through a stylized Indian living room (warm, minimalist). A smart speaker lights up at the center. Cyan network lines flow and connect through the space (animated, organic). Text fades in: "The Brain at Home." Show a quick montage of everyday moments (device interaction, sensor glow, data flowing). Close with the smart speaker in focus, glowing with confidence. Modern, premium feel. No dialogue; consider a subtle ambient soundscape (future-tech, warm). Final frame holds on the speaker for 2 seconds. Smooth transitions, cinematic color grading (warm golds, deep blues, cyan accents).

**Current Status:** Not yet generated; video is optional and can be skipped for MVP.

---

## Implementation Notes

- All image assets should be optimized for web (reduced file size, appropriate format).
- The khata texture is embedded as a background; ensure it tiles seamlessly.
- Vendor avatars should have consistent styling across all four illustrations for a cohesive, professional look.
- The hero splash is the first impression; prioritize this one.
- If regenerating, test in the actual app to ensure colors and proportions feel right in context (dark mode / light mode compatibility as needed).

---

**Commit reference:** `docs: change log and asset generation prompts`
