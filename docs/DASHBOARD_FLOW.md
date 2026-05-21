# Dashboard Flow - POS Application

## Struktur Role

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **Super Admin** | Owner/Pemilik bisnis | Semua toko, pengaturan sistem |
| **Admin** | Manager toko | 1 toko tertentu |
| **User** | Staff/Karyawan | Kasir, waiter, dll |

---

## Akses Menu per Role

### SUPER ADMIN (Owner)

| Menu | Create | Read | Update | Delete | Download | Upload |
|------|--------|------|--------|--------|----------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Toko | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Karyawan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Produk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Kategori | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Pelanggan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Laporan Global | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pengaturan Sistem | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### ADMIN (Manager Toko)

| Menu | Create | Read | Update | Delete | Download | Upload |
|------|--------|------|--------|--------|----------|--------|
| Dashboard Toko | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Kelola Produk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kelola Kategori | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Kelola Karyawan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kelola Pelanggan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Laporan Toko | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Pengaturan Toko | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

### USER (Staff/Karyawan)

| Menu | Create | Read | Update | Delete | Download | Upload |
|------|--------|------|--------|--------|----------|--------|
| Dashboard | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| POS/Kasir | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Produk | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Riwayat Transaksi | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Flow Halaman (Page Flow)

```
LOGIN
  │
  ├── Super Admin
  │     │
  │     ├── Dashboard (Semua Toko)
  │     │     ├── Summary Semua Toko
  │     │     ├── Grafik Penjualan Global
  │     │     └── Quick Stats
  │     │
  │     ├── Kelola Toko
  │     │     ├── Daftar Toko
  │     │     ├── Tambah Toko
  │     │     ├── Edit Toko
  │     │     ├── Import/Export Excel
  │     │     └── Delete Toko
  │     │
  │     ├── Kelola Admin
  │     │     ├── Daftar Admin per Toko
  │     │     ├── Tambah Admin
  │     │     └── Edit Role Admin
  │     │
  │     ├── Kelola Karyawan
  │     │     ├── Daftar Semua Karyawan
  │     │     ├── Tambah Karyawan
  │     │     ├── Edit Akses Menu
  │     │     └── Reset Password
  │     │
  │     ├── Kelola Produk
  │     │     ├── Daftar Produk
  │     │     ├── Tambah Produk
  │     │     ├── Edit Produk
  │     │     ├── Import Excel
  │     │     └── Export Excel
  │     │
  │     ├── Kelola Kategori
  │     │     ├── Daftar Kategori
  │     │     ├── Tambah Kategori
  │     │     └── Edit Kategori
  │     │
  │     ├── Kelola Pelanggan (Member)
  │     │     ├── Daftar Member
  │     │     ├── Tambah Member
  │     │     └── Edit Points
  │     │
  │     ├── Tingkatan Pelanggan (Member-Tier)
  │     │     ├── List Member Tier
  │     │     ├── Tambah Member Tier
  │     │     └── Delete Member Tier 
  │     │
  │     ├── Laporan Global
  │     │     ├── Penjualan Semua Toko
  │     │     ├── Produk Terlaris Global
  │     │     └── Ekspor Laporan
  │     │
  │     └── Pengaturan Sistem
  │          ├── Pengaturan Toko
  │          │      ├── Invoice & Struk
  │          │      ├── Logo
  │          │      ├── Footer
  │          │      └── Social Media
  │          ├── Jam Buka/Tutup
  │          ├── Logo & Branding
  │          ├── Konfigurasi Global
  │          └── Kelola Role
  │
  ├── Admin Toko
  │     │
  │     ├── Dashboard Toko
  │     │     ├── Summary Toko Ini
  │     │     ├── Grafik Penjualan
  │     │     └── Produk Terlaris
  │     │
  │     ├── Kelola Produk
  │     │     ├── Daftar Produk
  │     │     ├── Tambah Produk
  │     │     ├── Import Excel
  │     │     └── Export Excel
  │     │
  │     ├── Kelola Kategori
  │     │     ├── Daftar Kategori
  │     │     └── Tambah/Edit Kategori
  │     │
  │     ├── Kelola Sub-Kategori
  │     │     ├── Daftar Sub-Kategori
  │     │     └── Tambah/Edit
  │     │
  │     ├── Kelola Meja
  │     │     ├── Daftar Meja
  │     │     ├── Tambah Meja
  │     │     └── Status Meja (Kosok/Terisi)
  │     │
  │     ├── Kelola Karyawan Toko
  │     │     ├── Daftar Karyawan Toko
  │     │     ├── Tambah Karyawan
  │     │     └── Atur Akses (bukan super admin)
  │     │
  │     ├── Kelola Pelanggan
  │     │     ├── Daftar Member
  │     │     ├── Tambah Member
  │     │     └── Kelola Tier/Level
  │     │
  │     ├── Kelola Diskon
  │     │     ├── Daftar Diskon
  │     │     ├── Tambah Diskon
  │     │     └── Edit Diskon
  │     │
  │     ├── Kelola Metode Pembayaran
  │     │     ├── Daftar Pembayaran
  │     │     └── Tambah/Edit
  │     │
  │     ├── Shift Management
  │     │     ├── Daftar Shift
  │     │     └── Tambah/Edit Shift
  │     │
  │     ├── Laporan Toko
  │     │     ├── Penjualan Harian
  │     │     ├── Laporan Menu/Produk
  │     │     ├── Best Selling
  │     │     └── Ekspor PDF/Excel
  │     │
  │     ├── Inventory (Stok)
  │     │     ├── Daftar Supplier
  │     │     ├── Purchase Order
  │     │     ├── Stock Opname
  │     │     └── History Stok
  │     │
  │     ├── Pengeluaran
  │     │     ├── Kategori Pengeluaran
  │     │     ├── Daftar Pengeluaran
  │     │     └── Approval Pengeluaran
  │     │
  │     └── Pengaturan Toko
  │           ├── Invoice & Struk
  │           │     ├── Logo
  │           │     ├── Footer
  │           │     └── Social Media
  │           ├── Jam Buka/Tutup
  │           └── Harga & Pajak & Service Charge
  │
  └── User (Staff)
        │
        ├── Dashboard (Read Only)
        │     └── View Saja
        │
        ├── POS (Kasir)
        │     ├── Pilih Meja (jika ada)
        │     ├── Browse Produk
        │     ├── Tambah ke Keranjang
        │     ├── Pilih Opsi/Modifier
        │     ├── Tambah Catatan
        │     ├── Diskon
        │     ├── Split Bill (opsional)
        │     ├── Pembayaran
        │     │     ├── Cash
        │     │     ├── QRIS
        │     │     ├── Debit/Kartu
        │     │     └── Lainnya
        │     ├── Cetak Struk
        │     └── Kirim ke Kitchen
        │
        ├── Produk (View Only)
        │     └── Browse Menu
        │
        └── Riwayat Transaksi
              └── Transaksi Saya Saja
```

---

## API Endpoints - Role Management

### Get All Roles
```
GET /api/role/get-role
```

### Get Users by Role
```
GET /api/role/get-users-by-role?roleType=super_admin
```

### Update User Role
```
PUT /api/role/update-user-role
Body: {
  "userId": 1,
  "roleId": 2,
  "accessMenu": [...] // optional
}
```

### Update Role Access Menu
```
PUT /api/role/update-access-menu
Body: {
  "roleId": 1,
  "accessMenu": [
    {"menu": "dashboard", "create": true, "read": true, "update": true, "delete": true}
  ]
}
```

---

## Catatan Penting

1. **Super Admin** hanya bisa dibuat 1 (initial setup manual di database)
2. **Admin** dibuat oleh Super Admin, assign ke toko tertentu
3. **User** register otomatis sebagai 'user', upgrade oleh Admin/Super Admin
4. **Access Menu** bisa di-override per user jika diperlukan
5. Semua endpoint menggunakan format response standard `{ success, message, data }`
6. Semua endpoint yang membutuhkan auth menggunakan header `Authorization: Bearer <token>`

---

## Screenshoot Flow

### Login Flow
1. User masuk ke halaman login
2. Masukkan email/username dan password
3. Sistem verifikasi credentials
4. Jika valid, redirect ke dashboard sesuai role

### Order Flow (Kasir)
1. Kasir pilih meja (jika restaurant mode)
2. Pilih produk dari menu
3. Jika produk punya opsi (size, topping), muncul modal
4. Tambah ke keranjang
5. Optional: apply diskon
6. Optional: split bill jika membayar bersama
7. Pilih metode pembayaran
8. Proses pembayaran
9. Cetak struk
10. Kirim order ke kitchen (jika food/beverage)

### Checkout Flow
1. Pembayaran berhasil
2. Update status meja (jika ada)
3. Update best selling
4. Buat record transaction
5. Kurangi stock (jika inventory aktif)
6. Update member points (jika member)

---

## Endpoint Categories

| Kategori | Prefix | Deskripsi |
|----------|--------|-----------|
| Auth | `/auth` | Login, register, profile |
| Role | `/role` | Role management |
| Location | `/location` | Store management |
| Product | `/product` | Product CRUD |
| Category | `/category` | Category CRUD |
| Sub-Category | `/sub-category` | Sub-category CRUD |
| Table | `/table` | Table management |
| Order | `/order` | Order management |
| Checkout | `/checkout` | Transaction processing |
| Discount | `/discount` | Discount management |
| Type Payment | `/type-payment` | Payment methods |
| Member | `/member` | Customer/Member |
| Member Tier | `/member-tier` | Loyalty tiers |
| Shift | `/shift` | Shift management |
| Best Selling | `/best-selling` | Analytics |
| Report | `/report` | Reports |
| Supplier | `/supplier` | Supplier management |
| Purchase Order | `/purchase-order` | PO management |
| Ingredient | `/ingredient` | Inventory items |
| Stock History | `/stock-history` | Stock tracking |
| Stock Opname | `/stock-opname` | Stock opname |
| Expense Category | `/expense-category` | Expense categories |
| Expense | `/expense` | Expense management |
| Cash Register | `/cash-register` | Cash drawer |
| Invoice | `/invoice` | Invoice settings |
| Social Media | `/social-media` | Social media links |
| Position | `/position` | Employee positions |
| Overview | `/overview` | Dashboard data |
| Split Bill | `/split-bill` | Bill splitting |