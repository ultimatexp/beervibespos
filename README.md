# POS GitHub Pages + LIFF + Google Sheets

โฟลเดอร์นี้เป็นตัวอย่าง `HTML + CSS + JS` สำหรับทำ POS แบบง่ายใน LINE ผ่าน LIFF และบันทึกข้อมูลลง Google Sheets ผ่าน Apps Script

## โครงไฟล์

- `index.html` หน้าขายสินค้า
- `stock.html` หน้าดูและจัดการสต๊อก
- `style.css` สไตล์กลาง
- `app.js` logic หน้าขาย
- `stock.js` logic หน้าสต๊อก
- `products.json` สินค้าตั้งต้น พร้อม `cost` ต้นทุนต่อหน่วย และ `image` รูปสินค้า
- `config.js` ค่า config ที่ต้องแก้ก่อน deploy
- `config.example.js` ตัวอย่าง config
- `apps-script.gs` โค้ดฝั่ง Google Apps Script

## การตั้งค่า local/static

1. เปิด `config.js`
2. ใส่ค่า `LIFF_ID` และ `APPS_SCRIPT_URL`

## Google Sheets

สร้างชีต 2 แท็บ:

### `sales`

คอลัมน์:

```text
sale_id | created_at | line_user_id | line_display_name | customer_name | payment_method | note | total_qty | total_amount | total_cost | gross_profit | items_json
```

ใน `items_json` แต่ละรายการจะมี `cost`, `lineTotal`, และ `lineCost`

### `stock_logs`

คอลัมน์:

```text
updated_at | sku | product_name | quantity | reason | line_user_id | line_display_name
```

## Deploy Apps Script

1. เปิด Google Sheets
2. `Extensions > Apps Script`
3. วางโค้ดจาก `apps-script.gs`
4. `Deploy > New deployment > Web app`
5. Execute as: `Me`
6. Who has access: `Anyone`
7. ก๊อป URL มาใส่ใน `config.js`

## Deploy GitHub Pages

1. สร้าง repo ใหม่ เช่น `line-pos-demo`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
3. เปิด `Settings > Pages`
4. Source = `Deploy from a branch`
5. เลือก branch `main` และ folder `/root`
6. รอจนได้ URL เช่น `https://yourname.github.io/line-pos-demo/`

## ตั้งค่า LIFF

1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง LIFF app หรือ LINE MINI App
3. ตั้ง Endpoint URL เป็น URL ของ GitHub Pages
4. ใช้ LIFF ID ใส่ใน `config.js`

## ข้อจำกัดปัจจุบัน

- `stock.html` จะบันทึก log สต๊อกลง Google Sheets แต่ยังไม่เขียนกลับไปแก้ `products.json` อัตโนมัติ เพราะ GitHub Pages เป็น static
- ถ้าต้องการให้สต๊อกคงเหลือสดจริง มี 2 ทาง:
  - ให้ Apps Script เป็นตัวส่งรายการสินค้ากลับมาจาก Google Sheets แทน `products.json`
  - หรือแก้ `products.json` ด้วยมือเมื่อมีการเปลี่ยนรายการสินค้า

## แนะนำ phase ถัดไป

1. ย้าย master สินค้าจาก `products.json` ไปอยู่ใน Google Sheets
2. เพิ่มหน้า history
3. เพิ่ม PIN ก่อนเข้าหน้าสต๊อก
