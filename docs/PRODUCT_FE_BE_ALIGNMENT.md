## Product FE → BE Field Analysis

### ❌ MISMATCH (perlu diperbaiki)

| FE | BE model | Issue | Fix |
|---|---|---|---|
| `status: true` (boolean) | `status: STRING(20)` default `'active'` | Type beda, query `WHERE status = 'active'` bakal skip product baru | **BE**: normalize `true/false` → `'active'/'inactive'`<br>**FE**: kirim `'active'/'inactive'` string |
| `category: ""` (string kosong) | `category: INTEGER NOT NULL` | Insert akan gagal / FK error | **BE**: coerce ke `null` jika kosong<br>**FE**: kirim `null` atau ID valid |
| `supplier: ""` (string kosong) | `supplier: INTEGER` | Sama, insert akan gagal | **BE**: coerce ke `null`<br>**FE**: kirim `null` atau ID valid |
| `tax: ""` (string kosong) | `tax: JSONB` | Insert error | **BE**: coerce ke `null`<br>**FE**: kirim `null` atau object `{}` |
| `priceTemplate: ""` | (tidak ada di model) | Di-drop silently — tidak masalah tapi misleading | **FE**: hapus field (tidak dipakai BE) |
| `productType: "simple"` | (tidak ada di model) | Di-drop silently | **FE**: hapus field (tidak dipakai BE) |

### ✓ ALIGNED (tidak perlu diubah)

| FE | BE | Status |
|---|---|---|
| `nameProduct` | `nameProduct` | ✓ |
| `isAvailable: true` | `isAvailable: BOOLEAN` | ✓ |
| `image` (file) | `image` (multer field) | ✓ |
| `sku`, `barcode`, `brand`, `description`, `price`, `costPrice`, `stock`, `minStock`, `unit`, `preparationTime`, `point` | semua ada di model | ✓ |

## Rekomendasi Perubahan

### BE (product controller) — defensive normalization:
```js
// Di postAddProduct, sebelum Product.create:
const normalizedStatus = typeof status === 'boolean'
  ? (status ? 'active' : 'inactive')
  : (status || 'active')

const normalizedCategory = category === '' || category == null ? null : Number(category)
const normalizedSupplier = supplier === '' || supplier == null ? null : Number(supplier)
const normalizedTax = tax === '' || tax == null ? null : tax
```

### FE (yang perlu di-update):
```js
// Kirim string bukan boolean
status: formData.status ? 'active' : 'inactive',  // bukan true/false

// Kirim null bukan empty string
category: formData.category || null,
supplier: formData.supplier || null,
tax: formData.tax || null,

// Hapus field yang tidak dipakai
// priceTemplate: ""   ← hapus
// productType: "simple"  ← hapus
```
