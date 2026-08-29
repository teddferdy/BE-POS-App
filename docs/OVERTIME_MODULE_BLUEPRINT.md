# Modul Overtime (Lembur) - Blueprint Teknis

Dokumen ini mendefinisikan arsitektur dan alur kerja fitur Overtime yang terintegrasi secara *natively* ke dalam modul Shift dan sistem Akuntansi aplikasi POS.

## 1. Tujuan
*   Mengotomatisasi pengajuan dan persetujuan lembur.
*   Memastikan integrasi *real-time* dengan jadwal shift.
*   Mengotomatisasi perhitungan beban gaji (lembur) ke jurnal akuntansi.

## 2. Struktur Data (Schema)

### Tabel: `overtime`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | `INTEGER` | PK |
| `shift_id` | `INTEGER` | FK ke `shift` (Konteks lembur). |
| `employee_id` | `INTEGER` | FK ke `users`. |
| `date` | `DATEONLY` | Tanggal lembur. |
| `start_time` | `TIME` | Waktu mulai. |
| `end_time` | `TIME` | Waktu selesai. |
| `duration_hours`| `DECIMAL` | `(end_time - start_time)`. |
| `status` | `STRING` | `pending`, `approved`, `rejected`. |
| `status_history`| `JSONB` | Audit log perubahan status. |
| `accounting_status`| `STRING` | `unposted`, `posted` (Integrasi Akuntansi). |

## 3. Alur Kerja (Workflow)

### A. Phase 1: Pengajuan & Validasi
1.  **Frontend:** Karyawan mengajukan lembur melalui form (referensi ke `shift_id`).
2.  **Validation:** Sistem memvalidasi:
    *   Apakah `employee_id` terdaftar di `shift_id` tersebut?
    *   Cek bentrok jadwal (tugas/shift lain).

### B. Phase 2: Approval Flow
1.  **Manager/Admin:** Mengulas pengajuan.
2.  **Action:** *Approve/Reject* dengan catatan.

### C. Phase 3: Integrasi Akuntansi (Payroll Posting)
1.  **Closing Payroll:** Saat proses tutup buku bulanan:
    *   Sistem menghitung total `duration_hours` untuk setiap karyawan yang berstatus `approved`.
    *   Mengalikan total jam dengan *Rate Lembur* (dari `user` profile).
2.  **Journal Entry:** Sistem membuat entri jurnal otomatis:
    *   **Debit:** Akun Beban Gaji/Lembur.
    *   **Kredit:** Akun Hutang Gaji/Kas.
3.  **Flagging:** Update status `overtime` yang sudah diposting menjadi `posted` untuk mencegah double posting.

## 4. Aturan Bisnis
*   Lembur tidak boleh melebihi aturan *shift* yang sudah ada.
*   Setiap lembur harus terkait dengan satu `shift_id` valid.
*   Data yang sudah `posted` ke akuntansi tidak boleh diubah atau dihapus.

## 5. Audit & Observability
*   Setiap aksi (create, update, approve) wajib mencatat `audit_logs` (menggunakan helper `createAudit`).
*   Notifikasi WhatsApp/In-App wajib terkirim saat pengajuan dan saat status berubah.
