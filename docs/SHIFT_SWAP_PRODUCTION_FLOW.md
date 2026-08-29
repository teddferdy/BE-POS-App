# Production-Ready Shift Swap Workflow

Dokumen ini merinci desain alur kerja pertukaran shift (*Shift Swap*) yang dirancang untuk skala produksi, dengan fokus pada integritas data, *user experience*, dan *maintainability*.

## 1. High-Level Architecture
Sistem pertukaran shift mengadopsi pola *Event-Driven Approval* dengan **ACID Transaction** untuk menjamin data shift dan *payroll* karyawan tetap sinkron.

## 2. Lifecycle Pertukaran Shift

### A. Phase 1: Pengajuan (Request)
1.  **Validation Layer (API Middleware):**
    *   `POST /api/shift-swap/create`
    *   Validasi `requesterId` !== `targetId`.
    *   Validasi kedua karyawan dalam `store` yang sama.
    *   **Idempotency Check:** Cek apakah ada record `pending` aktif untuk `requesterId` + `targetId` pada rentang waktu yang sama.
2.  **Creation:** Simpan ke `shift_swap` dengan status `pending`.

### B. Phase 2: Notifikasi & Review
1.  **Notification:** *Trigger* notifikasi (WhatsApp/In-App) ke `targetUser` bahwa ada permintaan tukar shift.

### C. Phase 3: Eksekusi (Approval & Atomicity)
*   **Controller:** `PUT /api/shift-swap/update-status/:id`
*   **Sequelize Transaction Management (Blueprint):**
    ```javascript
    exports.updateShiftSwapStatus = async (req, res, next) => {
      const t = await db.sequelize.transaction();
      try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Ambil data + Locking untuk mencegah race condition
        const swap = await ShiftSwap.findByPk(id, { 
          transaction: t, 
          lock: t.LOCK.UPDATE,
          include: [...USER_INCLUDE, ...SHIFT_INCLUDE] 
        });

        if (!swap || swap.status !== 'pending') {
          throw new Error('Permintaan tidak ditemukan atau sudah diputuskan');
        }

        if (status === 'approved') {
          // 2. Eksekusi perpindahan karyawan (Panggil logic syncShiftKaryawan)
          await syncShiftKaryawan({ ... });
          await clearRemovedMembers({ ... });
        }

        // 3. Update Status
        await swap.update({ status, decidedBy: req.user.id, decidedAt: new Date() }, { transaction: t });

        // 4. Audit
        await createAudit(req, 'update', 'shift_swap', swap.id, `Status: ${status}`);

        await t.commit();
        
        // 5. Notifikasi (Setelah commit)
        await createNotification(swap.requester_id, status);

        res.json({ success: true, message: 'Berhasil' });
      } catch (error) {
        await t.rollback();
        next(error);
      }
    }
    ```

## 3. Checklist Implementasi
*   [ ] **Validation:** Validasi toko sama, duplikasi, dan role admin.
*   [ ] **Transactions:** Implementasi `sequelize.transaction`.
*   [ ] **Locking:** Implementasi `lock: t.LOCK.UPDATE` pada `findByPk`.
*   [ ] **Audit:** Panggilan `createAudit` di dalam transaksi.
*   [ ] **Notifications:** Panggilan notifikasi (WhatsApp/In-app) setelah `commit`.

## 4. Penanganan Error & Edge Cases
| Skenario | Penanganan |
| :--- | :--- |
| **Karyawan berhenti** | `Cron Job` untuk membatalkan semua `pending swap`. |
| **Shift tidak ditemukan** | *Return 404* dengan *log* tingkat *error*. |
| **Database Lock Timeout** | Gunakan `retry` logic dengan *exponential backoff*. |
| **Admin ganda klik** | *Database level lock* pada record `shift_swap`. |

## 5. Struktur Data (Optimized)
*   `shift_swap`: `status_history` (JSONB), `expires_at` (TIMESTAMP).
*   `audit_logs`: `actor_id`, `action`, `old_values`, `new_values`.
*   `notifications`: `user_id`, `type`, `status`, `provider`.

## 6. Monitoring & Observability
*   **Audit Logging:** Wajib mencatat `actor`, `timestamp`, `action`, `oldState`, `newState`.
*   **Alerting:** *Alert* ke Admin jika ada permintaan `pending` lebih dari 48 jam.
