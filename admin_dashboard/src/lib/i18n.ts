import { useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export const translations = {
  id: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_conversations: 'Percakapan',
    nav_kb: 'Knowledge Base',
    nav_analytics: 'Analisis',
    nav_users: 'Pengguna & Peran',
    nav_widget: 'Widget Setup',
    nav_settings: 'Pengaturan',
    nav_logout: 'Keluar',

    // Header
    search_placeholder: 'Cari halaman atau fitur... (⌘K)',
    search_title: 'Pencarian Cepat',
    notifications: 'Notifikasi',
    mark_all_read: 'Tandai dibaca',
    clear_all: 'Bersihkan',
    no_notifications: 'Tidak ada notifikasi baru',
    change_password: 'Ganti Password',
    switch_account: 'Ganti Akun',
    logout_confirm_title: 'Konfirmasi Keluar',
    logout_confirm_desc: 'Apakah Anda yakin ingin keluar dari Admin Console LEXA?',
    cancel: 'Batal',
    yes_logout: 'Ya, Keluar',

    // Dashboard
    dashboard_title: 'Dashboard Konsol',
    welcome_back: 'Selamat datang kembali',
    dashboard_subtitle: 'Pantau performa asisten virtual, interaksi pelanggan, dan dokumen Knowledge Base secara real-time.',
    ingest_document: 'Tambah Dokumen',
    total_conversations: 'Total Percakapan',
    total_conversations_desc: 'Volume interaksi chat pelanggan',
    ai_resolution_rate: 'Akurasi & Resolusi AI',
    optimal_response: 'Respon akurat dari KB',
    avg_latency: 'Rata-rata respon',
    kb_documents: 'Dokumen Knowledge Base',
    indexed_documents: 'Dokumen terindeks aktif',
    manage_kb: 'Kelola Dokumen',
    action_queue: 'Antrean Butuh Review',
    pending_cs_review: 'Sesi butuh staf CS',
    zero_escalations: 'Semua tertangani',
    view_conversations: 'Buka Antrean Percakapan',
    conversation_trends: 'Tren Volume Percakapan',
    conversation_trends_desc: 'Grafik traffic obrolan masuk per hari',
    peak: 'Puncak',
    system_activity: 'Aktivitas Sistem Terkini',
    system_activity_desc: 'Log operasional bot dan eskalasi CS terbaru',

    // Analytics
    analytics_title: 'Analisis & Laporan',
    analytics_subtitle: 'Evaluasi akurasi jawaban AI, volume obrolan, dan pertanyaan yang belum terjawab.',
    metrics_guide: 'Definisi & Panduan',
    resolved_system_title: 'Sistem Pertanyaan Terjawab (Otomatis)',
    resolved_system_desc: 'Pertanyaan pengunjung yang berhasil dijawab langsung oleh AI secara akurat dari dokumen Knowledge Base tanpa memerlukan bantuan staf manusia.',
    unresolved_system_title: 'Sistem Pertanyaan Belum Terjawab (Perlu Ditindaklanjuti)',
    unresolved_system_desc: 'Pertanyaan di mana AI belum menemukan referensi dokumen di Knowledge Base, atau pengunjung meminta eskalasi ke staf Customer Service manusia.',
    unresolved_action_hint: 'Tambahkan dokumen referensi untuk pertanyaan ini agar AI dapat menjawabnya secara otomatis di masa mendatang.',
    add_to_kb: 'Tambahkan ke Knowledge Base',
    unresolved_table_title: 'Daftar Pertanyaan Belum Terjawab (Perlu Dokumen Baru)',
    col_query: 'Pertanyaan Pengunjung',
    col_frequency: 'Frekuensi',
    col_status: 'Status',
    col_action: 'Tindakan',
    status_needs_doc: 'Belum Ada di KB',
    status_escalated: 'Eskalasi ke CS',
    response_time: 'Waktu Respon Rata-rata',
    active_users: 'Pengguna Aktif (30 Menit)',

    // Widget Setup
    widget_setup_title: 'Widget Setup & Integrasi',
    widget_setup_subtitle: 'Pasang chatbot AI LEXA di website Anda dalam hitungan menit untuk melayani pengunjung 24/7.',
    how_it_works_title: 'Cara Kerja Widget',
    how_it_works_desc: 'Widget obrolan cerdas ini dapat disematkan ke platform website apa pun (HTML, WordPress, React/Next.js, Shopify, Webflow) hanya dengan menyalin satu baris kode script.',
    step_1: '1. Kustomisasi',
    step_1_desc: 'Pilih warna brand, mode tampilan (Dark/Light), dan posisi widget sesuai selera.',
    step_2: '2. Salin Kode',
    step_2_desc: 'Salin script tag yang sudah terkonfigurasi secara otomatis di bawah.',
    step_3: '3. Tempel di Website',
    step_3_desc: 'Tempelkan kode sebelum tag penutup </body> di template website Anda. Selesai!',
    live_preview: 'Pratinjau Widget',
    preview_desc: 'Simulasi tampilan widget di website Anda saat ini.',
    tab_html: 'HTML / Website Standar',
    tab_wordpress: 'WordPress',
    tab_react: 'React / Next.js',
    tab_iframe: 'Iframe (Alternatif)',
    btn_copy: 'Salin Kode',
    btn_copied: 'Tersalin!',
    try_live_widget: 'Uji Coba Langsung di Widget Tester',
    config_widget: 'Konfigurasi Tampilan',
    pos_bottom_right: 'Kanan Bawah',
    pos_bottom_left: 'Kiri Bawah',
    theme_dark: 'Dark Mode',
    theme_light: 'Light Mode',
    theme_auto: 'Auto (Ikuti Tema OS)',
    accent_color: 'Warna Aksen',
  },
  en: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_conversations: 'Conversations',
    nav_kb: 'Knowledge Base',
    nav_analytics: 'Analytics',
    nav_users: 'Users & Roles',
    nav_widget: 'Widget Setup',
    nav_settings: 'Settings',
    nav_logout: 'Logout',

    // Header
    search_placeholder: 'Search pages or features... (⌘K)',
    search_title: 'Quick Search',
    notifications: 'Notifications',
    mark_all_read: 'Mark all read',
    clear_all: 'Clear all',
    no_notifications: 'No new notifications',
    change_password: 'Change Password',
    switch_account: 'Switch Account',
    logout_confirm_title: 'Confirm Logout',
    logout_confirm_desc: 'Are you sure you want to log out of LEXA Admin Console?',
    cancel: 'Cancel',
    yes_logout: 'Yes, Logout',

    // Dashboard
    dashboard_title: 'Console Dashboard',
    welcome_back: 'Welcome back',
    dashboard_subtitle: 'Monitor virtual assistant performance, client interactions, and Knowledge Base coverage in real time.',
    ingest_document: 'Add Document',
    total_conversations: 'Total Conversations',
    total_conversations_desc: 'Total customer chat inquiries processed',
    ai_resolution_rate: 'AI Accuracy & Resolution',
    optimal_response: 'Accurate responses from KB',
    avg_latency: 'Average response latency',
    kb_documents: 'Knowledge Base Docs',
    indexed_documents: 'Active indexed documents',
    manage_kb: 'Manage Documents',
    action_queue: 'Requires Review Queue',
    pending_cs_review: 'Sessions flagged for CS review',
    zero_escalations: 'Zero escalations pending',
    view_conversations: 'Open Conversations Desk',
    conversation_trends: 'Conversation Volume Trends',
    conversation_trends_desc: 'Daily inbound customer chat inquiry traffic',
    peak: 'Peak',
    system_activity: 'Recent System Activity',
    system_activity_desc: 'Latest bot operations and human CS escalation events',

    // Analytics
    analytics_title: 'Analytics & Reports',
    analytics_subtitle: 'Evaluate AI answer accuracy, interaction volumes, and unresolved queries.',
    metrics_guide: 'Definitions & Guide',
    resolved_system_title: 'Resolved Queries System (Automated)',
    resolved_system_desc: 'Customer questions successfully answered directly by AI from Knowledge Base documents with high factual precision.',
    unresolved_system_title: 'Unresolved Queries System (Action Needed)',
    unresolved_system_desc: 'Questions where AI lacked reference documents in the Knowledge Base, or where the customer requested transfer to a human CS agent.',
    unresolved_action_hint: 'Add reference documents for these questions so AI can answer them automatically in the future.',
    add_to_kb: 'Add to Knowledge Base',
    unresolved_table_title: 'Unresolved Questions List (Action Required)',
    col_query: 'User Inquiry',
    col_frequency: 'Frequency',
    col_status: 'Status',
    col_action: 'Action',
    status_needs_doc: 'Missing from KB',
    status_escalated: 'Escalated to CS',
    response_time: 'Average Response Time',
    active_users: 'Active Users (30 Min)',

    // Widget Setup
    widget_setup_title: 'Widget Setup & Integration',
    widget_setup_subtitle: 'Deploy LEXA AI chatbot onto your website in minutes to assist visitors 24/7.',
    how_it_works_title: 'How It Works',
    how_it_works_desc: 'This smart chat widget embeds into any website (HTML, WordPress, React/Next.js, Shopify, Webflow) by adding a single line of script.',
    step_1: '1. Customize',
    step_1_desc: 'Choose your brand color, theme mode (Dark/Light), and widget position.',
    step_2: '2. Copy Code',
    step_2_desc: 'Copy the auto-generated script tag below.',
    step_3: '3. Paste on Website',
    step_3_desc: 'Paste the snippet right before the closing </body> tag in your website template. Done!',
    live_preview: 'Widget Preview',
    preview_desc: 'Live interactive simulation of your configured chat widget.',
    tab_html: 'HTML / Standard Website',
    tab_wordpress: 'WordPress',
    tab_react: 'React / Next.js',
    tab_iframe: 'Iframe (Fallback)',
    btn_copy: 'Copy Code',
    btn_copied: 'Copied!',
    try_live_widget: 'Launch Live Widget Tester',
    config_widget: 'Appearance Settings',
    pos_bottom_right: 'Bottom Right',
    pos_bottom_left: 'Bottom Left',
    theme_dark: 'Dark Mode',
    theme_light: 'Light Mode',
    theme_auto: 'Auto (System)',
    accent_color: 'Accent Color',
  },
};

export const useLanguage = () => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('lexa_lang') as Language) || 'id';
  });

  const toggleLanguage = () => {
    const nextLang: Language = lang === 'id' ? 'en' : 'id';
    setLang(nextLang);
    localStorage.setItem('lexa_lang', nextLang);
    window.dispatchEvent(new CustomEvent('lexa-lang-change', { detail: nextLang }));
  };

  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail && (e.detail === 'id' || e.detail === 'en')) {
        setLang(e.detail);
      }
    };
    window.addEventListener('lexa-lang-change', handleLangChange);
    return () => window.removeEventListener('lexa-lang-change', handleLangChange);
  }, []);

  const t = translations[lang];

  return { lang, toggleLanguage, setLang, t };
};
