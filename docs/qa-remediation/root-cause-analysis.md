# Root-Cause Analysis — LEXA QA Remediation

**Date:** 2026-10-26  
**Investigator:** Principal Full-Stack & Application Security Engineer  
**Scope:** 17 active findings from QA Report dated October 26, 2026

---

## 1. Executive Summary

A comprehensive investigation was conducted across the backend (FastAPI, SQLAlchemy, Python 3.11), admin dashboard (React 19, TypeScript, Vite, Tailwind CSS), and customer chat widget (React 19, Framer Motion). All 17 active findings were traced directly to their code-level root causes using source analysis, baseline test execution, and architectural review.

---

## 2. Detailed Root-Cause Analysis for Every Active Finding

### P1 — Functional Correctness and Security

#### FUNC-003: Export Semua CSV Dilaporkan Tidak Dapat Digunakan
- **Module / Location:** Admin Dashboard > Percakapan (`admin_dashboard/src/pages/Conversations.tsx`), Backend (`routers/admin.py:218-255`).
- **Reproduction Status:** Reproduced via code analysis and HTTP request inspection.
- **Actual Root Cause:**
  1. *Missing Authorization Header:* In `Conversations.tsx` line 621, clicking "Export Semua CSV" invoked raw `window.fetch(`${apiUrl}/api/admin/sessions/export-all?format=csv`, { credentials: 'include' })`. It failed to pass `Authorization: Bearer <token>` from `sessionStorage.getItem('lexa_admin_token')`. On cross-origin setups or environments where cookies are cross-site, the backend rejected the request with `401 Unauthorized`.
  2. *Corrupt Blob Download:* Lines 624-630 directly called `res.blob()` without checking `if (!res.ok)`. As a result, the 401 JSON error payload (`{"detail":"Authentication required"}`) was written to a file named `lexa_all_chats.csv`, resulting in an invalid, unopenable CSV.
  3. *Backend Timestamp Crash:* In `routers/admin.py:237`, `ts = datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.timezone.utc).isoformat()` crashed with `TypeError: unsupported operand type(s) for /: 'str' and 'int'` whenever `ts` was an ISO string or string format, triggering an unhandled 500 error.
  4. *Silent Error Swallowing:* The frontend caught errors in `catch (e) { console.error(e); }` without updating UI state or showing feedback.
- **Evidence:** `routers/admin.py:218-255`, `admin_dashboard/src/pages/Conversations.tsx:618-638`.
- **Correction Plan:**
  - In backend `routers/admin.py:export_all_sessions`, robustly parse timestamp whether integer, float, or string. Ensure valid CSV headers, quotes, and UTF-8 encoding.
  - In frontend `Conversations.tsx`, use authenticated helper (`api.authGet` or fetch with `Authorization` header), verify `res.ok`, show loading and success/error toasts, and trigger valid blob download.

---

#### FUNC-005: Pesan "Email Sudah Terdaftar" Bertentangan dengan Pesan Berhasil
- **Module / Location:** Admin Dashboard > Pengguna & Peran > Tambah Anggota (`admin_dashboard/src/pages/Users.tsx`), Backend (`routers/admin.py:501-535`).
- **Reproduction Status:** Reproduced via code analysis.
- **Actual Root Cause:**
  1. *No In-Flight Submission Guard:* In `Users.tsx:85-101`, `handleAdd` did not disable the submit button and lacked an `isSubmitting` state. Rapid double-clicks or keypresses sent concurrent POST requests with the identical email.
  2. *Contradictory Notification Race:* Request #1 succeeded and rendered the green banner `Anggota "${addedName}" berhasil ditambahkan.` Request #2 reached the backend, found the newly inserted email, returned 400 "Email sudah terdaftar", and executed `.catch(err => alert(err.message))`. The browser alert dialog popped up directly over the green success banner.
  3. *Uncaught Database IntegrityError:* In `routers/admin.py:506`, the backend performed a pre-check `existing = ...` without catching `IntegrityError` upon `db.commit()`, which could cause a 500 on race conditions.
- **Evidence:** `admin_dashboard/src/pages/Users.tsx:85-101`, `routers/admin.py:501-535`.
- **Correction Plan:**
  - Add `isSubmitting` state in `Users.tsx`, disable buttons while submitting, and prevent concurrent submissions.
  - Replace raw `alert()` with inline error banners inside the modal.
  - Catch `IntegrityError` in `routers/admin.py:admin_create_user` and cleanly return 400 "Email sudah terdaftar".

---

#### AUTH-001: Sesi Tetap Login Setelah Perubahan Password
- **Module / Location:** Pengaturan Akun > Ganti Password Saya (`admin_dashboard/src/components/Header.tsx`), Backend (`routers/admin.py:617-657`, `core/auth.py`, `core/database.py`).
- **Reproduction Status:** Reproduced via code analysis and backend verification.
- **Actual Root Cause:**
  1. *No Session Revocation in Backend:* `routers/admin.py:admin_change_my_password` updated `user.password_hash` in the database, but did NOT clear the `lexa_admin_session` cookie or increment a token version.
  2. *No Client-Side Logout Trigger:* In `Header.tsx:169-202`, `handleChangePassword` simply displayed `setPwdSuccess('Password Anda berhasil diperbarui!')` and closed the modal after 1.5 seconds. It never called logout or redirected to `/login`.
  3. *Stateless Token Lifetime:* Previously issued JWTs remained valid until expiration because tokens had no revocable token version tied to the user record.
- **Evidence:** `admin_dashboard/src/components/Header.tsx:183-196`, `routers/admin.py:617-657`.
- **Correction Plan:**
  - Add `token_version` to `AdminUser` model and database migration.
  - Increment `user.token_version` on password change.
  - In `core/auth.py:verify_jwt`, validate that the token's `tv` matches the database `user.token_version`.
  - In `routers/admin.py:admin_change_my_password`, delete the session cookie on success.
  - In frontend `Header.tsx`, after password change success, clear `sessionStorage` and `localStorage`, call logout, and redirect to `/login`.

---

#### RBAC-001: Pintasan Lintas Modul Perlu Verifikasi Hak Akses (Role CS)
- **Module / Location:** Dashboard Konsol for Role CS Agent (`admin_dashboard/src/pages/Dashboard.tsx:540-645`).
- **Reproduction Status:** Verified. Server-side permissions are properly enforced; UI display was unconstrained.
- **Actual Root Cause:**
  1. *Backend is Secure:* Backend routes for `/api/admin/kb*`, `/api/admin/settings*`, and `/api/admin/users*` correctly enforce `require_role(...)`. A CS Agent cannot access them via direct API calls (returns 403 Forbidden).
  2. *Unfiltered UI Shortcuts:* `Dashboard.tsx` hardcoded 4 quick action buttons ("Sinkronisasi Dokumen KB", "Meja Layanan CS", "Setup Widget", "Lihat Analisis") for all users regardless of role. When CS Agent clicked "Sinkronisasi Dokumen KB" or "Setup Widget", the client router blocked it or bounced back to dashboard.
- **Evidence:** `routers/admin.py` vs `admin_dashboard/src/pages/Dashboard.tsx:554-645`.
- **Correction Plan:** Filter quick action shortcuts in `Dashboard.tsx` according to `currentUser.role`, showing only permitted modules for CS Agent ("Meja Layanan CS" and "Lihat Analisis").

---

#### RBAC-002: Kartu Eskalasi CS Tidak Relevan untuk Role Editor Knowledge Base
- **Module / Location:** Dashboard Konsol for Role Editor Knowledge Base (`admin_dashboard/src/pages/Dashboard.tsx:349-399`).
- **Reproduction Status:** Verified. Server-side permissions are properly enforced; UI display was unconstrained.
- **Actual Root Cause:**
  1. *Backend is Secure:* `/api/admin/sessions*` correctly enforces `require_role("Super Admin", "CS Agent")`. An Editor (Knowledge Base) cannot access sessions (returns 403 Forbidden).
  2. *Unfiltered Bento Card 4:* `Dashboard.tsx` unconditionally displayed Bento Card 4 ("Eskalasi Staf CS" with button "Buka Antrean Percakapan" -> `/conversations`). When an Editor KB clicked this button, the route guard blocked access.
- **Evidence:** `admin_dashboard/src/pages/Dashboard.tsx:349-399`, `routers/admin.py:214`.
- **Correction Plan:**
  - For role `Editor (Knowledge Base)`, conditionally display relevant Knowledge Base statistics (e.g. Unanswered topics needing documentation or KB sync status) instead of CS escalation queue.
  - Filter out CS queue shortcuts for Editor KB.

---

### P2 — Workflow and Usability

#### UX-004: Chat Widget Layout Percakapan dan Kolom Input Terlihat Kurang Rapi
- **Module / Location:** Customer Chat Widget (`frontend/src/App.tsx`, `frontend/src/components/ChatInput.tsx`, `frontend/src/components/ChatMessageList.tsx`).
- **Reproduction Status:** Observed in QA report Bukti 4 and reproduced in desktop viewport analysis.
- **Actual Root Cause:**
  1. *Excessive Fixed Height Constraint:* In `frontend/src/App.tsx:680`, desktop widget had `height: '580px'` and `width: '380px'`. When stacked with Header (60px), Quick Replies (up to 96px), Escalation Banner (48px), and Chat Input (80px), the message area was compressed to < 300px.
  2. *Input Area Squeezing:* `ChatInput.tsx` lacked a bounded minimum flex container, causing buttons and textarea to get cramped when safe-area insets or parent flex items expanded.
- **Evidence:** `frontend/src/App.tsx:679-685`, `frontend/src/components/ChatInput.tsx:56-124`.
- **Correction Plan:**
  - Increase desktop widget height to 640px and width to 400px (with responsive bounds `max-h-[calc(100vh-32px)]` and `max-w-[calc(100vw-32px)]`).
  - Constrain Quick Replies height and padding; ensure message list has `flex-1 min-h-0 overflow-y-auto`.
  - Fix composer with `shrink-0` so it is never compressed or overlapped.

---

#### UX-007: Knowledge Base: Tidak Ada Kepastian Status Upload Dokumen
- **Module / Location:** Admin Dashboard > Knowledge Base (`admin_dashboard/src/pages/KnowledgeBase.tsx:111-127, 513-549`).
- **Reproduction Status:** Reproduced via code review.
- **Actual Root Cause:**
  1. *Misplaced Notification:* `KnowledgeBase.tsx:115` stored upload status in `syncStatus`, which is only rendered inside the third card ("Sinkronisasi Otomatis AI"). The upload dropzone card itself showed no success message or confirmation.
  2. *Lack of Explicit Dropzone Feedback:* Once the upload finished, `isUploading` turned false and the dropzone immediately reverted to "Pilih Berkas" without indicating that the file was successfully saved.
- **Evidence:** `admin_dashboard/src/pages/KnowledgeBase.tsx:528-570`.
- **Correction Plan:**
  - Add explicit upload feedback state (`uploadFeedback: { type: 'success' | 'error', message: string, filename?: string } | null`) displayed directly inside the upload card.
  - Automatically refresh file list and display clear success/failure indicators.

---

#### UX-008: Analisis & Laporan: Layout Kartu Statistik Terlalu Sempit dan Berantakan
- **Module / Location:** Admin Dashboard > Analisis & Laporan (`admin_dashboard/src/pages/Analytics.tsx:18-44, 278-321`).
- **Reproduction Status:** Observed in QA report Bukti 9 and verified with 1366x768 viewport calculation.
- **Actual Root Cause:**
  1. *Rigid 5-Column Grid on Small Laptops:* `Analytics.tsx:279` used `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`. With a 256px sidebar on a 1366px screen, available width is ~1050px. 5 columns yield ~190px per card.
  2. *Internal Spacing Overcrowding:* With `p-5` (40px) + gap (14px) + icon box (44px), only ~90px remained for the text column, forcing labels like "Waktu Respon Rata-rata" to wrap across 3-4 lines.
- **Evidence:** `admin_dashboard/src/pages/Analytics.tsx:18-44, 279`.
- **Correction Plan:**
  - Modernize the responsive grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`.
  - Optimize `StatCard` internal spacing and typography so labels, values, and subtitles are clearly legible without extreme wrapping.

---

#### UX-010: Chat Widget dan Admin: Diperlukan Aksi End Session yang Sinkron
- **Module / Location:** Customer Chat Widget (`frontend/src/App.tsx`, `frontend/src/components/ChatHeader.tsx`), Admin Dashboard (`admin_dashboard/src/pages/Conversations.tsx`), Backend (`routers/chat.py`, `routers/admin.py`).
- **Reproduction Status:** Reproduced via code review.
- **Actual Root Cause:**
  1. *No End Session Action:* There was no endpoint or UI button to explicitly terminate an active conversation session while preserving its history.
  2. *Admin Only Had Hard Delete:* In `Conversations.tsx`, the only closing action was "Hapus Sesi", which permanently destroyed the session record and messages.
  3. *Unsynchronized Lifecycle:* When a conversation reached conclusion, neither party could mark it closed, leaving sessions indefinitely in active state.
- **Evidence:** `routers/chat.py`, `admin_dashboard/src/pages/Conversations.tsx:822-850`.
- **Correction Plan:**
  - Add backend endpoint `/api/chat/sessions/{session_id}/end` (and `/api/admin/sessions/{session_id}/end`) that sets `is_archived = True`, `is_human_handoff = False`, appends a system event message, and broadcasts `session_ended` via WebSocket/SSE.
  - Add "Akhiri Sesi" button with confirmation modal on both customer widget and admin conversation toolbar.
  - When session is ended, preserve history, display "Sesi Telah Diakhiri", and prevent new messages without starting a new session.

---

#### UX-012: Logout: Modal Konfirmasi Keluar Sangat Sempit dan Merusak Layout
- **Module / Location:** Sidebar / Keluar (`admin_dashboard/src/components/Sidebar.tsx:210-243`).
- **Reproduction Status:** Observed in QA report Bukti 15 and reproduced in code.
- **Actual Root Cause:**
  1. *Modal Trapped Inside Aside Container:* The modal JSX `{showLogoutConfirm && <div className="fixed inset-0 ...">...</div>}` was rendered directly inside the `<aside>` element in `Sidebar.tsx`.
  2. *CSS Containing Block Confinement:* Because `<aside>` has fixed width (74px or 256px), fixed positioning, and transition properties, child elements with `fixed inset-0` are confined within the bounds of `<aside>` in certain browsers/stacking contexts, crushing the modal to the width of the sidebar.
- **Evidence:** `admin_dashboard/src/components/Sidebar.tsx:210-243`.
- **Correction Plan:**
  - Move the modal out of `<aside>` or mount it via React Portal (`createPortal(modal, document.body)`) so it is attached directly to document body.
  - Ensure centered positioning (`fixed inset-0 z-50 flex items-center justify-center p-4`) with proportional `max-w-md w-full`.

---

### P3 — Interface Consistency and Simplification

#### UX-001: Dashboard: Tombol Tambah Dokumen dan Refresh Diminta Dihapus
- **Module / Location:** Dashboard Konsol (`admin_dashboard/src/pages/Dashboard.tsx:199-218`).
- **Actual Root Cause:** The top-right toolbar in `Dashboard.tsx` included a manual `RefreshCw` button and a primary `+ Tambah Dokumen` button (`navigate('/kb')`). Document management is centrally located in Knowledge Base, and data auto-refreshes or refreshes via time filters.
- **Correction Plan:** Remove the redundant "Tambah Dokumen" and "Refresh" buttons from `Dashboard.tsx` header as requested, leaving time range and timezone filters clean.

#### UX-002: Navigasi: Kontrol Sidebar Terlihat Tidak Konsisten / Berpotensi Duplikat
- **Module / Location:** Navbar dan Sidebar (`admin_dashboard/src/components/Header.tsx:224-231`, `admin_dashboard/src/components/Sidebar.tsx:101-108`).
- **Actual Root Cause:** On desktop screens (`lg`), both the Header Hamburger button and the Sidebar double-chevron button performed the exact same action: toggling `sidebarCollapsed`. Having both controls side by side created visual redundancy.
- **Correction Plan:** Make the Header Hamburger visible only on mobile (`lg:hidden`) for opening the mobile navigation drawer. On desktop, keep the dedicated sidebar chevron as the sole collapse/expand control.

#### UX-003: Chat Widget: Quick Suggestions Dinilai Tidak Relevan / Kurang Tepat
- **Module / Location:** Chat Widget (`core/config.py`, `data/settings.json`).
- **Actual Root Cause:** Default quick replies included "Berapa harga paket Pro?", which does not exist in LEXA's official Knowledge Base (all solutions are custom scoped).
- **Correction Plan:** Update quick suggestions to align 100% with Knowledge Base:
  1. "Layanan apa saja yang tersedia di LEXA?"
  2. "Bagaimana cara berkonsultasi proyek software?"
  3. "Bagaimana cara menghubungi tim LEXA?"
  4. "Apa saja keunggulan LEXA Software House?"

#### UX-005: Percakapan: Tombol CSV pada Detail Sesi Diminta Dihapus
- **Module / Location:** Admin Dashboard > Percakapan (`admin_dashboard/src/pages/Conversations.tsx:801-820`).
- **Actual Root Cause:** Individual session detail header contained a separate CSV export button (`<Download /> CSV`) alongside "Kembalikan ke AI" and "Hapus Sesi".
- **Correction Plan:** Remove the single-session CSV export button from the session detail toolbar as requested, while keeping bulk "Export Semua CSV" in the conversation list intact.

#### UX-006: Knowledge Base: Dua Tombol Pembuatan Dokumen dengan Fungsi Serupa
- **Module / Location:** Admin Dashboard > Knowledge Base (`admin_dashboard/src/pages/KnowledgeBase.tsx:494-510`).
- **Actual Root Cause:** The page header had "Buat Dokumen Baru" (`setIsCreateOpen(true)`), while the "Pengetahuan Instan" sidebar card also had "+ Buat Dokumen Teks Baru" (`setIsCreateOpen(true)`). Both opened the identical document creation modal.
- **Correction Plan:** Retain "Buat Dokumen Baru" in the header as the primary action and remove the duplicate "+ Buat Dokumen Teks Baru" button from the "Pengetahuan Instan" card.

#### UX-009: Analisis & Laporan: Indikator Filter Periode Aktif Tidak Jelas
- **Module / Location:** Admin Dashboard > Analisis & Laporan (`admin_dashboard/src/pages/Analytics.tsx:174-188`).
- **Actual Root Cause:** Active period button used `bg-white dark:bg-slate-800 text-slate-900 dark:text-white` on a `bg-slate-100` pill background, providing weak contrast compared to the vivid blue timezone selector next to it.
- **Correction Plan:** Style the active period filter with `bg-[#0066FF] text-white shadow-xs font-bold ring-1 ring-blue-500/20` matching the active timezone button.

#### UX-011: Ganti Password: Tambahkan Show/Hide pada Tiga Kolom Password
- **Module / Location:** Pengaturan Akun > Ganti Password Saya (`admin_dashboard/src/components/Header.tsx:631-670`).
- **Actual Root Cause:** The three password inputs ("Password Saat Ini", "Password Baru", "Konfirmasi Password Baru") had `type="password"` hardcoded without visibility toggle buttons.
- **Correction Plan:** Add independent toggle states (`showOldPassword`, `showNewPassword`, `showConfirmPassword`) with accessible `Eye` and `EyeOff` buttons, accessible aria labels, masked by default, without altering field values.

---

## 3. Risks & Unresolved Questions
- **Session Revocation Strategy:** Ensuring backward compatibility for existing users while adding `token_version` to `AdminUser`. A database column migration with default value `1` will be applied via `init_database()`.
- **End Session Protocol:** Ensuring backward compatibility for WebSocket and SSE clients when `session_ended` event is received.
