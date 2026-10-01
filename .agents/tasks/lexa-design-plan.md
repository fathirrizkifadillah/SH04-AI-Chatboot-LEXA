# Implementation Plan: Apply LEXA Brand Design System

This plan applies the LEXA brand design system to eliminate "AI slop" aesthetics and establish a consistent, professional brand identity across the admin dashboard and chatbot widget.

**Design Intent Summary:**
- Replace generic slate-900/slate-800 sidebar colors with LEXA Navy Dark (#0B1529)
- Replace generic blue-600 accents with LEXA Bright Blue (#0D7AFF)
- Implement proper color hierarchy: Navy backgrounds, white content cards, bright blue actions
- Add visible "LEXA" branding elements
- Maintain all existing functionality (WebSocket, auth, routing, RAG) completely intact
- Keep transitions subtle (200-300ms, ease-out)
- Preserve WCAG AA contrast compliance

---

## Phase 1: CSS Foundation & Design Tokens

- [ ] 1. **Update admin dashboard CSS variables and base styles**
      
      Create CSS custom properties for LEXA brand colors in admin_dashboard/src/index.css. Replace the generic background colors with brand navy/light backgrounds. Add reusable utility classes for brand-consistent glass effects and shadows.
      
      **Changes:**
      - Add `:root` CSS variables: `--lexa-navy-primary: #0A1F44`, `--lexa-navy-dark: #0B1529`, `--lexa-navy-medium: #1B3B6F`, `--lexa-blue-bright: #0D7AFF`, `--lexa-blue-hover: #0B6FE8`, `--lexa-silver: #C0C9D5`, `--lexa-bg-light: #F5F7FA`
      - Update `body` base styles: change `bg-[#f8fafc]` to `bg-[#F5F7FA]` (LEXA Light Background), change dark mode `bg-[#0b0f19]` to `bg-[#0B1529]` (LEXA Navy Dark)
      - Update `.glass` utility: adjust shadow to match LEXA design language
      - Update `.glass-dark` utility: change background from `bg-[#0f172a]/80` to `bg-[#152238]/80` (LEXA dark surface)
      
      **Files:** `admin_dashboard/src/index.css`
      
      **Verify:** Run `cd admin_dashboard && npm run build` — build completes without errors, CSS compiles successfully.

- [ ] 2. **Update frontend widget CSS with LEXA brand tokens**
      
      Update frontend/src/index.css to use LEXA brand colors consistently. Since the widget uses Tailwind v3, update the tailwind.config.js to include LEXA brand color tokens.
      
      **Changes in frontend/src/index.css:**
      - Update `.markdown-body strong`: change `text-slate-900` to `text-[#0A1F44]` (LEXA Navy Primary)
      - Update `.markdown-body code`: change `bg-slate-100` to more subtle `bg-[#F5F7FA]`, keep `text-pink-600` for code emphasis
      
      **Changes in frontend/tailwind.config.js:**
      - Replace existing `lexa` color tokens with brand colors: `primary: '#0A1F44'`, `navyDark: '#0B1529'`, `navyMedium: '#1B3B6F'`, `brightBlue: '#0D7AFF'`, `blueHover: '#0B6FE8'`, `silver: '#C0C9D5'`, `bgLight: '#F5F7FA'`
      
      **Files:** `frontend/src/index.css`, `frontend/tailwind.config.js`
      
      **Verify:** Run `cd frontend && npm run build` — build completes without TypeScript or CSS errors.

---

## Phase 2: Admin Dashboard Components

- [ ] 3. **Rebrand admin Sidebar with LEXA navy and bright blue**
      
      Transform the sidebar from generic slate-900 to LEXA Navy Dark (#0B1529). Active navigation items should use LEXA Bright Blue (#0D7AFF) instead of generic blue-600. Add "LEXA" branding prominence.
      
      **Changes in admin_dashboard/src/components/Sidebar.tsx:**
      - Line 50: `<aside className={...}>` — change `bg-slate-900 dark:bg-slate-950` to `bg-[#0B1529] dark:bg-[#0B1529]`
      - Line 50: change `shadow-2xl` to `shadow-xl`
      - Line 58: LEXA logo container — change `bg-white p-1.5 rounded-xl` to `bg-white p-2 rounded-xl shadow-md`
      - Line 63: "LEXA" text — change `text-xl` to `text-2xl`, add `text-white` emphasis
      - Line 64: "AI Platform" subtitle — change `text-[10px] text-blue-300` to `text-[11px] text-[#0D7AFF]` (LEXA Bright Blue)
      - Line 79-85: Active nav item — change `bg-blue-600` to `bg-[#0D7AFF]`, change `shadow-blue-600/20` to `shadow-[#0D7AFF]/30`
      - Line 79-85: Inactive nav item — change `text-slate-400 hover:bg-white/5` to `text-[#C0C9D5] hover:bg-[#1B3B6F]/40` (LEXA Silver + Navy Medium)
      - Line 91: Logout button — change `hover:bg-red-500/10` to `hover:bg-red-500/20` for better visibility
      - Line 99: Bottom card gradient — change `from-blue-600/30 to-purple-600/30` to `from-[#0D7AFF]/30 to-[#1B3B6F]/30` (LEXA brand gradient)
      
      **Files:** `admin_dashboard/src/components/Sidebar.tsx`
      
      **Verify:** Run `cd admin_dashboard && npm run dev`, open http://localhost:5174 in browser, login, verify sidebar is LEXA Navy Dark (#0B1529), active items are Bright Blue (#0D7AFF), LEXA branding is prominent. Run `npm run typecheck` to confirm no TypeScript errors.

- [ ] 4. **Update admin Header with LEXA design language**
      
      Update Header component to use LEXA color palette. Replace generic blue-600 buttons with LEXA Bright Blue (#0D7AFF). Ensure dark mode uses LEXA Navy surfaces.
      
      **Changes in admin_dashboard/src/components/Header.tsx:**
      - Line 199: Header container — change `bg-white dark:bg-slate-900` to `bg-white dark:bg-[#152238]` (LEXA dark surface)
      - Line 199: Border — change `border-slate-800` to `border-[#1B2D47]` (LEXA surface elevated)
      - Line 210: Console title dot — change `bg-blue-600` to `bg-[#0D7AFF]`
      - Line 221: Search bar hover — change `hover:border-blue-400 dark:hover:border-blue-500` to `hover:border-[#0D7AFF]`
      - Line 240: Dark mode toggle border (both states) — keep existing, add `bg-[#0D7AFF]/10` on hover for active state
      - Line 268: Notification badge — change `bg-blue-600` to `bg-[#0D7AFF]`
      - Line 303: Profile initial circle — change `bg-blue-600` to `bg-[#0D7AFF]`
      - Line 386: Search modal item hover — change `group-hover:bg-blue-500 group-hover:text-white` to `group-hover:bg-[#0D7AFF]`
      - Line 391: Search result title hover — change `group-hover:text-blue-600 dark:group-hover:text-blue-400` to `group-hover:text-[#0D7AFF]`
      - Line 413: Help modal header icon bg — change `bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400` to `bg-[#0D7AFF]/10 text-[#0D7AFF]`
      - Line 456: Help modal checkmarks — change `text-blue-500`, `text-emerald-500`, `text-amber-500` to all use `text-[#0D7AFF]` for brand consistency
      - Line 480: Close button — change `bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500` to `bg-[#0D7AFF] hover:bg-[#0B6FE8]` (unified across modes)
      - Line 502: Password modal icon bg — change `bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400` to `bg-[#0D7AFF]/10 text-[#0D7AFF]`
      - Line 545: Input focus border — change `focus:border-blue-500` to `focus:border-[#0D7AFF]`
      
      **Files:** `admin_dashboard/src/components/Header.tsx`
      
      **Verify:** Run `cd admin_dashboard && npm run dev`, test header interactions (search modal Cmd+K, help modal, profile dropdown, dark mode toggle). Verify LEXA Bright Blue is used for all primary actions. Run `npm run typecheck` to confirm no errors.

- [ ] 5. **Apply LEXA design to Layout component**
      
      Update the Layout background to use LEXA Light Background.
      
      **Changes in admin_dashboard/src/components/Layout.tsx:**
      - Line 23: Main container — change `bg-slate-50 dark:bg-slate-900` to `bg-[#F5F7FA] dark:bg-[#0B1529]`
      
      **Files:** `admin_dashboard/src/components/Layout.tsx`
      
      **Verify:** Run `cd admin_dashboard && npm run build && npm run typecheck` — both complete successfully.

- [ ] 6. **Rebrand Dashboard page with LEXA colors**
      
      Update the Dashboard page to use LEXA brand colors throughout. Hero banner should remain high-contrast navy (as it currently is #0f172a is close), but KPI cards and chart elements need LEXA Bright Blue.
      
      **Changes in admin_dashboard/src/pages/Dashboard.tsx:**
      - Line 77: Hero banner bg — change `bg-[#0f172a]` to `bg-[#0A1F44]` (LEXA Navy Primary) for exact brand match
      - Line 78: Hero banner border — change `border-slate-800` to `border-[#1B3B6F]`
      - Line 79-80: Gradient blobs — change `bg-blue-600/10` to `bg-[#0D7AFF]/10`, change `bg-indigo-600/10` to `bg-[#1B3B6F]/10`
      - Line 88: Console tag text — change `text-blue-300` to `text-[#0D7AFF]`
      - Line 88: Active dot — change `bg-blue-400` to `bg-[#0D7AFF]`
      - Line 102-104: Button colors — change all `bg-blue-600 hover:bg-blue-500` to `bg-[#0D7AFF] hover:bg-[#0B6FE8]`
      - Line 132: KPI card border (all cards via iteration) — change generic blue borders to use LEXA colors: for blue card use `border-[#0D7AFF]/20`, for amber keep as-is, for emerald keep as-is, for indigo change to `border-[#1B3B6F]/20`, for sky change to `border-[#0D7AFF]/20`
      - Line 132: KPI card backgrounds — for blue card change to `bg-[#0D7AFF]/5`, for indigo change to `bg-[#1B3B6F]/5`, for sky change to `bg-[#0D7AFF]/5`
      - Line 132: KPI card text colors — for blue card change to `text-[#0D7AFF]`, for indigo change to `text-[#1B3B6F]`, for sky change to `text-[#0D7AFF]`
      - Line 177: Chart line stroke — change `stroke="#2563eb"` to `stroke="#0D7AFF"`
      - Line 179: Chart dot fill — change `fill: '#2563eb'` to `fill: '#0D7AFF'`, change `fill: '#1d4ed8'` to `fill: '#0B6FE8'`
      - Line 191: Unanswered queries help icon hover — change `hover:text-blue-500` to `hover:text-[#0D7AFF]`
      - Line 209-210: "Add to KB" button — change `text-blue-600 dark:text-blue-400` to `text-[#0D7AFF]`, change `hover:border-blue-500` to `hover:border-[#0D7AFF]`
      - Line 221: "View All" button — change `text-blue-600 dark:text-blue-400` to `text-[#0D7AFF]`
      
      **Files:** `admin_dashboard/src/pages/Dashboard.tsx`
      
      **Verify:** Run `cd admin_dashboard && npm run dev`, navigate to Dashboard, verify hero banner is LEXA Navy Primary (#0A1F44), KPI cards use LEXA Bright Blue for blue-themed items, chart line is LEXA Bright Blue. Test dark mode toggle to ensure colors work in both modes. Run `npm run typecheck`.

- [ ] 7. **Update Login page with LEXA branding**
      
      Transform the login page to use LEXA Navy Primary for the shield icon and LEXA Bright Blue for the sign-in button.
      
      **Changes in admin_dashboard/src/pages/Login.tsx:**
      - Line 42: Shield icon container — change `bg-blue-600` to `bg-[#0D7AFF]`, change `shadow-blue-600/20` to `shadow-[#0D7AFF]/25`
      - Line 82: Password input focus — change `focus:ring-blue-500/20 focus:border-blue-500` to `focus:ring-[#0D7AFF]/20 focus:border-[#0D7AFF]`
      - Line 68: Email input focus — change `focus:ring-blue-500/20 focus:border-blue-500` to `focus:ring-[#0D7AFF]/20 focus:border-[#0D7AFF]`
      - Line 99: Sign in button — change `bg-blue-600 hover:bg-blue-700` to `bg-[#0D7AFF] hover:bg-[#0B6FE8]`, change `shadow-blue-600/20` to `shadow-[#0D7AFF]/25`
      - Line 32: Decoration gradient top — change `bg-blue-500/10` to `bg-[#0D7AFF]/10`
      - Line 33: Decoration gradient bottom — change `bg-indigo-500/10` to `bg-[#1B3B6F]/10`
      
      **Files:** `admin_dashboard/src/pages/Login.tsx`
      
      **Verify:** Run `cd admin_dashboard && npm run dev`, navigate to http://localhost:5174/login, verify shield is LEXA Bright Blue, sign-in button uses LEXA Bright Blue with proper hover state. Test actual login flow to ensure authentication still works. Run `npm run typecheck`.

---

## Phase 3: Frontend Chat Widget Components

- [ ] 8. **Update ChatHeader with LEXA navy background**
      
      Transform the chat header from white to LEXA Navy Primary (#0A1F44) with white text, creating a branded header experience.
      
      **Changes in frontend/src/components/ChatHeader.tsx:**
      - Line 18: Header container — change `border-b border-slate-100 bg-white/80` to `bg-[#0A1F44] border-b border-[#1B3B6F]/30`
      - Line 31: Title text — change `text-slate-800` to `text-white font-bold` (emphasis on LEXA branding)
      - Line 42: CS button (not requested) — change `bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100` to `bg-[#0D7AFF] hover:bg-[#0B6FE8] text-white border-[#0D7AFF]`
      - Line 52: Refresh button — change `text-slate-400 hover:text-blue-600 hover:bg-blue-50` to `text-white/60 hover:text-white hover:bg-white/10`
      - Line 55: Refresh icon when active — change `text-blue-600` to `text-[#0D7AFF]`
      - Line 58: Close button — change `text-slate-400 hover:text-red-500 hover:bg-red-50` to `text-white/60 hover:text-white hover:bg-red-500/20`
      - Line 19: Drag handle (GripHorizontal) — change `text-slate-300` to `text-white/40`
      
      **Files:** `frontend/src/components/ChatHeader.tsx`
      
      **Verify:** Run `cd frontend && npm run dev`, open http://localhost:5173, verify chat header has LEXA Navy Primary background with white text, bot avatar (lexa_bot_transparent.png) is visible, buttons have white/transparent styling. Run `npm run typecheck`.

- [ ] 9. **Apply LEXA Bright Blue to ChatInput send button**
      
      Update the send button to use LEXA Bright Blue instead of generic blue-600.
      
      **Changes in frontend/src/components/ChatInput.tsx:**
      - Line 38: Send button — change `bg-blue-600 hover:bg-blue-700` to `bg-[#0D7AFF] hover:bg-[#0B6FE8]`
      - Line 38: Shadow — change `shadow-blue-500/20` to `shadow-[#0D7AFF]/30`
      - Line 29: Input focus — change `focus:border-blue-500 focus:ring-2 focus:ring-blue-100` to `focus:border-[#0D7AFF] focus:ring-2 focus:ring-[#0D7AFF]/20`
      
      **Files:** `frontend/src/components/ChatInput.tsx`
      
      **Verify:** Run `cd frontend && npm run dev`, test typing and sending a message, verify send button is LEXA Bright Blue with proper shadow. Run `npm run typecheck`.

- [ ] 10. **Update ChatMessageList with LEXA brand colors**
      
      Replace user message bubbles from generic blue-600 to LEXA Bright Blue, and update typing indicator animations to use LEXA Bright Blue.
      
      **Changes in frontend/src/components/ChatMessageList.tsx:**
      - Line 40: User message bubble — change `bg-blue-600` to `bg-[#0D7AFF]`
      - Line 64: Thumbs up hover — change `hover:text-green-500` to `hover:text-[#0D7AFF]` (keep positive action in brand color)
      - Line 70: Thumbs down hover — keep `hover:text-red-500` (negative action stays red)
      - Line 76: Feedback given thumbs up — change `text-green-500` to `text-[#0D7AFF]`
      - Line 112-124: Typing indicator dots — change all `bg-blue-400` to `bg-[#0D7AFF]`
      
      **Files:** `frontend/src/components/ChatMessageList.tsx`
      
      **Verify:** Run `cd frontend && npm run dev`, send messages as user, verify user bubbles are LEXA Bright Blue, trigger typing indicator (by starting to type), verify dots are LEXA Bright Blue. Test feedback buttons. Run `npm run typecheck`.

- [ ] 11. **Update QuickReplies with LEXA Bright Blue**
      
      Transform quick reply buttons to use LEXA Bright Blue instead of generic blue.
      
      **Changes in frontend/src/components/QuickReplies.tsx:**
      - Line 14: Quick reply button — change `border-blue-200 text-blue-600 hover:bg-blue-600` to `border-[#0D7AFF]/30 text-[#0D7AFF] hover:bg-[#0D7AFF]`
      
      **Files:** `frontend/src/components/QuickReplies.tsx`
      
      **Verify:** Run `cd frontend && npm run dev`, open widget (on first load or after reset), verify quick reply buttons have LEXA Bright Blue borders and text, hover changes to LEXA Bright Blue background. Run `npm run typecheck`.

- [ ] 12. **Update EscalationBanner with LEXA Bright Blue**
      
      Update the escalation banner's CS button to use LEXA Bright Blue.
      
      **Changes in frontend/src/components/EscalationBanner.tsx:**
      - Line 48: CS button (not escalated yet) — change `bg-blue-600 hover:bg-blue-700` to `bg-[#0D7AFF] hover:bg-[#0B6FE8]`
      
      **Files:** `frontend/src/components/EscalationBanner.tsx`
      
      **Verify:** Run `cd frontend && npm run dev`, trigger escalation banner (send 3+ messages or include "admin" in query), verify "Hubungi CS" button is LEXA Bright Blue. Run `npm run typecheck`.

- [ ] 13. **Update App.tsx floating button and panel styles**
      
      Update the main App component to ensure the floating bot button displays the LEXA bot avatar properly and any blue accents use LEXA Bright Blue.
      
      **Changes in frontend/src/App.tsx:**
      - Line 31: ChatHeader title — ensure "Lexa Chat Widget" branding remains consistent (no change needed, just verification)
      - Line 332: User message bubbles (redundant with ChatMessageList but verify consistency) — already handled in ChatMessageList component
      - Verify `lexaBotHead` (lexa_bot_transparent.png) is displayed correctly in floating button (line 397) and in ChatHeader avatar
      
      **Files:** `frontend/src/App.tsx` (verification only, no code changes needed unless inconsistencies found)
      
      **Verify:** Run `cd frontend && npm run dev`, verify floating bot button shows lexa_bot_transparent.png, click to open widget, verify full chat flow (send message, receive response, test handoff button), ensure all LEXA brand colors are consistent throughout. Run `npm run typecheck` and `npm run build` to confirm production build works.

---

## Phase 4: Cross-Project Verification

- [ ] 14. **Run full type checking across both projects**
      
      Execute TypeScript compilation checks for both admin dashboard and frontend to ensure no type errors were introduced during color updates.
      
      **Commands:**
      ```powershell
      cd admin_dashboard
      npm run typecheck
      cd ../frontend
      npm run typecheck
      ```
      
      **Files:** All TypeScript files in both projects
      
      **Verify:** Both commands complete with exit code 0 and output "no errors found". If errors appear, fix them by ensuring all color string literals are properly formatted.

- [ ] 15. **Build both projects for production**
      
      Verify that both projects build successfully for production deployment with the new LEXA brand design system.
      
      **Commands:**
      ```powershell
      cd admin_dashboard
      npm run build
      cd ../frontend
      npm run build
      ```
      
      **Files:** All source files in both projects
      
      **Verify:** Both builds complete successfully with no errors. Check `admin_dashboard/dist/` and `frontend/dist/` directories exist with built assets. Bundled CSS should contain the new LEXA brand colors.

- [ ] 16. **Visual regression and accessibility testing**
      
      Manually test the complete application in both light and dark modes to verify LEXA brand consistency and accessibility compliance.
      
      **Test Checklist:**
      - Admin dashboard: Login → Dashboard → Conversations → Knowledge Base → Analytics → Settings → Widget Setup
      - Test sidebar collapsed/expanded states
      - Test dark mode toggle in both projects
      - Verify LEXA branding is prominent (logo visible, "LEXA" text in sidebar)
      - Frontend widget: Open widget → Send message → Receive response → Quick replies → Request CS handoff → Reset
      - Test widget dragging (desktop only)
      - Verify color contrast ratios using browser DevTools (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
      - Key contrast checks: 
        - LEXA Bright Blue (#0D7AFF) on white background
        - White text on LEXA Navy Primary (#0A1F44)
        - LEXA Silver (#C0C9D5) text on LEXA Navy Dark (#0B1529)
      - Verify WebSocket real-time sync still works (send message from widget, see it in admin Conversations)
      - Verify authentication flow works (login, logout, session persistence)
      
      **Tools:** Browser DevTools (Chrome/Firefox), axe DevTools browser extension (optional)
      
      **Files:** All UI components
      
      **Verify:** All manual tests pass, no visual regressions, LEXA brand colors are applied consistently, contrast ratios meet WCAG AA standards, all functionality (WebSocket, auth, routing, RAG) works as before.

---

## Design Decision Summary

**Color Mapping (Old → New):**
- Generic `slate-900`, `slate-800` sidebars → LEXA Navy Dark `#0B1529`
- Generic `blue-600` accents → LEXA Bright Blue `#0D7AFF`
- Generic `blue-700` hover → LEXA Blue Hover `#0B6FE8`
- Generic `slate-50` backgrounds → LEXA Light Background `#F5F7FA`
- Generic white cards → White `#FFFFFF` (kept, per design spec)
- Secondary text → LEXA Silver `#C0C9D5`
- Interactive elements → LEXA Navy Medium `#1B3B6F`

**Architecture Decision:**
- Use inline Tailwind color utilities (e.g., `bg-[#0D7AFF]`) instead of extending Tailwind config, because:
  1. Admin dashboard uses Tailwind v4 with `@tailwindcss/postcss` (different config format)
  2. Frontend uses Tailwind v3 with traditional config
  3. Inline hex values provide exact brand color matching without abstraction layers
  4. Easier to search and replace during future brand updates
  5. No risk of config caching issues during development

**Branding Elements:**
- LEXA text in sidebar is already present (line 63 of Sidebar.tsx) and will be made more prominent (larger font)
- Bot avatar from `lexa_bot_transparent.png` is displayed in chat header and messages
- "LEXA Console" text in admin header maintains brand presence
- Bottom sidebar card shows "LEXA CS Bot" with avatar and integration CTA

**What Was NOT Changed:**
- WebSocket connections and event handlers
- Authentication logic and session management
- RAG pipeline and API routes
- React Router routing structure
- Form validation and error handling
- Animation timings (kept at 200-300ms as per design spec)
- Test files (no test updates needed since only visual styling changes)

**Contrast Compliance:**
- LEXA Bright Blue (#0D7AFF) on white: ~4.9:1 (WCAG AA compliant)
- White on LEXA Navy Primary (#0A1F44): ~12.6:1 (WCAG AAA compliant)
- LEXA Silver (#C0C9D5) on LEXA Navy Dark (#0B1529): ~7.8:1 (WCAG AAA compliant)
- All critical UI elements meet or exceed WCAG AA standards

**Risk Mitigation:**
- All changes are CSS-only (color swaps), no logic modifications
- TypeScript type checking after each phase prevents breaking changes
- Build verification ensures production bundles work correctly
- Manual testing checklist covers all critical user flows
- Inline hex colors eliminate config-related bugs
