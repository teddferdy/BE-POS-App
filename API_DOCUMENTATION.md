## 2. STOCK TRANSFER

### Create Stock Transfer
POST /pos/transfer

Request Body:
{
  "fromStore": 1,
  "toStore": 2,
  "notes": "Transfer between stores",
  "transferredBy": "John Doe",
  "items": [
    {
      "productId": 1,
      "qty": 10,
      "unit": "pcs",
      "notes": "Transfer item"
    }
  ]
}

Response:
{
  "success": true,
  "message": "Stock transfer created",
  "data": {
    "id": 1,
    "transferNumber": "TRF-1717234567890",
    "fromStore": 1,
    "toStore": 2,
    "status": "pending",
    "notes": "Transfer between stores",
    "items": [...]
  }
}

### Get Transfer History
GET /pos/transfer-history?page=1&limit=20&status=pending&startDate=2026-06-01&endDate=2026-06-30

Response:
{
  "success": true,
  "message": "Success",
  "data": [...],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}

---