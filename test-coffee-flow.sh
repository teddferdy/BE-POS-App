#!/bin/bash
# Test flow: ingredient category → ingredient → PO → product category → BOM → product
BASE="http://localhost:5001"

# Login
echo "=== LOGIN ==="
LOGIN=$(curl -s $BASE/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"userName":"superadmin@posapp.com","password":"superadmin123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."
AUTH="Authorization: Bearer $TOKEN"
COOKIE="store=1"

# 1. Create Ingredient Category
echo -e "\n=== 1. CREATE INGREDIENT CATEGORY ==="
CAT=$(curl -s $BASE/ingredient-category/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"name":"Bahan Kopi","status":"active"}')
echo "$CAT" | grep -o '"id":[0-9]*' | head -1
CAT_ID=$(echo "$CAT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "Category ID: $CAT_ID"

# 2. Create Supplier
echo -e "\n=== 2. CREATE SUPPLIER ==="
SUPP=$(curl -s $BASE/supplier/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{"name":"PT Kopi Nusantara","phoneNumber":"02112345678","email":"info@kopinusantara.com","address":"Jakarta","status":"active"}')
echo "$SUPP" | grep -o '"id":[0-9]*' | head -1
SUPP_ID=$(echo "$SUPP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "Supplier ID: $SUPP_ID"

# 3. Create Ingredients
echo -e "\n=== 3. CREATE INGREDIENTS ==="
declare -A INGREDIENTS=(
  ["Kopi Bubuk"]='{"name":"Kopi Bubuk","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":5000,"unit":"gram","costPrice":500,"minStock":500}'
  ["Susu Cair"]='{"name":"Susu Cair","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":10000,"unit":"ml","costPrice":200,"minStock":1000}'
  ["Coklat Bubuk"]='{"name":"Coklat Bubuk","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":2000,"unit":"gram","costPrice":300,"minStock":200}'
  ["Sirup Coklat"]='{"name":"Sirup Coklat","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":1000,"unit":"ml","costPrice":250,"minStock":100}'
  ["Air Mineral"]='{"name":"Air Mineral","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":50000,"unit":"ml","costPrice":50,"minStock":5000}'
  ["Es Batu"]='{"name":"Es Batu","category":'$CAT_ID',"supplier":'$SUPP_ID',"stock":500,"unit":"butir","costPrice":100,"minStock":50}'
)

declare -A ING_IDS
for NAME in "${!INGREDIENTS[@]}"; do
  echo "  Creating: $NAME..."
  RESP=$(curl -s $BASE/ingredient/add -X POST \
    -H "$AUTH" -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d "${INGREDIENTS[$NAME]}")
  ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  ING_IDS[$NAME]=$ID
  echo "  -> ID: $ID"
done

echo -e "\nIngredient IDs:"
for NAME in "${!ING_IDS[@]}"; do
  echo "  $NAME: ${ING_IDS[$NAME]}"
done

# 4. Create Purchase Order
echo -e "\n=== 4. CREATE PURCHASE ORDER ==="
PO_RESP=$(curl -s $BASE/purchase-order/create -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "supplier": '$SUPP_ID',
    "orderDate": "2026-07-04",
    "notes": "PO awal bahan kopi",
    "items": [
      {"ingredient": '${ING_IDS["Kopi Bubuk"]}', "ingredientName": "Kopi Bubuk", "quantity": 10000, "unit": "gram", "price": 500},
      {"ingredient": '${ING_IDS["Susu Cair"]}', "ingredientName": "Susu Cair", "quantity": 20000, "unit": "ml", "price": 200},
      {"ingredient": '${ING_IDS["Coklat Bubuk"]}', "ingredientName": "Coklat Bubuk", "quantity": 5000, "unit": "gram", "price": 300}
    ]
  }')
echo "$PO_RESP" | head -3
PO_ID=$(echo "$PO_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "PO ID: $PO_ID"

# 5. Receive PO (set status to received)
echo -e "\n=== 5. RECEIVE PO ==="
RECV=$(curl -s $BASE/purchase-order/receive/$PO_ID -X PUT \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{}')
echo "$RECV" | head -3

# 6. Create Product Category "Kopi"
echo -e "\n=== 6. CREATE PRODUCT CATEGORY ==="
PCAT=$(curl -s $BASE/category/add-new-category -X POST \
  -H "$AUTH" -H "Cookie: $COOKIE" \
  -F 'name=Kopi' \
  -F 'description=Kategori minuman kopi' \
  -F 'status=active')
echo "$PCAT" | grep -o '"id":[0-9]*' | head -1
PCAT_ID=$(echo "$PCAT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "Product Category ID: $PCAT_ID"

# 7. Create Products
echo -e "\n=== 7. CREATE PRODUCTS ==="
declare -A PRODUCTS=(
  ["Espresso"]='{"nameProduct":"Espresso","category":'$PCAT_ID',"price":15000,"costPrice":2500,"unit":"porsi","tipeProduk":"menu","stock":100}'
  ["Cappuccino"]='{"nameProduct":"Cappuccino","category":'$PCAT_ID',"price":25000,"costPrice":4500,"unit":"porsi","tipeProduk":"menu","stock":100}'
  ["Latte"]='{"nameProduct":"Latte","category":'$PCAT_ID',"price":30000,"costPrice":4500,"unit":"porsi","tipeProduk":"menu","stock":100}'
  ["Mocha"]='{"nameProduct":"Mocha","category":'$PCAT_ID',"price":35000,"costPrice":5500,"unit":"porsi","tipeProduk":"menu","stock":100}'
  ["Cold Brew"]='{"nameProduct":"Cold Brew","category":'$PCAT_ID',"price":25000,"costPrice":3000,"unit":"porsi","tipeProduk":"menu","stock":100}'
)

declare -A PROD_IDS
for NAME in "${!PRODUCTS[@]}"; do
  echo "  Creating: $NAME..."
  RESP=$(curl -s $BASE/product/add-product -X POST \
    -H "$AUTH" -H "Cookie: $COOKIE" \
    -F "data=${PRODUCTS[$NAME]}")
  ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  PROD_IDS[$NAME]=$ID
  echo "  -> ID: $ID"
done

echo -e "\nProduct IDs:"
for NAME in "${!PROD_IDS[@]}"; do
  echo "  $NAME: ${PROD_IDS[$NAME]}"
done

# 8. Create BOMs
echo -e "\n=== 8. CREATE BOMS ==="
# Espresso: 20g Kopi Bubuk
echo "  BOM: Espresso..."
BOM1=$(curl -s $BASE/bom/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "productId": '${PROD_IDS["Espresso"]}',
    "name": "Resep Espresso",
    "notes": "20g kopi bubuk, ekstrak 25-30 detik",
    "lines": [
      {"ingredientId": '${ING_IDS["Kopi Bubuk"]}', "qty": 20, "unit": "gram"}
    ]
  }')
echo "$BOM1" | grep -o '"message":"[^"]*"'

# Cappuccino: 20g Kopi Bubuk + 150ml Susu Cair
echo "  BOM: Cappuccino..."
BOM2=$(curl -s $BASE/bom/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "productId": '${PROD_IDS["Cappuccino"]}',
    "name": "Resep Cappuccino",
    "notes": "20g kopi + 150ml susu, steam hingga berbusa",
    "lines": [
      {"ingredientId": '${ING_IDS["Kopi Bubuk"]}', "qty": 20, "unit": "gram"},
      {"ingredientId": '${ING_IDS["Susu Cair"]}', "qty": 150, "unit": "ml"}
    ]
  }')
echo "$BOM2" | grep -o '"message":"[^"]*"'

# Latte: 20g Kopi Bubuk + 200ml Susu Cair
echo "  BOM: Latte..."
BOM3=$(curl -s $BASE/bom/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "productId": '${PROD_IDS["Latte"]}',
    "name": "Resep Latte",
    "notes": "20g kopi + 200ml susu, microfoam",
    "lines": [
      {"ingredientId": '${ING_IDS["Kopi Bubuk"]}', "qty": 20, "unit": "gram"},
      {"ingredientId": '${ING_IDS["Susu Cair"]}', "qty": 200, "unit": "ml"}
    ]
  }')
echo "$BOM3" | grep -o '"message":"[^"]*"'

# Mocha: 20g Kopi Bubuk + 150ml Susu Cair + 15g Coklat Bubuk
echo "  BOM: Mocha..."
BOM4=$(curl -s $BASE/bom/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "productId": '${PROD_IDS["Mocha"]}',
    "name": "Resep Mocha",
    "notes": "20g kopi + 150ml susu + 15g coklat bubuk",
    "lines": [
      {"ingredientId": '${ING_IDS["Kopi Bubuk"]}', "qty": 20, "unit": "gram"},
      {"ingredientId": '${ING_IDS["Susu Cair"]}', "qty": 150, "unit": "ml"},
      {"ingredientId": '${ING_IDS["Coklat Bubuk"]}', "qty": 15, "unit": "gram"}
    ]
  }')
echo "$BOM4" | grep -o '"message":"[^"]*"'

# Cold Brew: 50g Kopi Bubuk + 500ml Air
echo "  BOM: Cold Brew..."
BOM5=$(curl -s $BASE/bom/add -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "productId": '${PROD_IDS["Cold Brew"]}',
    "name": "Resep Cold Brew",
    "notes": "50g kopi + 500ml air, diamkan 12-24 jam di kulkas",
    "lines": [
      {"ingredientId": '${ING_IDS["Kopi Bubuk"]}', "qty": 50, "unit": "gram"},
      {"ingredientId": '${ING_IDS["Air Mineral"]}', "qty": 500, "unit": "ml"}
    ]
  }')
echo "$BOM5" | grep -o '"message":"[^"]*"'

echo -e "\n=== DONE ==="
echo "Category ID: $CAT_ID"
echo "Supplier ID: $SUPP_ID"
for NAME in "${!ING_IDS[@]}"; do echo "  $NAME: ${ING_IDS[$NAME]}"; done
for NAME in "${!PROD_IDS[@]}"; do echo "  $NAME: ${PROD_IDS[$NAME]}"; done
