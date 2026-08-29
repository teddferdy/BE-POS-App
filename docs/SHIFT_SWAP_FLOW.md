# Dokumentasi Alur Pertukaran Shift (Shift Swap)

Dokumen ini menjelaskan alur kerja sistem pertukaran shift (*Shift Swap*) pada aplikasi POS untuk memastikan integritas data dan kemudahan operasional.

## 1. Ikhtisar Proses
Proses pertukaran shift melibatkan tiga pihak: Pemohon (*Requester*), Target (*Target*), dan Admin (sebagai pemberi keputusan).

## 2. Diagram Alur Kerja

### A. Pengajuan (Requester)
1.  **Validasi Awal:**
    *   Pemohon memilih shift yang ingin ditukar.
    *   Sistem memverifikasi bahwa Pemohon dan Target berada di **Toko yang sama**.
    *   Sistem mencegah duplikasi permintaan (tidak boleh ada permintaan `pending` untuk kombinasi karyawan yang sama).
2.  **Pembuatan Data:**
    *   Record dibuat di tabel `shift_swap` dengan status `pending`.

### B. Persetujuan (Admin/Super Admin)
1.  **Review:** Admin melihat daftar request di dashboard persetujuan.
2.  **Keputusan:** Admin menyetujui (`approved`) atau menolak (`rejected`).

### C. Eksekusi (Backend - Transaksi Database)
*Penting: Seluruh proses di bawah ini harus dibungkus dalam **Sequelize Transaction** untuk memastikan atomisitas.*

Jika **`approved`**:
1.  **Update Tabel `shift`:**
    *   Hapus `requesterId` dari `shift.karyawan` (JSONB) Pemohon.
    *   Hapus `targetId` dari `shift.karyawan` (JSONB) Target.
    *   Tambahkan `requesterId` ke `shift.karyawan` Target.
    *   Tambahkan `targetId` ke `shift.karyawan` Pemohon.
2.  **Update Tabel `user`:**
    *   Update `user.shift` untuk Pemohon ke shift baru.
    *   Update `user.shift` untuk Target ke shift baru.
3.  **Update Tabel `shift_swap`:**
    *   Set status menjadi `approved`.
    *   Catat `decidedBy` (Admin ID) dan `decidedAt`.
    *   Catat log audit.

## 3. Aturan Bisnis (Business Rules)
*   Pertukaran hanya berlaku untuk karyawan di **Toko yang sama**.
*   Status `pending` mencegah pengajuan pertukaran baru antara kedua orang yang sama.
*   Proses eksekusi harus bersifat *all-or-nothing* (atomik) menggunakan transaksi.

## 4. Keamanan & Audit
*   Setiap perubahan status wajib dicatat di tabel `auditLog` menggunakan fungsi `createAudit`.
*   Akses ke endpoint `update-swap-status` hanya dibatasi untuk role `super_admin` dan `admin`.
