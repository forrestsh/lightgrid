# LIG-7 · English / Chinese tool menu for OpenRC F1

**Type:** User story

**Mode:** OpenRC F1 · Livery / Assembly

**Status:** Ready for refinement

**References:** [fcc_car.html](../fcc_car.html), [LIG-6](LIG-6.md)

---

## Story

**As a** player,

**I want** the OpenRC F1 game tool menu to support both English and Chinese,

**so that** I can understand and use the game's controls in my preferred language.

---

## Background & context

The OpenRC F1 interface currently presents its tool menu, interaction hints, selected-part message, and panel accessibility label in Chinese. Players should be able to switch the complete game UI between **English** and **Chinese** without reloading the page or changing the underlying gameplay.

This story covers user-facing text in `fcc_car.html`. It does not translate the Lightgrid application or add additional languages.

---

## Acceptance criteria

### AC1 — Language selector is available

- **Given** I open OpenRC F1,
- **Then** a clearly visible language control offers **English** and **中文**,
- **And** the control is usable with a mouse, keyboard, and touch.

### AC2 — English tool menu

- **Given** English is selected,
- **Then** all tool-menu labels are shown in English, including:
  - mode: **Paint**, **Move**;
  - paint tools: **Face**, **Cell**, **Part**, **Eyedropper**, **Eraser**;
  - actions and settings: **Undo**, **Part color**, **Plain**, **Auto-spin**, **Reset paint**, and **Reset layout**.

### AC3 — Chinese tool menu

- **Given** 中文 is selected,
- **Then** all tool-menu labels are shown in Chinese, including the existing labels:
  - mode: **涂装**, **移动**;
  - paint tools: **面**, **整格**, **整件**, **吸管**, **橡皮**;
  - actions and settings: **撤销**, **零件底色**, **素色**, **自转**, **复位涂装**, and **复位布局**.

### AC4 — Supporting UI text is translated

- **When** I change the language,
- **Then** the interaction hint, selected-part message, panel expand/collapse text and accessible label, and other user-facing tool-menu text immediately use the selected language,
- **And** no mixed-language UI remains, except the product name **OpenRC F1** and proper names.

### AC5 — Language changes without disrupting play

- **Given** I have painted the car, moved a part, selected a tool, or changed another setting,
- **When** I switch languages,
- **Then** the UI text changes without a page reload,
- **And** my paint, layout, undo history, selected mode/tool, camera position, and settings remain unchanged.

### AC6 — Language preference persists

- **Given** I select English or 中文,
- **When** I reload or revisit OpenRC F1 in the same browser,
- **Then** the game opens in my most recently selected language.

### AC7 — Sensible first-visit default

- **Given** I have no saved language preference,
- **When** I open OpenRC F1 for the first time,
- **Then** the game uses the browser language when it is English or Chinese,
- **And** falls back to English for any other browser language.

### AC8 — Responsive and accessible

- **Given** a desktop or phone viewport,
- **Then** translated labels remain readable and do not overlap, clip, or make required controls unreachable,
- **And** the active language is programmatically identifiable (for example, with `aria-pressed` or an equivalent accessible state),
- **And** the document's `lang` attribute matches the selected language (`en` or `zh-CN`).

### AC9 — No gameplay regression

- **Then** painting, moving parts, undo, base-color selection, auto-spin, zoom, reset actions, touch controls, and saved livery/layout continue to work in both languages.

---

## UX / interaction notes

- Use a compact **EN / 中文** segmented control near the game title or tool-panel header.
- Keep the selector visible when the tool panel is collapsed so the language can always be changed.
- Translate meaning rather than forcing identical label lengths; widen or wrap controls where necessary on small screens.
- Changing language should be immediate and should not require a confirmation dialog.

## Technical notes (implementation pointers)

- Store translations in one dictionary keyed by stable identifiers rather than duplicating the tool menu markup.
- Apply translations through `data-i18n` attributes or an equivalent centralized rendering function.
- Include dynamic strings, such as paint/move hints and the selected-part message, in the same translation system.
- Persist the preference under a dedicated key such as `openrc-f1-language`; do not modify the existing livery or layout storage data.
- Update `<html lang>` whenever the player changes language.

## Out of scope

- Translating Lightgrid or other games.
- Adding languages other than English and Chinese.
- Changing OpenRC F1 gameplay, tools, or car behavior.
- Translating user-created content or part/model identifiers that are not displayed to the player.

## Open questions

- Should Chinese use Simplified Chinese only (`zh-CN`), or should Traditional Chinese be added in a future story?
- Should the language preference be shared across all Lightgrid games once other pages become bilingual?

## Definition of Done

- [ ] AC1–AC9 pass on desktop and at a phone viewport of approximately 375 × 812.
- [ ] Every user-facing OpenRC F1 tool-menu string exists in both English and Chinese.
- [ ] Switching languages preserves all current game state and requires no reload.
- [ ] The saved preference and first-visit browser-language behavior are verified.
- [ ] Keyboard navigation, accessible language state, and the document `lang` value are verified.
- [ ] No console errors or gameplay regressions occur in either language.
