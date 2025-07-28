// ./server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const xml2js = require('xml2js');
const axios = require('axios');
const Store = require('electron-store');
const { sequelize, models, logger } = require('./db');
const schedule = require('node-schedule');
// Only require ipcMain when running in Electron context
let ipcMain;
try {
  ipcMain = require('electron').ipcMain;
} catch (error) {
  // Running outside Electron context, create a mock
  ipcMain = {
    emit: () => {} // No-op when not in Electron
  };
}

const store = new Store();
const app = express();
const server = require('http').createServer(app);

app.use(cors({ origin: 'http://192.168.1.100:8080', methods: ['POST'] }));
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/xml' }));

app.use(async (req, res, next) => {
  const securityKey = store.get('securityKey') || 'defaultKey123';
  if (req.body.securityKey !== securityKey) {
    logger.error('Invalid security key');
    ipcMain.emit('send-notice', null, { eventType: 'call_received', details: 'Invalid security key attempt' });
    return res.status(403).json({ error: 'Invalid security key' });
  }
  next();
});

async function validateItemsAndStock(itemList, transactionType) {
  const errors = [];
  const validatedItems = [];

  for (const item of itemList) {
    const itemRecord = await models().Items.findOne({ 
      where: { 
        itemId: item.itemId,
        zra_confirmation: 1 
      } 
    });

    if (!itemRecord) {
      errors.push(`Item with itemId ${item.itemId} does not exist. You need to create it and record it to ZRA before you can transact.`);
      continue;
    }

    // Check stock for non-service items
    if (!itemRecord.isService) {
      const requiredQty = parseFloat(item.qty || 0);
      const currentStock = parseFloat(itemRecord.currentStock || 0);

      // For sales and credit notes (outgoing), check if enough stock
      if ((transactionType === 'sales' || transactionType === 'credit') && currentStock < requiredQty) {
        errors.push(`Item ${itemRecord.itemNm} does not have enough stock to perform transaction. Current stock: ${currentStock}, Required: ${requiredQty}. Add stock before you transact.`);
        continue;
      }
    }

    // Add item details from database
    validatedItems.push({
      ...item,
      itemCd: itemRecord.itemCd,
      itemClsCd: itemRecord.itemClsCd,
      itemTyCd: itemRecord.itemTyCd,
      itemNm: itemRecord.itemNm,
      itemStdNm: itemRecord.itemStdNm,
      orgnNatCd: itemRecord.orgnNatCd,
      pkgUnitCd: itemRecord.pkgUnitCd,
      qtyUnitCd: itemRecord.qtyUnitCd,
      isService: itemRecord.isService
    });
  }

  return { errors, validatedItems };
}

async function updateStockQuantities(itemList, transactionType) {
  for (const item of itemList) {
    if (item.isService) continue; // Skip services

    const qty = parseFloat(item.qty || 0);
    let stockChange = 0;

    switch (transactionType) {
      case 'sales':
      case 'credit':
        stockChange = -qty; // Reduce stock
        break;
      case 'purchase':
      case 'import':
        stockChange = qty; // Increase stock
        break;
    }

    if (stockChange !== 0) {
      await models().Items.increment('currentStock', {
        by: stockChange,
        where: { itemId: item.itemId }
      });
    }
  }
}

async function sendToStockEndpoints(itemList, transactionType, transactionData) {
  const endpoints = store.get('savedEndpoints') || {};
  const stockEndpoint = endpoints.stock;
  const stockMasterEndpoint = endpoints.stockMaster;
  const initDetails = store.get('initDetails') || {};

  // Send to stock endpoint
  if (stockEndpoint) {
    try {
      const stockPayload = {
        tpin: initDetails.tpin,
        bhfId: initDetails.branch,
        sarTyCd: '01',
        sarNo: Math.floor(Date.now() / 1000),
        orgSarNo: 0,
        regTyCd: 'A',
        custTpin: transactionData.custTpin || null,
        custNm: transactionData.custNm || null,
        custBhfId: transactionData.custBhfId || null,
        ocrnDt: transactionData.salesDt || transactionData.pchsDt || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        totItemCnt: itemList.length,
        totTaxblAmt: transactionData.totTaxblAmt,
        totTaxAmt: transactionData.totTaxAmt,
        totAmt: transactionData.totAmt,
        remark: transactionData.remark,
        regrId: initDetails.regrId || 'admin',
        regrNm: initDetails.regrNm || 'Administrator',
        modrNm: initDetails.modrNm || 'System',
        modrId: initDetails.modrId || 'system',
        itemList: itemList.map(item => ({
          itemSeq: item.itemSeq,
          itemCd: item.itemCd,
          itemClsCd: item.itemClsCd,
          itemNm: item.itemNm,
          qty: item.qty,
          prc: item.prc,
          splyAmt: item.splyAmt,
          vatCatCd: item.vatCatCd,
          vatTaxblAmt: item.vatTaxblAmt,
          vatAmt: item.vatAmt,
          totAmt: item.totAmt
        }))
      };

      await axios.post(stockEndpoint, stockPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
    } catch (error) {
      logger.error(`Stock endpoint error: ${error.message}`);
    }
  }

  // Send to stock master endpoint
  if (stockMasterEndpoint) {
    try {
      const stockMasterPayload = {
        tpin: initDetails.tpin,
        bhfId: initDetails.branch,
        regrId: initDetails.regrId || 'admin',
        regrNm: initDetails.regrNm || 'Administrator',
        modrNm: initDetails.modrNm || 'System',
        modrId: initDetails.modrId || 'system',
        stockItemList: itemList.filter(item => !item.isService).map(item => ({
          itemCd: item.itemCd,
          rsdQty: item.qty
        }))
      };

      await axios.post(stockMasterEndpoint, stockMasterPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
    } catch (error) {
      logger.error(`Stock master endpoint error: ${error.message}`);
    }
  }
}

async function processPayload(req, res, modelName, vsdcEndpoint) {
  if (!sequelize()) {
    const errorLog = { eventType: 'sync_error', details: 'Database not configured for payload processing' };
    logger.error(errorLog.details);
    ipcMain.emit('send-notice', null, errorLog);
    return res.status(500).json({ error: 'Database not configured' });
  }

  const contentType = req.headers['content-type'];
  let incomingData = req.body;

  console.log(`processPayload: Incoming data for ${modelName}:`, JSON.stringify(incomingData, null, 2));

  const logReceived = { eventType: 'call_received', details: `Received at ${req.path}: ${JSON.stringify(incomingData)}` };
  await models().Logs.create(logReceived);
  logger.info(logReceived.details);
  ipcMain.emit('send-notice', null, logReceived);

  if (contentType === 'application/xml') {
    incomingData = await xml2js.parseStringPromise(incomingData);
  }

  // Extract data from payload
  const dataKeys = ['invoiceData', 'itemData', 'stockData', 'importData'];
  let extractedData = {};
  for (const key of dataKeys) {
    if (incomingData[key]) {
      extractedData = incomingData[key];
      break;
    }
  }
  if (Object.keys(extractedData).length === 0 && incomingData.securityKey) {
    const { securityKey, ...rest } = incomingData;
    extractedData = rest;
  }

  // Validate items and stock for transactions with itemList
  if (extractedData.itemList) {
    const transactionType = modelName === 'SalesInvoices' ? 'sales' : 
                           modelName === 'PurchaseInvoices' ? 'purchase' : 'other';
    
    const validation = await validateItemsAndStock(extractedData.itemList, transactionType);
    
    if (validation.errors.length > 0) {
      const errorMsg = validation.errors.join('; ');
      const errorLog = { eventType: 'validation_error', details: errorMsg };
      await models().Logs.create(errorLog);
      logger.error(errorLog.details);
      ipcMain.emit('send-notice', null, errorLog);
      return res.status(400).json({ error: errorMsg });
    }

    extractedData.itemList = validation.validatedItems;
  }

  // Force tpin and bhfId from initDetails
  const initDetails = store.get('initDetails') || {};
  extractedData.tpin = initDetails.tpin || '2001179764';
  extractedData.bhfId = initDetails.branch || 'Main Branch';

  // Create database entry with individual fields
  const Model = models()[modelName];
  const dbData = {
    ...extractedData,
    itemList: extractedData.itemList ? JSON.stringify(extractedData.itemList) : null,
    importItemList: extractedData.importItemList ? JSON.stringify(extractedData.importItemList) : null,
    originalPayload: JSON.stringify(incomingData),
    receivedAt: new Date()
  };

  const logEntry = await Model.create(dbData);

  const logCreated = { eventType: 'creation', details: `Stored in ${modelName}: ${logEntry.id}` };
  await models().Logs.create(logCreated);
  logger.info(logCreated.details);
  ipcMain.emit('send-notice', null, logCreated);

  // Prepare payload for VSDC
  const processedPayload = {
    ...extractedData,
    regrId: initDetails.regrId || 'admin',
    regrNm: initDetails.regrNm || 'Administrator',
    modrNm: initDetails.modrNm || 'System',
    modrId: initDetails.modrId || 'system'
  };

  try {
    const vsdcResponse = await axios.post(vsdcEndpoint, processedPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log(`processPayload: VSDC response for ${modelName}:`, JSON.stringify(vsdcResponse.data, null, 2));

    const logEndpoint = { eventType: 'endpoint_hit', details: `Hit ${vsdcEndpoint}: ${JSON.stringify(vsdcResponse.data)}` };
    await models().Logs.create(logEndpoint);
    logger.info(logEndpoint.details);
    ipcMain.emit('send-notice', null, logEndpoint);

    // Update zra_confirmation if successful
    const zraConfirmation = (vsdcResponse.data.resultCd === '000') ? 1 : 0;
    await logEntry.update({ 
      response: JSON.stringify(vsdcResponse.data),
      processedPayload: JSON.stringify(processedPayload),
      zra_confirmation: zraConfirmation
    });

    // If successful and has itemList, update stock and send to stock endpoints
    if (zraConfirmation === 1 && extractedData.itemList) {
      const transactionType = modelName === 'SalesInvoices' ? 'sales' : 
                             modelName === 'PurchaseInvoices' ? 'purchase' : 'other';
      
      await updateStockQuantities(extractedData.itemList, transactionType);
      await sendToStockEndpoints(extractedData.itemList, transactionType, extractedData);
    }

    const logReturned = { eventType: 'call_returned', details: `Returned from ${req.path}: ${JSON.stringify(vsdcResponse.data)}` };
    await models().Logs.create(logReturned);
    logger.info(logReturned.details);
    ipcMain.emit('send-notice', null, logReturned);

    res.json(vsdcResponse.data);
  } catch (error) {
    const errorLog = { eventType: 'sync_error', details: `Failed to hit ${vsdcEndpoint}: ${error.message}, Code: ${error.code}` };
    logger.error(errorLog.details);
    ipcMain.emit('send-notice', null, errorLog);
    res.status(500).json({ error: errorLog.details });
  }
}

function transformPayload(payload) {
  console.log('transformPayload: Original payload received:', JSON.stringify(payload, null, 2));
  
  // Generalize to extract the main data object, assuming structure { securityKey, [dataKey]: {...} }
  const dataKeys = ['invoiceData', 'itemData', 'stockData', 'importData']; // Add more if needed
  let transformed = {};
  for (const key of dataKeys) {
    if (payload[key]) {
      transformed = payload[key];
      break;
    }
  }
  // If no specific data key is found, return the payload minus securityKey if present
  if (Object.keys(transformed).length === 0 && payload.securityKey) {
    const { securityKey, ...rest } = payload;
    transformed = rest;
  }
  
  // Force tpin and bhfId from initDetails, overriding any existing values
  const initDetails = store.get('initDetails') || {};
  const defaultTpin = initDetails.tpin || '2001179764'; // Fallback if not set
  const defaultBhfId = initDetails.branch || 'Main Branch'; // Fallback if not set
  transformed.tpin = defaultTpin; // Always override
  transformed.bhfId = defaultBhfId; // Always override

  console.log('transformPayload: Transformed payload (data only with forced tpin/bhfId):', JSON.stringify(transformed, null, 2));
  return transformed;
}

const routes = () => store.get('routes') || {
  'sales-invoice': 'SalesInvoices',
  'purchase-invoice': 'PurchaseInvoices',
  'items': 'Items',
  'stock': 'Stocks',
  'imports': 'Imports'
};

const endpoints = () => store.get('savedEndpoints') || {
  salesInvoice: 'http://localhost:8080/sandboxvsdc1.0.7.5/trnsSales/saveSales',
  purchaseInvoice: 'http://localhost:8080/sandboxvsdc1.0.7.5/trnsPurchase/savePurchase',
  items: 'http://localhost:8080/sandboxvsdc1.0.7.5/items/saveItem',
  stock: 'http://localhost:8080/sandboxvsdc1.0.7.5/stock/saveStockItems',
  stockMaster: 'http://localhost:8080/sandboxvsdc1.0.7.5/stockMaster/saveStockMaster',
  imports: 'http://localhost:8080/sandboxvsdc1.0.7.5/imports/updateImportItems'
};

// Map model names to endpoint keys
const modelToEndpointKey = {
  SalesInvoices: 'salesInvoice',
  PurchaseInvoices: 'purchaseInvoice',
  Items: 'items',
  Stocks: 'stock',
  Imports: 'imports'
};

Object.entries(routes()).forEach(([route, modelName]) => {
  const endpointKey = modelToEndpointKey[modelName];
  const vsdcEndpoint = endpoints()[endpointKey];
  if (!vsdcEndpoint) {
    console.error(`No endpoint found for ${modelName} (route: ${route}) in stored endpoints`);
    return;
  }
  console.log(`Registering route /${route} to ${modelName} with endpoint ${vsdcEndpoint}`);
  app.post(`/${route}`, (req, res) => processPayload(req, res, modelName, vsdcEndpoint));
});

function getBaseUrl() {
  const initDetails = store.get('initDetails');
  if (!initDetails || !initDetails.url) throw new Error('Initialization details not found.');
  return initDetails.url.replace('/initializer/selectInitInfo', '');
}

function getPayload(process, lastReqDt) {
  const initDetails = store.get('initDetails');
  if (!initDetails || !initDetails.tpin || !initDetails.branch) throw new Error('Initialization details incomplete.');
  return {
    tpin: initDetails.tpin,
    bhfId: initDetails.branch,
    lastReqDt: lastReqDt || '20231215000000'
  };
}

function incrementDate(dateStr) {
  const date = new Date(dateStr.slice(0, 4), dateStr.slice(4, 6) - 1, dateStr.slice(6, 8));
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/, '').replace(/-/, '') + '000000';
}

function has24HoursPassed(lastReqDt) {
  const lastDate = new Date(
    lastReqDt.slice(0, 4), 
    lastReqDt.slice(4, 6) - 1, 
    lastReqDt.slice(6, 8), 
    lastReqDt.slice(8, 10), 
    lastReqDt.slice(10, 12), 
    lastReqDt.slice(12, 14)
  );
  const diffHours = (new Date() - lastDate) / (1000 * 60 * 60);
  logger.info(`Time since last sync for ${lastReqDt}: ${diffHours} hours`);
  return diffHours >= 24;
}

async function waitForDbConnection(maxAttempts = 5, delayMs = 2000) {
  let attempts = 0;
  while (!sequelize() && attempts < maxAttempts) {
    logger.info(`Waiting for database connection... Attempt ${attempts + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    attempts++;
  }
  if (!sequelize()) return false;
  await sequelize().authenticate();
  logger.info('Database connection established');
  ipcMain.emit('send-notice', null, { eventType: 'db_connection', details: 'Database connection established' });
  return true;
}

async function checkVSDCAvailability() {
  const baseUrl = getBaseUrl();
  try {
    const response = await axios.get(baseUrl, { timeout: 5000 });
    const isRunning = (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).includes('VSDC Service Time:');
    logger.info(`VSDC server check: ${baseUrl} is ${isRunning ? 'available' : 'unavailable'}`);
    return isRunning;
  } catch (error) {
    logger.info(`VSDC server unavailable: ${error.message}`);
    return false;
  }
}

let syncPending = false;
let isSyncing = false;

const retryAxios = async (url, payload, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.post(url, payload, { timeout: 10000 });
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      logger.info(`Retrying ${url} (attempt ${i + 2}/${retries})`);
    }
  }
};

async function fetchStandardCodes(lastReqDt) {
  const url = `${getBaseUrl()}/code/selectCodes`;
  const payload = getPayload('StandardCodes', lastReqDt);
  logger.info(`Fetching StandardCodes from ${url}`);
  ipcMain.emit('send-notice', null, { eventType: 'sync_attempt', details: `Fetching StandardCodes` });

  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const clsList = result.data.clsList || [];
      const codesToInsert = [];
      for (const cls of clsList) {
        const dtlList = cls.dtlList || [];
        for (const dtl of dtlList) {
          codesToInsert.push({
            cdCls: cls.cdCls,
            cdClsNm: cls.cdClsNm,
            cd: dtl.cd,
            cdNm: dtl.cdNm,
            uniqueKey: `${cls.cdCls}-${dtl.cd}`
          });
        }
      }
      if (codesToInsert.length) {
        // SQLite compatible upsert using individual operations for better compatibility
        for (const code of codesToInsert) {
          await models().StandardCodes.upsert(code);
        }
        logger.info(`Saved ${codesToInsert.length} StandardCodes`);
      }
      syncPending = false;
      return codesToInsert.length ? result.resultDt : incrementDate(lastReqDt);
    } else {
      syncPending = true;
      return lastReqDt;
    }
  } catch (error) {
    logger.error(`StandardCodes fetch error: ${error.message}`);
    syncPending = true;
    return lastReqDt;
  }
}

async function fetchItemClassCodes(lastReqDt) {
  const url = `${getBaseUrl()}/itemClass/selectItemsClass`;
  const payload = getPayload('ItemClassCodes', lastReqDt);
  logger.info(`Fetching ItemClassCodes from ${url}`);
  ipcMain.emit('send-notice', null, { eventType: 'sync_attempt', details: `Fetching ItemClassCodes` });

  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const itemClsList = result.data?.itemClsList || [];
      const itemsToInsert = itemClsList.map(item => ({
        itemClsCd: item.itemClsCd,
        itemClsNm: item.itemClsNm,
        itemClsLvl: item.itemClsLvl,
        taxTyCd: item.taxTyCd,
        mjrTgYn: item.mjrTgYn,
        useYn: item.useYn
      }));
      if (itemsToInsert.length) {
        // SQLite compatible upsert using individual operations for better compatibility
        for (const item of itemsToInsert) {
          await models().ItemClassCodes.upsert(item);
        }
        logger.info(`Saved ${itemsToInsert.length} ItemClassCodes`);
      }
      syncPending = false;
      return itemsToInsert.length ? result.resultDt : incrementDate(lastReqDt);
    } else {
      syncPending = true;
      return lastReqDt;
    }
  } catch (error) {
    logger.error(`ItemClassCodes fetch error: ${error.message}`);
    syncPending = true;
    return lastReqDt;
  }
}

async function fetchZRANotices(lastReqDt) {
  const url = `${getBaseUrl()}/notices/selectNotices`;
  const payload = getPayload('ZRANotices', lastReqDt);
  logger.info(`Fetching ZRANotices from ${url}`);
  ipcMain.emit('send-notice', null, { eventType: 'sync_attempt', details: `Fetching ZRANotices` });

  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const noticeList = result.data.noticeList || [];
      const noticesToInsert = noticeList.map(notice => ({
        noticeId: notice.noticeNo,
        title: notice.title,
        content: notice.cont,
        publishDt: notice.regDt,
        expiryDt: notice.expiryDt || null
      }));
      if (noticesToInsert.length) {
        // SQLite compatible upsert using individual operations for better compatibility
        for (const notice of noticesToInsert) {
          await models().ZRANotices.upsert(notice);
        }
        logger.info(`Saved ${noticesToInsert.length} ZRANotices`);
      }
      syncPending = false;
      return noticesToInsert.length ? result.resultDt : incrementDate(lastReqDt);
    } else {
      syncPending = true;
      return lastReqDt;
    }
  } catch (error) {
    logger.error(`ZRANotices fetch error: ${error.message}`);
    syncPending = true;
    return lastReqDt;
  }
}

async function syncCodes() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/, '').replace(/-/, '') + '000000';
    logger.info(`Syncing up to today: ${today}`);
    ipcMain.emit('send-notice', null, { eventType: 'sync_start', details: `Syncing up to today: ${today}` });

    if (!(await waitForDbConnection())) return;

    const initDetails = store.get('initDetails');
    if (!initDetails || !initDetails.tpin || !initDetails.branch || !initDetails.url) return;

    const [standardLast, itemLast, noticeLast] = await Promise.all([
      models().LastGetTime.findOne({ where: { process: 'StandardCodes' } }),
      models().LastGetTime.findOne({ where: { process: 'ItemClassCodes' } }),
      models().LastGetTime.findOne({ where: { process: 'ZRANotices' } })
    ]);

    let standardLastReqDt = standardLast ? standardLast.lastReqDt : '20231215000000';
    let itemLastReqDt = itemLast ? itemLast.lastReqDt : '20231215000000';
    let noticeLastReqDt = noticeLast ? noticeLast.lastReqDt : '20231215000000';

    const [standardResult, itemResult, noticeResult] = await Promise.all([
      standardLastReqDt < today ? fetchStandardCodes(standardLastReqDt) : standardLastReqDt,
      itemLastReqDt < today ? fetchItemClassCodes(itemLastReqDt) : itemLastReqDt,
      noticeLastReqDt < today ? fetchZRANotices(noticeLastReqDt) : noticeLastReqDt
    ]);

    await Promise.all([
      models().LastGetTime.upsert({ process: 'StandardCodes', lastReqDt: standardResult }),
      models().LastGetTime.upsert({ process: 'ItemClassCodes', lastReqDt: itemResult }),
      models().LastGetTime.upsert({ process: 'ZRANotices', lastReqDt: noticeResult })
    ]);

    logger.info(`Updated LastGetTime: StandardCodes=${standardResult}, ItemClassCodes=${itemResult}, ZRANotices=${noticeResult}`);
    ipcMain.emit('send-notice', null, { eventType: 'sync_update', details: `Sync completed` });
  } catch (error) {
    logger.error(`Sync failed: ${error.message}`);
    ipcMain.emit('send-notice', null, { eventType: 'sync_error', details: `Sync failed: ${error.message}` });
  } finally {
    isSyncing = false;
  }
}

async function checkAndSync() {
  logger.info('Starting sync check');
  ipcMain.emit('send-notice', null, { eventType: 'sync_check', details: 'Starting sync check' });

  if (!(await waitForDbConnection())) return;

  const initDetails = store.get('initDetails');
  if (!initDetails || !initDetails.tpin || !initDetails.branch || !initDetails.url) return;

  const [standardLast, itemLast, noticeLast] = await Promise.all([
    models().LastGetTime.findOne({ where: { process: 'StandardCodes' } }),
    models().LastGetTime.findOne({ where: { process: 'ItemClassCodes' } }),
    models().LastGetTime.findOne({ where: { process: 'ZRANotices' } })
  ]);

  const shouldSync = (
    (!standardLast || has24HoursPassed(standardLast.lastReqDt)) ||
    (!itemLast || has24HoursPassed(itemLast.lastReqDt)) ||
    (!noticeLast || has24HoursPassed(noticeLast.lastReqDt)) ||
    syncPending
  );

  if (shouldSync && (await checkVSDCAvailability())) {
    logger.info('Sync required');
    ipcMain.emit('send-notice', null, { eventType: 'sync_required', details: 'Sync required' });
    await syncCodes();
  } else {
    logger.info('Sync skipped');
    ipcMain.emit('send-notice', null, { eventType: 'sync_skipped', details: 'Sync skipped' });
  }
}

schedule.scheduleJob('0 0 * * *', () => {
  logger.info('Scheduled 24-hour sync check at midnight');
  ipcMain.emit('send-notice', null, { eventType: 'sync_scheduled', details: 'Scheduled sync at midnight' });
  checkAndSync();
});

schedule.scheduleJob('*/15 * * * *', async () => {
  if (syncPending) {
    logger.info('Checking VSDC server for pending sync');
    ipcMain.emit('send-notice', null, { eventType: 'sync_check', details: 'Checking for pending sync' });
    if (await checkVSDCAvailability()) {
      logger.info('Retrying sync');
      ipcMain.emit('send-notice', null, { eventType: 'sync_retry', details: 'Retrying sync' });
      await syncCodes();
    }
  }
});

// Comprehensive sync function from 2024-01-01 to current date
async function comprehensiveSync() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    logger.info('Starting comprehensive sync from 2024-01-01 to current date');
    ipcMain.emit('send-notice', null, { eventType: 'sync_start', details: 'Starting comprehensive sync from 2024-01-01' });

    if (!(await waitForDbConnection())) return;

    const initDetails = store.get('initDetails');
    if (!initDetails || !initDetails.tpin || !initDetails.branch || !initDetails.url) {
      logger.error('Initialization details missing for comprehensive sync');
      return;
    }

    const startDate = '20240101000000';
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    
    logger.info(`Comprehensive sync from ${startDate} to ${currentDate}`);
    ipcMain.emit('send-notice', null, { eventType: 'sync_progress', details: `Syncing from ${startDate} to ${currentDate}` });

    // Clear duplicates before starting
    await removeDuplicates();

    let currentSyncDate = startDate;
    let totalStandardCodes = 0;
    let totalItemCodes = 0;
    let totalNotices = 0;

    while (currentSyncDate < currentDate) {
      logger.info(`Syncing data for date: ${currentSyncDate}`);
      ipcMain.emit('send-notice', null, { eventType: 'sync_progress', details: `Processing date: ${currentSyncDate}` });

      try {
        // Fetch data for current date
        const [standardResult, itemResult, noticeResult] = await Promise.all([
          fetchStandardCodesForDate(currentSyncDate),
          fetchItemClassCodesForDate(currentSyncDate), 
          fetchZRANoticesForDate(currentSyncDate)
        ]);

        totalStandardCodes += standardResult.count || 0;
        totalItemCodes += itemResult.count || 0;
        totalNotices += noticeResult.count || 0;

        // Move to next day
        currentSyncDate = incrementDate(currentSyncDate);

        // Add small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Error syncing date ${currentSyncDate}: ${error.message}`);
        // Continue with next date even if current fails
        currentSyncDate = incrementDate(currentSyncDate);
      }
    }

    // Final duplicate removal
    await removeDuplicates();

    // Update last sync times
    await Promise.all([
      models().LastGetTime.upsert({ process: 'StandardCodes', lastReqDt: currentDate }),
      models().LastGetTime.upsert({ process: 'ItemClassCodes', lastReqDt: currentDate }),
      models().LastGetTime.upsert({ process: 'ZRANotices', lastReqDt: currentDate })
    ]);

    logger.info(`Comprehensive sync completed. StandardCodes: ${totalStandardCodes}, ItemCodes: ${totalItemCodes}, Notices: ${totalNotices}`);
    ipcMain.emit('send-notice', null, { 
      eventType: 'sync_complete', 
      details: `Sync completed! StandardCodes: ${totalStandardCodes}, ItemCodes: ${totalItemCodes}, Notices: ${totalNotices}` 
    });

  } catch (error) {
    logger.error(`Comprehensive sync failed: ${error.message}`);
    ipcMain.emit('send-notice', null, { eventType: 'sync_error', details: `Comprehensive sync failed: ${error.message}` });
  } finally {
    isSyncing = false;
  }
}

async function fetchStandardCodesForDate(requestDate) {
  const url = `${getBaseUrl()}/code/selectCodes`;
  const payload = getPayload('StandardCodes', requestDate);
  
  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const clsList = result.data.clsList || [];
      const codesToInsert = [];
      
      for (const cls of clsList) {
        const dtlList = cls.dtlList || [];
        for (const dtl of dtlList) {
          codesToInsert.push({
            cdCls: cls.cdCls,
            cdClsNm: cls.cdClsNm,
            cd: dtl.cd,
            cdNm: dtl.cdNm,
            uniqueKey: `${cls.cdCls}-${dtl.cd}`
          });
        }
      }
      
      if (codesToInsert.length) {
        for (const code of codesToInsert) {
          await models().StandardCodes.upsert(code);
        }
        logger.info(`Saved ${codesToInsert.length} StandardCodes for ${requestDate}`);
      }
      
      return { count: codesToInsert.length, success: true };
    } else {
      return { count: 0, success: false };
    }
  } catch (error) {
    logger.error(`StandardCodes fetch error for ${requestDate}: ${error.message}`);
    return { count: 0, success: false };
  }
}

async function fetchItemClassCodesForDate(requestDate) {
  const url = `${getBaseUrl()}/itemClass/selectItemsClass`;
  const payload = getPayload('ItemClassCodes', requestDate);
  
  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const itemClsList = result.data?.itemClsList || [];
      const itemsToInsert = itemClsList.map(item => ({
        itemClsCd: item.itemClsCd,
        itemClsNm: item.itemClsNm,
        itemClsLvl: item.itemClsLvl,
        taxTyCd: item.taxTyCd,
        mjrTgYn: item.mjrTgYn,
        useYn: item.useYn
      }));
      
      if (itemsToInsert.length) {
        for (const item of itemsToInsert) {
          await models().ItemClassCodes.upsert(item);
        }
        logger.info(`Saved ${itemsToInsert.length} ItemClassCodes for ${requestDate}`);
      }
      
      return { count: itemsToInsert.length, success: true };
    } else {
      return { count: 0, success: false };
    }
  } catch (error) {
    logger.error(`ItemClassCodes fetch error for ${requestDate}: ${error.message}`);
    return { count: 0, success: false };
  }
}

async function fetchZRANoticesForDate(requestDate) {
  const url = `${getBaseUrl()}/notices/selectNotices`;
  const payload = getPayload('ZRANotices', requestDate);
  
  try {
    const response = await retryAxios(url, payload);
    const result = response.data;

    if (result.resultCd === '000') {
      const noticeList = result.data.noticeList || [];
      const noticesToInsert = noticeList.map(notice => ({
        noticeId: notice.noticeNo,
        title: notice.title,
        content: notice.cont,
        publishDt: notice.regDt,
        expiryDt: notice.expiryDt || null
      }));
      
      if (noticesToInsert.length) {
        for (const notice of noticesToInsert) {
          await models().ZRANotices.upsert(notice);
        }
        logger.info(`Saved ${noticesToInsert.length} ZRANotices for ${requestDate}`);
      }
      
      return { count: noticesToInsert.length, success: true };
    } else {
      return { count: 0, success: false };
    }
  } catch (error) {
    logger.error(`ZRANotices fetch error for ${requestDate}: ${error.message}`);
    return { count: 0, success: false };
  }
}

async function removeDuplicates() {
  try {
    logger.info('Removing duplicates from all tables');
    ipcMain.emit('send-notice', null, { eventType: 'cleanup', details: 'Removing duplicate records' });

    // Remove duplicates from StandardCodes
    await sequelize().query(`
      DELETE FROM StandardCodes 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM StandardCodes 
        GROUP BY uniqueKey
      )
    `);

    // Remove duplicates from ItemClassCodes  
    await sequelize().query(`
      DELETE FROM ItemClassCodes 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM ItemClassCodes 
        GROUP BY itemClsCd
      )
    `);

    // Remove duplicates from ZRANotices
    await sequelize().query(`
      DELETE FROM ZRANotices 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM ZRANotices 
        GROUP BY noticeId
      )
    `);

    logger.info('Duplicate removal completed');
    ipcMain.emit('send-notice', null, { eventType: 'cleanup', details: 'Duplicate removal completed' });

  } catch (error) {
    logger.error(`Duplicate removal failed: ${error.message}`);
    ipcMain.emit('send-notice', null, { eventType: 'cleanup_error', details: `Duplicate removal failed: ${error.message}` });
  }
}

// Add endpoint to trigger comprehensive sync
// Imports processing endpoint
app.post('/process-imports', async (req, res) => {
  try {
    const { tpin, bhfId, taskCd, importItemList } = req.body;
    
    // Find import record
    const importRecord = await models().Imports.findOne({
      where: { tpin, bhfId, taskCd, status: 'pending' }
    });

    if (!importRecord) {
      return res.status(404).json({ 
        error: `Import with taskCd ${taskCd} doesn't exist or has already been processed` 
      });
    }

    // Get endpoints from configuration
    const endpoints = store.get('savedEndpoints') || {};
    const importsEndpoint = endpoints.imports;
    const itemsEndpoint = endpoints.items;
    const initDetails = store.get('initDetails') || {};

    const results = [];

    for (const item of importItemList) {
      try {
        // Prepare import update payload
        const importPayload = {
          tpin: initDetails.tpin,
          bhfId: initDetails.branch,
          taskCd: taskCd,
          dclDe: importRecord.dclDe,
          importItemList: [{
            itemSeq: item.itemSeq,
            hsCd: item.hsCd || '',
            itemClsCd: item.itemClsCd || '',
            itemCd: item.itemCd || '',
            imptItemSttsCd: item.imptItemSttsCd,
            remark: item.remark || '',
            modrNm: initDetails.modrNm || 'System',
            modrId: initDetails.modrId || 'system'
          }]
        };

        // Send to VSDC imports endpoint
        const vsdcResponse = await axios.post(importsEndpoint, importPayload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        if (vsdcResponse.data.resultCd === '000') {
          // Check if item exists in items table
          const existingItem = await models().Items.findOne({
            where: { itemId: item.itemId, zra_confirmation: 1 }
          });

          if (!existingItem && item.imptItemSttsCd === '3') {
            // Create item if approved and doesn't exist
            const itemPayload = {
              tpin: initDetails.tpin,
              bhfId: initDetails.branch,
              itemCd: item.itemCd,
              itemClsCd: item.itemClsCd,
              itemTyCd: item.itemTyCd || '1',
              itemNm: item.itemNm,
              itemStdNm: item.itemStdNm || item.itemNm,
              orgnNatCd: item.orgnNatCd || 'ZM',
              pkgUnitCd: item.pkgUnitCd || 'CT',
              qtyUnitCd: item.qtyUnitCd || 'U',
              vatCatCd: item.vatCatCd || 'A',
              useYn: 'Y',
              regrId: initDetails.regrId || 'admin',
              regrNm: initDetails.regrNm || 'Administrator',
              modrNm: initDetails.modrNm || 'System',
              modrId: initDetails.modrId || 'system'
            };

            await axios.post(itemsEndpoint, itemPayload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            });

            // Create item in local database
            await models().Items.create({
              itemId: item.itemId,
              ...itemPayload,
              currentStock: 0,
              isService: false,
              originalPayload: JSON.stringify(itemPayload),
              zra_confirmation: 1
            });
          }

          // Update stock if approved
          if (item.imptItemSttsCd === '3') {
            await updateStockQuantities([{ 
              itemId: item.itemId, 
              qty: item.qty, 
              isService: existingItem ? existingItem.isService : false 
            }], 'import');
            
            await sendToStockEndpoints([item], 'import', importRecord);
          }

          results.push({ itemId: item.itemId, status: 'success', message: 'Processed successfully' });
        } else {
          results.push({ itemId: item.itemId, status: 'error', message: vsdcResponse.data.resultMsg });
        }
      } catch (error) {
        results.push({ itemId: item.itemId, status: 'error', message: error.message });
      }
    }

    // Update import status to processed
    await importRecord.update({ status: 'Processed' });

    res.json({ success: true, results });
  } catch (error) {
    logger.error(`Process imports error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Purchases processing endpoint
app.post('/process-purchases', async (req, res) => {
  try {
    const { spplrInvcNo, action, ...purchaseData } = req.body;
    
    if (action === 'approve' || action === 'reject') {
      // Find existing purchase
      const existingPurchase = await models().PurchaseInvoices.findOne({
        where: { spplrInvcNo, status: 'pending' }
      });

      if (existingPurchase) {
        // Update status to processed
        await existingPurchase.update({ status: 'Processed' });
        return res.json({ 
          success: true, 
          message: `Purchase ${spplrInvcNo} ${action}d and marked as processed` 
        });
      } else {
        return res.status(404).json({ 
          error: `Purchase with spplrInvcNo ${spplrInvcNo} not found or already processed` 
        });
      }
    } else {
      // Regular purchase recording
      return processPayload(req, res, 'PurchaseInvoices', endpoints().purchaseInvoice);
    }
  } catch (error) {
    logger.error(`Process purchases error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/trigger-comprehensive-sync', async (req, res) => {
  try {
    logger.info('Comprehensive sync triggered via API');
    ipcMain.emit('send-notice', null, { eventType: 'sync_trigger', details: 'Comprehensive sync triggered via API' });
    
    // Don't await - let it run in background
    comprehensiveSync();
    
    res.json({ success: true, message: 'Comprehensive sync started' });
  } catch (error) {
    logger.error(`Failed to trigger comprehensive sync: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

setTimeout(() => {
  logger.info('Starting initial sync check');
  ipcMain.emit('send-notice', null, { eventType: 'sync_start', details: 'Initial sync check' });
  checkAndSync();
}, 5000);

server.listen(3000, () => {
  logger.info('nodeCon middleware running on port 3000');
  try {
    if (ipcMain && typeof ipcMain.emit === 'function') {
      ipcMain.emit('send-notice', null, { eventType: 'creation', details: 'nodeCon middleware running on port 3000' });
    }
  } catch (error) {
    // Silent fail when not in Electron context
  }
});