# nodeCon - ZRA VSDC Middleware Application

## Overview

nodeCon is a comprehensive middleware application that serves as a secure bridge between various ERP systems and Zambia Revenue Authority's (ZRA) Virtual Smart Device Controller (VSDC) API. Built with Electron, Express.js, and SQLite, it provides data validation, transformation, storage, synchronization, and comprehensive logging capabilities.

## Architecture

### Core Modules

1. **API Gateway** - Receives and processes JSON/XML payloads
2. **SQLite Database Engine** - Local data storage and management
3. **Electron UI Application** - Modern desktop interface for monitoring and configuration
4. **Sync Engine** - Automated data synchronization with VSDC
5. **Logger** - Comprehensive event tracking and audit trails

## Installation & Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the application: `npm run electron`

## Application Modules

### 1. Dashboard
**Purpose:** System overview and health monitoring

**Features:**
- Real-time connection status (Database, VSDC, Internet)
- System metrics and performance indicators
- Document counts and recent activity
- System uptime and resource usage

### 2. Database Management
**Purpose:** SQLite database initialization and management

**Features:**
- Database creation and connection testing
- Table management and data viewing
- Data export capabilities
- Database reset and cleanup functions

### 3. Device Initialization
**Purpose:** Initialize connection with ZRA VSDC

**Required Fields:**
- TPIN (Tax Payer Identification Number)
- Branch ID (Business premises identifier)
- Device Serial Number

**Endpoint:** `/initializer/selectInitInfo`

### 4. Configuration Management
**Purpose:** System endpoints and routes configuration

**Configurable Endpoints:**
- `salesInvoice` - Sales transaction processing
- `purchaseInvoice` - Purchase transaction processing
- `items` - Item master data management
- `stock` - Stock movement tracking
- `stockMaster` - Stock master updates
- `imports` - Import declaration processing

### 5. Imports Management
**Purpose:** Import declaration processing and approval

**Features:**
- Automatic data fetching from VSDC
- Manual approval/rejection workflow
- Stock master integration
- Date range filtering and export

**VSDC Endpoint:** `/imports/selectImportItems`

### 6. Purchases Management
**Purpose:** Purchase invoice processing and approval

**Features:**
- Purchase data synchronization
- Invoice-level approval workflow
- Stock and stock master updates
- Comprehensive purchase tracking

**VSDC Endpoint:** `/trnsPurchase/selectTrnsPurchaseSales`

### 7. Processed Documents
**Purpose:** View and manage processed transactions

**Document Types:**
- Sales Invoices
- Purchase Invoices
- Items
- Stocks
- Imports

### 8. Sync Status & Payloads
**Purpose:** Monitor synchronization status

**Tracked Processes:**
- StandardCodes
- ItemClassCodes
- ZRANotices
- ImportsData
- PurchasesData

### 9. System Logs
**Purpose:** Comprehensive activity logging

**Log Types:**
- Database operations
- API transactions
- Synchronization events
- Error tracking
- User actions

## API Endpoints

### Incoming Data Endpoints (Port 3000)

#### Sales Invoice Processing
```
POST /sales-invoice
Content-Type: application/json

Payload:
{
  "securityKey": "your_security_key",
  "invoiceData": {
    "tpin": "1000000000",
    "bhfId": "000",
    "custTpin": "2000000000",
    "custNm": "Customer Name",
    "salesTyCd": "N",
    "rcptTyCd": "S",
    "pmtTyCd": "01",
    "salesSttsCd": "02",
    "cfmDt": "20240101",
    "salesDt": "20240101120000",
    "stockRlsDt": "20240101",
    "totItemCnt": 1,
    "totTaxblAmt": 100.00,
    "totTaxAmt": 16.00,
    "totAmt": 116.00,
    "itemList": [
      {
        "itemSeq": 1,
        "itemCd": "ITEM001",
        "itemClsCd": "43211901",
        "itemNm": "Sample Item",
        "qty": 1,
        "prc": 100.00,
        "splyAmt": 100.00,
        "vatCatCd": "A",
        "vatTaxblAmt": 100.00,
        "vatAmt": 16.00,
        "totAmt": 116.00
      }
    ]
  }
}
```

#### Purchase Invoice Processing
```
POST /purchase-invoice
Content-Type: application/json

Payload:
{
  "securityKey": "your_security_key",
  "invoiceData": {
    "tpin": "1000000000",
    "bhfId": "000",
    "spplrTpin": "2000000000",
    "spplrNm": "Supplier Name",
    "spplrBhfId": "000",
    "spplrInvcNo": 1,
    "regTyCd": "A",
    "pchsTyCd": "01",
    "rcptTyCd": "P",
    "pmtTyCd": "01",
    "pchsSttsCd": "02",
    "cfmDt": "20240101120000",
    "pchsDt": "20240101",
    "totItemCnt": 1,
    "totTaxblAmt": 100.00,
    "totTaxAmt": 16.00,
    "totAmt": 116.00,
    "itemList": [
      {
        "itemSeq": 1,
        "itemCd": "ITEM001",
        "itemClsCd": "43211901",
        "itemNm": "Sample Item",
        "qty": 1,
        "prc": 100.00,
        "splyAmt": 100.00,
        "vatCatCd": "A",
        "vatTaxblAmt": 100.00,
        "vatAmt": 16.00,
        "totAmt": 116.00
      }
    ]
  }
}
```

#### Items Management
```
POST /items
Content-Type: application/json

Payload:
{
  "securityKey": "your_security_key",
  "itemData": {
    "tpin": "1000000000",
    "bhfId": "000",
    "itemCd": "ITEM001",
    "itemClsCd": "43211901",
    "itemTyCd": "1",
    "itemNm": "Sample Item",
    "itemStdNm": "Standard Item Name",
    "orgnNatCd": "ZM",
    "pkgUnitCd": "CT",
    "qtyUnitCd": "U",
    "vatCatCd": "A",
    "useYn": "Y"
  }
}
```

#### Stock Management
```
POST /stock
Content-Type: application/json

Payload:
{
  "securityKey": "your_security_key",
  "stockData": {
    "tpin": "1000000000",
    "bhfId": "000",
    "sarTyCd": "01",
    "sarNo": 1,
    "orgSarNo": 0,
    "regTyCd": "A",
    "ocrnDt": "20240101",
    "totItemCnt": 1,
    "totTaxblAmt": 100.00,
    "totTaxAmt": 16.00,
    "totAmt": 116.00,
    "itemList": [
      {
        "itemSeq": 1,
        "itemCd": "ITEM001",
        "itemClsCd": "43211901",
        "itemNm": "Sample Item",
        "qty": 10,
        "prc": 100.00,
        "splyAmt": 1000.00,
        "vatCatCd": "A",
        "vatTaxblAmt": 1000.00,
        "vatAmt": 160.00,
        "totAmt": 1160.00
      }
    ]
  }
}
```

#### Imports Processing
```
POST /imports
Content-Type: application/json

Payload:
{
  "securityKey": "your_security_key",
  "importData": {
    "tpin": "1000000000",
    "bhfId": "000",
    "taskCd": "01",
    "dclDe": "20240101",
    "importItemList": [
      {
        "itemSeq": 1,
        "hsCd": "123456",
        "itemClsCd": "43211901",
        "itemCd": "ITEM001",
        "imptItemSttsCd": "3",
        "remark": "Approved import",
        "modrNm": "System",
        "modrId": "system_user"
      }
    ]
  }
}
```

### VSDC API Endpoints (Outbound)

#### Device Initialization
```
POST {baseUrl}/initializer/selectInitInfo
{
  "tpin": "1000000000",
  "bhfId": "000",
  "dvcSrlNo": "20180520000000"
}
```

#### Standard Codes Synchronization
```
POST {baseUrl}/code/selectCodes
{
  "tpin": "1000000000",
  "bhfId": "000",
  "lastReqDt": "20231215000000"
}
```

#### Item Classification Codes
```
POST {baseUrl}/itemClass/selectItemsClass
{
  "tpin": "1000000000",
  "bhfId": "000",
  "lastReqDt": "20231215000000"
}
```

#### ZRA Notices
```
POST {baseUrl}/notices/selectNotices
{
  "tpin": "1000000000",
  "bhfId": "000",
  "lastReqDt": "20231215000000"
}
```

#### Import Items Selection
```
POST {baseUrl}/imports/selectImportItems
{
  "tpin": "1000000000",
  "bhfId": "000",
  "lastReqDt": "20231215000000"
}
```

#### Purchase Sales Selection
```
POST {baseUrl}/trnsPurchase/selectTrnsPurchaseSales
{
  "tpin": "1000000000",
  "bhfId": "000",
  "lastReqDt": "20231215000000"
}
```

#### Sales Invoice Submission
```
POST {baseUrl}/trnsSales/saveSales
{
  "tpin": "1000000000",
  "bhfId": "000",
  "custTpin": "2000000000",
  "custNm": "Customer Name",
  "salesTyCd": "N",
  "rcptTyCd": "S",
  "pmtTyCd": "01",
  "salesSttsCd": "02",
  "cfmDt": "20240101",
  "salesDt": "20240101120000",
  "stockRlsDt": "20240101",
  "totItemCnt": 1,
  "totTaxblAmt": 100.00,
  "totTaxAmt": 16.00,
  "totAmt": 116.00,
  "regrId": "admin",
  "regrNm": "Administrator",
  "modrNm": "System",
  "modrId": "system",
  "itemList": [...]
}
```

#### Purchase Invoice Submission
```
POST {baseUrl}/trnsPurchase/savePurchase
{
  "tpin": "1000000000",
  "bhfId": "000",
  "spplrTpin": "2000000000",
  "spplrNm": "Supplier Name",
  "spplrBhfId": "000",
  "spplrInvcNo": 1,
  "regTyCd": "A",
  "pchsTyCd": "01",
  "rcptTyCd": "P",
  "pmtTyCd": "01",
  "pchsSttsCd": "02",
  "cfmDt": "20240101120000",
  "pchsDt": "20240101",
  "totItemCnt": 1,
  "totTaxblAmt": 100.00,
  "totTaxAmt": 16.00,
  "totAmt": 116.00,
  "regrId": "admin",
  "regrNm": "Administrator",
  "modrNm": "System",
  "modrId": "system",
  "itemList": [...]
}
```

#### Item Master Submission
```
POST {baseUrl}/items/saveItem
{
  "tpin": "1000000000",
  "bhfId": "000",
  "itemCd": "ITEM001",
  "itemClsCd": "43211901",
  "itemTyCd": "1",
  "itemNm": "Sample Item",
  "itemStdNm": "Standard Item Name",
  "orgnNatCd": "ZM",
  "pkgUnitCd": "CT",
  "qtyUnitCd": "U",
  "vatCatCd": "A",
  "useYn": "Y",
  "regrId": "admin",
  "regrNm": "Administrator",
  "modrNm": "System",
  "modrId": "system"
}
```

#### Stock Items Submission
```
POST {baseUrl}/stock/saveStockItems
{
  "tpin": "1000000000",
  "bhfId": "000",
  "sarTyCd": "01",
  "sarNo": 1,
  "orgSarNo": 0,
  "regTyCd": "A",
  "custTpin": null,
  "custNm": null,
  "custBhfId": null,
  "ocrnDt": "20240101",
  "totItemCnt": 1,
  "totTaxblAmt": 100.00,
  "totTaxAmt": 16.00,
  "totAmt": 116.00,
  "remark": null,
  "regrId": "admin",
  "regrNm": "Administrator",
  "modrNm": "System",
  "modrId": "system",
  "itemList": [...]
}
```

#### Stock Master Submission
```
POST {baseUrl}/stockMaster/saveStockMaster
{
  "tpin": "1000000000",
  "bhfId": "000",
  "regrId": "admin",
  "regrNm": "Administrator",
  "modrNm": "System",
  "modrId": "system",
  "stockItemList": [
    {
      "itemCd": "ITEM001",
      "rsdQty": 100
    }
  ]
}
```

#### Import Items Update
```
POST {baseUrl}/imports/updateImportItems
{
  "tpin": "1000000000",
  "bhfId": "000",
  "taskCd": "01",
  "dclDe": "20240101",
  "importItemList": [
    {
      "itemSeq": 1,
      "hsCd": "123456",
      "itemClsCd": "43211901",
      "itemCd": "ITEM001",
      "imptItemSttsCd": "3",
      "remark": "Approved",
      "modrNm": "System",
      "modrId": "system"
    }
  ]
}
```

## Database Schema

### Core Tables

#### SalesInvoices
- `id` - Primary key
- `originalPayload` - Original received data
- `processedPayload` - Transformed data for VSDC
- `response` - VSDC response
- `receivedAt` - Timestamp
- `createdAt` / `updatedAt` - Audit fields

#### PurchaseInvoices
- Similar structure to SalesInvoices

#### Items
- Item master data storage

#### Stocks
- Stock movement transactions

#### Imports
- Import declaration data

#### ImportsData
- Extended import data with approval workflow
- Additional fields: `System_Request_date`, `status`
- Import-specific fields: `taskCd`, `dclDe`, `itemSeq`, `dclNo`, `hsCd`, etc.

#### PurchasesData
- Extended purchase data with approval workflow
- Purchase-specific fields: `spplrTpin`, `spplrNm`, `spplrInvcNo`, etc.

#### Logs
- `eventType` - Type of event
- `details` - Event details
- `timestamp` - When event occurred

#### Init
- Device initialization data
- Company and branch information

#### StandardCodes
- ZRA standard codes
- `cdCls`, `cdClsNm`, `cd`, `cdNm`, `uniqueKey`

#### ItemClassCodes
- Item classification codes
- `itemClsCd`, `itemClsNm`, `itemClsLvl`, etc.

#### LastGetTime
- Sync tracking per process
- `process`, `lastReqDt`

#### ZRANotices
- Official ZRA notices
- `noticeId`, `title`, `content`, `publishDt`, `expiryDt`

## Security

### Authentication
- All incoming requests require `securityKey` in payload
- Configurable security key in application settings
- Header validation for API requests

### Data Validation
- JSON schema validation for incoming payloads
- Required field validation
- Data type and format checking

### Audit Trail
- Complete logging of all transactions
- Request/response tracking
- Error logging and monitoring

## Configuration

### Required Settings
1. **Security Key** - API authentication
2. **Initialization Details** - TPIN, Branch ID, Device Serial
3. **VSDC Base URL** - Target VSDC server
4. **Endpoint Configuration** - Individual service endpoints

### Default Endpoints
```json
{
  "salesInvoice": "http://localhost:8080/sandboxvsdc1.0.7.5/trnsSales/saveSales",
  "purchaseInvoice": "http://localhost:8080/sandboxvsdc1.0.7.5/trnsPurchase/savePurchase",
  "items": "http://localhost:8080/sandboxvsdc1.0.7.5/items/saveItem",
  "stock": "http://localhost:8080/sandboxvsdc1.0.7.5/stock/saveStockItems",
  "stockMaster": "http://localhost:8080/sandboxvsdc1.0.7.5/stockMaster/saveStockMaster",
  "imports": "http://localhost:8080/sandboxvsdc1.0.7.5/imports/updateImportItems"
}
```

## Stock Management

### Stock Validation Rules
1. **Item Existence**: All items must exist in the database with `zra_confirmation = 1`
2. **Service Items**: Items marked as `isService = true` do not require stock validation
3. **Product Items**: Items marked as `isService = false` require stock validation for outgoing transactions
4. **Stock Sufficiency**: Sales and credit note transactions validate sufficient stock before processing

### Stock Update Logic
- **Sales Transactions**: Reduce stock quantities (`currentStock -= qty`)
- **Purchase Transactions**: Increase stock quantities (`currentStock += qty`)
- **Import Approvals**: Increase stock quantities for approved items
- **Credit Notes**: Increase stock quantities (treated as returns)
- **Rejected Transactions**: No stock changes applied

### Automatic Stock Synchronization
After successful transactions, the system automatically:
1. Updates local `currentStock` values in the Items table
2. Sends stock adjustment records to VSDC via `/stock/saveStockItems`
3. Updates stock master records via `/stockMaster/saveStockMaster`

## Error Handling

### Common Error Responses

#### Item Not Found
```json
{
  "error": "Item with itemId ITEM001 does not exist. You need to create it and record it to ZRA before you can transact."
}
```

#### Insufficient Stock
```json
{
  "error": "Item Sample Item does not have enough stock to perform transaction. Current stock: 5, Required: 10. Add stock before you transact."
}
```

#### Import Already Processed
```json
{
  "error": "Import with taskCd 01 doesn't exist or has already been processed"
}
```

#### Purchase Not Found
```json
{
  "error": "Purchase with spplrInvcNo 12345 not found or already processed"
}
```

#### Database Error
```json
{
  "error": "Database not configured"
}
```

#### VSDC Communication Error
```json
{
  "error": "Failed to hit http://localhost:8080/sandboxvsdc1.0.7.5/trnsSales/saveSales: Connection timeout"
}
```

## Response Formats

### Success Response
```json
{
  "resultCd": "000",
  "resultMsg": "Success",
  "resultDt": "20240101120000",
  "data": {
    "rcptNo": 1,
    "intrlData": "QHRQAUCJVLRSLSFYVLFYN4FHR4",
    "rcptSign": "BSFCQEFAAVTC4B3D",
    "vsdcRcptPbctDate": "20250425144131",
    "sdcId": "SDC0010002520",
    "mrcNo": "WIS00003489",
    "qrCodeUrl": "https://sandboxportal.zra.org.zm/..."
  }
}
```

### Error Response
```json
{
  "resultCd": "001",
  "resultMsg": "Error description",
  "resultDt": "20240101120000"
}
```

## Synchronization

### Automatic Sync
- Daily sync at midnight for StandardCodes, ItemClassCodes, ZRANotices
- Retry mechanism for failed syncs every 15 minutes
- Comprehensive sync option from 2024-01-01 to current date

### Manual Sync
- Individual table sync triggers
- Import and Purchase data fetching
- Date range selection for targeted sync

## Deployment

### Requirements
- Node.js 20+
- SQLite 3
- Electron for desktop application
- Internet connectivity for VSDC communication

### Production Setup
1. Configure VSDC endpoints
2. Set up security keys
3. Initialize device with ZRA
4. Configure automatic sync schedules
5. Monitor logs and system health

## Support & Maintenance

### Logging
- All events logged to SQLite database
- Log rotation and cleanup
- Export capabilities for troubleshooting

### Monitoring
- Real-time connection status
- System performance metrics
- Error tracking and alerting

### Backup
- SQLite database backup procedures
- Configuration export/import
- Data recovery processes

---

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Support:** Technical Support Team