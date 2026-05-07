# Blueprint: Your Profile & Landing Page System
**Project**: Smart Parking AI Dashboard
**Status**: Planning Phase (v1.0)

## 1. Overview
Dokumen ini merangkum rencana pengembangan sistem profil pengguna, manajemen akses, dan landing page publik untuk reservasi slot parkir. Fokus utama adalah pada fleksibilitas peran (Admin, Operator, Viewer) dan pengalaman pengguna (UI/UX) yang premium.

---

## 2. Arsitektur Peran (Role-Based Access Control)

| Role | Akses Dashboard | Akses Fitur Khusus | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Admin** | Full Access (All Pages & All Access) | User Management, Security | Pemilik sistem dengan kontrol penuh atas pengguna lain. |
| **Operator** | Parking Map, Live Camera, Analytics | Manual Slot Override | Petugas lapangan yang mengelola operasional dan memantau trafik. |
| **Viewer** | Public Page | Reservation (Login Required) | Pengguna publik yang ingin melihat ketersediaan slot & reservasi. |

---

## 3. Fitur "Your Profile" Dashboard

### A. Konsep UI/UX: Sidebar Switch
Saat pengguna masuk ke menu Profil, Sidebar utama (Dashboard) akan non-aktif dan digantikan oleh **Sidebar Profil** khusus untuk navigasi pengaturan.
*   **Menu Sidebar Profil**:
    1.  Account Info
    2.  User Management (Admin Only)
    3.  Security & 2FA
    4.  Personalization (Language & Preferences)
    5.  Session Info

### B. Detail Modul Profil
1.  **Account Info**: 
    *   Data: Nama Lengkap, Jabatan (Job Title), Nomor Telepon.
    *   Database: Tabel `users` (PostgreSQL).
2.  **User Management**:
    *   Fungsi: Add/Edit/Delete user lain.
    *   Penugasan Zona: Menentukan zona mana yang dikelola oleh Operator tertentu.
3.  **Security**:
    *   Fitur: Change Password, Toggle Two-Factor Authentication (2FA) dengan QR Code.
    *   Enkripsi: Bcrypt untuk password, Secret key terenkripsi untuk 2FA.
4.  **Personalization**:
    *   Multi-Bahasa: Menggunakan library `react-i18next` (ID/EN).
    *   Notification Settings: Pengaturan email alert untuk pelanggaran kritikal.
5.  **Session Info**:
    *   Data: IP Address, User Agent (Device Detection), Last Login Time.
    *   Tujuan: Monitoring keamanan akun.

---

## 4. Viewer Landing Page & Reservation Flow

### A. Landing Page Publik
Halaman utama yang bisa diakses tanpa login untuk menarik pengguna publik.
*   **Hero Section**: Informasi umum Smart Parking.
*   **Live Availability**: Visualisasi slot yang tersedia secara real-time.
*   **Reserve Now**: Tombol pemicu alur reservasi.

### B. Alur Reservasi (Wajib Login)
1.  User klik **Reserve Now**.
2.  Sistem cek status autentikasi.
    *   **Belum Login**: Redirect ke halaman Login/Register (khusus Viewer).
    *   **Sudah Login**: Membuka form reservasi.
3.  Input Data: Durasi parkir & Nomor Plat Kendaraan (untuk validasi LPR AI).
4.  Confirmation: Slot ditandai sebagai "Reserved" di Parking Map Admin.

---

## 5. Implementasi Teknis

### Backend (Node.js & PostgreSQL)
*   **Tabel `users`**: Penambahan kolom `role`, `job_title`, `phone_number`, `assigned_zones`, `2fa_enabled`.
*   **Tabel `reservations`**: `id`, `user_id`, `slot_id`, `start_time`, `end_time`, `status`, `license_plate`.
*   **Tabel `login_logs`**: Untuk mencatat history session.

### Frontend (React & Tailwind CSS)
*   **Layout Switching**: Mekanisme kondisional untuk merender Sidebar yang berbeda berdasarkan route path (`/profile/*`).
*   **Internationalization**: Implementasi `i18next` dengan file JSON lokal.
*   **Security UI**: Modal khusus untuk penggantian password dan aktivasi 2FA.

### Frontend Folder Structure (Modular)
Untuk menjaga isolasi kode, frontend akan dibagi menjadi modul-modul berikut:
*   `src/layouts/`: Menangani perpindahan Sidebar (Dashboard vs Profile).
*   `src/modules/dashboard/`: Halaman operasional (Map, Analytics, Summary).
*   `src/modules/profile/`: Halaman pengaturan (Account, Security, User Management).
*   `src/modules/public/`: Halaman untuk Viewer (Landing Page, Reservation).

---

## 6. Rencana Tahapan Eksekusi
1.  **Phase 1**: Restrukturisasi folder & Pengembangan `ProfileLayout` (Sidebar Switcher).
2.  **Phase 2**: Migrasi Database dan API CRUD User/Profile.
3.  **Phase 3**: Implementasi Halaman Account Info & Security.
4.  **Phase 4**: Pembuatan User Management Dashboard (Admin).
5.  **Phase 5**: Pengembangan Landing Page & Sistem Reservasi Viewer.
6.  **Phase 6**: Integrasi Multi-Bahasa.

src/
├── layouts/                # Wrapper untuk menukar Sidebar/Navbar
│   ├── DashboardLayout.jsx # Layout dengan Sidebar Utama
│   ├── ProfileLayout.jsx   # Layout dengan Sidebar Profil
│   └── PublicLayout.jsx    # Layout untuk Landing Page (Tanpa Sidebar)
│
├── modules/                # Pemisahan logika berdasarkan fitur utama
│   ├── dashboard/          # Halaman Analytics, Map, Exec Summary
│   │   ├── pages/
│   │   └── components/
│   │
│   ├── profile/            # Semua halaman di dalam menu Profile
│   │   ├── pages/          # AccountInfo, Security, UserManagement
│   │   └── components/     # ProfileSidebar, UserTable, dsb.
│   │
│   └── public/             # Halaman untuk Viewer (Landing Page)
│       ├── pages/          # LandingPage, ReservationPage
│       └── components/     # PublicNavbar, SlotPreview
│
├── components/             # UI Components umum (Button, Modal, Input)
├── context/                # AuthContext, LanguageContext (i18n)
└── api/                    # Folder khusus untuk axios/fetch calls
