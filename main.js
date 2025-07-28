// ./main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const store = new Store();
const { testAndCreateDatabase, checkConnection, dumpDatabase, sequelize, models, logger } = require('./db');
const axios = require('axios');
require('./server.js');

let mainWindow;

async function initializeApp() {
  const config = store.get('dbConfig');
  if (config) {
    const result = await checkConnection(config);
    if (result.success) {
      logger.info('Database auto-connected successfully');
      mainWindow.webContents.send('connection-status', { isConnected: true, dbExists: result.dbExists });
      mainWindow.webContents.send('notice', { eventType: 'DB Connection', details: 'Database auto-connected successfully' });
    } else {
      logger.error('Auto-connect failed:', result.error);
      store.delete('dbConfig');
      mainWindow.webContents.send('connection-status', { isConnected: false, dbExists: false });
      mainWindow.webContents.send('notice', { eventType: 'DB Connection', details: `Auto-connect failed: ${result.error}` });
    }
  } else {
    mainWindow.webContents.send('connection-status', { isConnected: false, dbExists: false });
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () => {
    initializeApp();
  });
}

ipcMain.on('send-notice', (event, notice) => {
  if (mainWindow) {
    mainWindow.webContents.send('notice', notice);
    logger.info(`Relayed notice to UI: ${notice.eventType}`);
  }
});

ipcMain.handle('test-connection', async (event) => {
  console.log('Main: test-connection called');
  try {
    const result = await testAndCreateDatabase();
    console.log('Main: test-connection result:', result);
    if (result.success) {
      event.sender.send('notice', { eventType: 'DB Connection', details: 'SQLite database initialized successfully' });
      if (result.dbExists) {
        event.sender.send('connection-status', { isConnected: true, dbExists: true });
      }
    } else {
      event.sender.send('notice', { eventType: 'DB Connection', details: `Initialization failed: ${result.error}` });
    }
    return result;
  } catch (error) {
    console.error('Main: test-connection error:', error.message);
    event.sender.send('notice', { eventType: 'DB Connection', details: `Connection error: ${error.message}` });
    return { success: false, error: error.message, dbExists: false };
  }
});

ipcMain.handle('create-database', async (event) => {
  console.log('Main: create-database called');
  try {
    const result = await testAndCreateDatabase();
    console.log('Main: create-database result:', result);
    if (result.success) {
      event.sender.send('notice', { eventType: 'DB Creation', details: `Database ${result.dbExists ? 'verified' : 'created'} with ${result.tables.length} tables` });
      event.sender.send('connection-status', { isConnected: true, dbExists: true });
    } else {
      event.sender.send('notice', { eventType: 'DB Creation', details: `Creation failed: ${result.error}` });
    }
    return result;
  } catch (error) {
    console.error('Main: create-database error:', error.message);
    event.sender.send('notice', { eventType: 'DB Creation', details: `Creation error: ${error.message}` });
    return { success: false, error: error.message, dbExists: false };
  }
});

ipcMain.handle('reset-connection', async () => {
  console.log('Main: Resetting connection');
  if (sequelize()) await sequelize().close();
  logger.info('Database connection closed and reset');
  mainWindow.webContents.send('notice', { eventType: 'DB Reset', details: 'Database connection reset' });
  return { success: true };
});

ipcMain.handle('dump-database', async (event) => {
  console.log('Main: dump-database called');
  try {
    const result = await dumpDatabase();
    console.log('Main: dump-database result:', result);
    if (result.success) {
      event.sender.send('notice', { eventType: 'DB Dump', details: 'Database deleted successfully' });
      event.sender.send('connection-status', { isConnected: false, dbExists: false });
    } else {
      event.sender.send('notice', { eventType: 'DB Dump', details: `Dump failed: ${result.error}` });
    }
    return result;
  } catch (error) {
    console.error('Main: dump-database error:', error.message);
    event.sender.send('notice', { eventType: 'DB Dump', details: `Dump error: ${error.message}` });
    return { success: false, error: error.message, dbExists: false };
  }
});

ipcMain.handle('check-init-status', async (event, url) => {
  console.log('Main: Checking init status for URL:', url);
  try {
    const baseUrl = url.replace('/initializer/selectInitInfo', '');
    const response = await axios.get(baseUrl, { timeout: 5000 });
    const isRunning = (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).includes('VSDC Service Time:');
    console.log(`Main: VSDC status - ${baseUrl} is ${isRunning ? 'running' : 'not running'}`);
    return { running: isRunning };
  } catch (error) {
    console.error('Main: Check-init-status error:', error.message);
    return { running: false };
  }
});

ipcMain.handle('initialize-device', async (event, url, payload) => {
  console.log('Main: Initializing device with URL:', url, 'Payload:', payload);
  try {
    const requestTime = new Date().toISOString();
    event.sender.send('notice', { eventType: 'VSDC Request', details: `Sending to ${url}` });
    const response = await axios.post(url, payload, { timeout: 5000 });
    const result = response.data;

    if (sequelize()) {
      await models().Logs.create({
        eventType: 'initialization',
        details: JSON.stringify({ url, requestTime, response: result })
      });

      if (result.resultCd === '000') {
        await models().Init.create({
          tin: result.data.info.tin,
          taxprNm: result.data.info.taxprNm,
          bsnsActv: result.data.info.bsnsActv,
          bhfId: result.data.info.bhfId,
          bhfNm: result.data.info.bhfNm,
          bhfOpenDt: result.data.info.bhfOpenDt,
          prvncNm: result.data.info.prvncNm,
          dstrtNm: result.data.info.dstrtNm,
          sctrNm: result.data.info.sctrNm,
          locDesc: result.data.info.locDesc,
          hqYn: result.data.info.hqYn,
          mgrNm: result.data.info.mgrNm,
          mgrTelNo: result.data.info.mgrTelNo,
          mgrEmail: result.data.info.mgrEmail,
          sdcId: result.data.info.sdcId,
          mrcNo: result.data.info.mrcNo,
          lastPchsInvcNo: result.data.info.lastPchsInvcNo,
          lastSaleRcptNo: result.data.info.lastSaleRcptNo,
          lastInvcNo: result.data.info.lastInvcNo,
          lastSaleInvcNo: result.data.info.lastSaleInvcNo,
          lastTrainInvcNo: result.data.info.lastTrainInvcNo,
          lastProfrmInvcNo: result.data.info.lastProfrmInvcNo,
          lastCopyInvcNo: result.data.info.lastCopyInvcNo
        });
        await models().Logs.create({
          eventType: 'initialization_success',
          details: JSON.stringify({ url, requestTime, response: { resultCd: result.resultCd, resultMsg: result.resultMsg, resultDt: result.resultDt } })
        });
      }
    }

    console.log('Main: Device initialization result:', result);
    return result.resultCd === '000' 
      ? { success: true, response: result }
      : { success: false, response: result };
  } catch (error) {
    console.error('Main: Initialize-device error:', error.message);
    if (sequelize()) {
      await models().Logs.create({
        eventType: 'initialization_error',
        details: JSON.stringify({ url, requestTime: new Date().toISOString(), response: error.response?.data || error.message })
      });
    }
    return { success: false, error: error.message, response: error.response?.data || {} };
  }
});

ipcMain.handle('reset-initialization', async (event) => {
  console.log('Main: Resetting initialization');
  try {
    if (sequelize()) {
      await models().Init.destroy({ where: {}, truncate: true });
      event.sender.send('notice', { eventType: 'Reset Initialization', details: 'Initialization data reset successfully' });
    }
    return { success: true };
  } catch (error) {
    console.error('Main: Reset-initialization error:', error.message);
    event.sender.send('notice', { eventType: 'Reset Initialization', details: `Reset failed: ${error.message}` });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-table-data', async (event, tableName) => {
  console.log(`Main: get-table-data called for table ${tableName}`);
  if (!sequelize()) {
    console.error('Main: get-table-data: Sequelize not initialized');
    event.sender.send('notice', { eventType: 'DB Error', details: 'Database not initialized' });
    return [];
  }
  
  const Model = models()[tableName];
  if (!Model) {
    console.error(`Main: get-table-data: Model for table ${tableName} not found`);
    event.sender.send('notice', { eventType: 'DB Error', details: `Model for table ${tableName} not found` });
    return [];
  }
  
  try {
    const data = await Model.findAll({ 
      order: [['createdAt', 'DESC']], 
      limit: 1000, // Limit to prevent overwhelming the UI
      raw: true
    });
    console.log(`Main: get-table-data: Retrieved ${data.length} records from ${tableName}`);
    event.sender.send('notice', { eventType: 'Database Query', details: `Fetched ${data.length} records from ${tableName}` });
    return data;
  } catch (error) {
    console.error(`Main: get-table-data: Error fetching ${tableName}: ${error.message}`);
    event.sender.send('notice', { eventType: 'DB Error', details: `Failed to fetch ${tableName}: ${error.message}` });
    return [];
  }
});

ipcMain.handle('get-processed-docs', async (event, table, offset = 0, limit = 100) => {
  console.log(`Main: get-processed-docs called for table ${table}, offset ${offset}, limit ${limit}`);
  if (!sequelize()) {
    console.error('Main: get-processed-docs: Sequelize not initialized');
    event.sender.send('notice', { eventType: 'DB Error', details: 'Database not initialized' });
    return [];
  }
  const Model = models()[table];
  if (!Model) {
    console.error(`Main: get-processed-docs: Model for table ${table} not found`);
    event.sender.send('notice', { eventType: 'DB Error', details: `Model for table ${table} not found` });
    return [];
  }
  try {
    const docs = await Model.findAll({ 
      order: [['receivedAt', 'DESC']], 
      offset, 
      limit,
      raw: true // Ensure raw data for easier inspection
    });
    console.log(`Main: get-processed-docs: Retrieved ${docs.length} raw records from ${table}`);
    console.log('Main: Raw data from query:', JSON.stringify(docs, null, 2));
    event.sender.send('notice', { eventType: 'Endpoint Hit', details: `Fetched ${docs.length} records from ${table}` });
    return docs;
  } catch (error) {
    console.error(`Main: get-processed-docs: Error fetching ${table}: ${error.message}`);
    event.sender.send('notice', { eventType: 'DB Error', details: `Failed to fetch ${table}: ${error.message}` });
    return [];
  }
});

ipcMain.handle('get-notices', async () => {
  console.log('Main: get-notices called');
  if (!sequelize()) {
    console.error('Main: get-notices: Sequelize not initialized');
    return [];
  }
  try {
    const logs = await models().Logs.findAll({ order: [['timestamp', 'DESC']] });
    console.log(`Main: get-notices: Returning ${logs.length} logs`);
    return logs;
  } catch (error) {
    console.error('Main: get-notices error:', error.message);
    return [];
  }
});

ipcMain.handle('check-init-records', async (event) => {
  console.log('Main: check-init-records called');
  try {
    if (sequelize()) {
      const count = await models().Init.count();
      console.log(`Main: check-init-records: Found ${count} initialization records`);
      event.sender.send('notice', { eventType: 'Init Check', details: `Found ${count} initialization records` });
      return { hasRecords: count > 0 };
    }
    console.log('Main: check-init-records: No sequelize instance');
    return { hasRecords: false };
  } catch (error) {
    console.error('Main: check-init-records error:', error.message);
    event.sender.send('notice', { eventType: 'Init Check', details: `Check failed: ${error.message}` });
    return { hasRecords: false };
  }
});

ipcMain.handle('get-last-get-time', async () => {
  console.log('Main: get-last-get-time called');
  if (!sequelize()) {
    console.error('Main: get-last-get-time: Sequelize not initialized');
    return [];
  }
  try {
    const records = await models().LastGetTime.findAll({
      order: [['updatedAt', 'DESC']],
      raw: true
    });
    console.log(`Main: get-last-get-time: Returning ${records.length} records`);
    return records;
  } catch (error) {
    console.error('Main: get-last-get-time error:', error.message);
    return [];
  }
});

ipcMain.handle('get-table-counts', async () => {
  console.log('Main: get-table-counts called');
  if (!sequelize()) {
    console.error('Main: get-table-counts: Sequelize not initialized');
    return { standardCodes: 0, itemCodes: 0, notices: 0 };
  }
  try {
    const [standardCodes, itemCodes, notices] = await Promise.all([
      models().StandardCodes.count(),
      models().ItemClassCodes.count(),
      models().ZRANotices.count()
    ]);
    console.log(`Main: get-table-counts: StandardCodes=${standardCodes}, ItemCodes=${itemCodes}, Notices=${notices}`);
    return { standardCodes, itemCodes, notices };
  } catch (error) {
    console.error('Main: get-table-counts error:', error.message);
    return { standardCodes: 0, itemCodes: 0, notices: 0 };
  }
});

ipcMain.handle('get-last-req-dt', async (event, processName) => {
  console.log(`Main: get-last-req-dt called for ${processName}`);
  
  if (!sequelize()) {
    console.error('Main: get-last-req-dt: Sequelize not initialized');
    return '20231215000000';
  }
  
  try {
    let lastReqDt = '20231215000000';
    
    if (processName === 'ImportsData') {
      const record = await models().ImportsData.findOne({
        attributes: ['System_Request_date'],
        order: [['System_Request_date', 'DESC']],
        limit: 1
      });
      if (record && record.System_Request_date) {
        lastReqDt = record.System_Request_date;
      }
    } else if (processName === 'PurchasesData') {
      const record = await models().PurchasesData.findOne({
        attributes: ['System_Request_date'],
        order: [['System_Request_date', 'DESC']],
        limit: 1
      });
      if (record && record.System_Request_date) {
        lastReqDt = record.System_Request_date;
      }
    } else {
      // Fallback to LastGetTime table for other processes
      const record = await models().LastGetTime.findOne({
        where: { process: processName },
        order: [['updatedAt', 'DESC']]
      });
      if (record && record.lastReqDt) {
        lastReqDt = record.lastReqDt;
      }
    }
    
    console.log(`Main: Found last request date for ${processName}: ${lastReqDt}`);
    return lastReqDt;
  } catch (error) {
    console.error('Main: get-last-req-dt error:', error.message);
    return '20231215000000';
  }
});

ipcMain.handle('fetch-imports-data', async (event, payload) => {
  console.log('Main: fetch-imports-data called with payload:', payload);
  try {
    const baseUrl = store.get('initDetails')?.url?.replace('/initializer/selectInitInfo', '') || 'http://localhost:8080/sandboxvsdc1.0.7.5';
    const url = `${baseUrl}/imports/selectImportItems`;
    
    let currentDate = payload.lastReqDt;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    let totalCount = 0;
    
    while (currentDate < today) {
      const requestPayload = {
        tpin: payload.tpin,
        bhfId: payload.bhfId,
        lastReqDt: currentDate
      };
      
      const response = await axios.post(url, requestPayload, { timeout: 10000 });
      const result = response.data;
      
      if (result.resultCd === '000' && result.data && result.data.itemList) {
        const items = result.data.itemList;
        
        for (const item of items) {
          const systemRequestDate = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
          await models().ImportsData.create({
            ...item,
            System_Request_date: systemRequestDate,
            originalPayload: JSON.stringify(requestPayload),
            processedPayload: JSON.stringify(item),
            response: JSON.stringify(result),
            status: 'pending'
          });
          totalCount++;
        }
        
        currentDate = result.resultDt || incrementDate(currentDate);
      } else {
        currentDate = incrementDate(currentDate);
      }
      
      // Add small delay to prevent API overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update the LastGetTime record with the current date
    await models().LastGetTime.upsert({
      process: 'ImportsData',
      lastReqDt: today
    });
    
    // Store the updated date in electron-store for persistence
    store.set('lastReqDt_ImportsData', today);
    
    event.sender.send('notice', { eventType: 'Imports Fetch', details: `Fetched ${totalCount} import records` });
    return { success: true, count: totalCount, newLastReqDt: today };
    
  } catch (error) {
    console.error('Main: fetch-imports-data error:', error.message);
    event.sender.send('notice', { eventType: 'Imports Fetch Error', details: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-purchases-data', async (event, payload) => {
  console.log('Main: fetch-purchases-data called with payload:', payload);
  try {
    const baseUrl = store.get('initDetails')?.url?.replace('/initializer/selectInitInfo', '') || 'http://localhost:8080/sandboxvsdc1.0.7.5';
    const url = `${baseUrl}/trnsPurchase/selectTrnsPurchaseSales`;
    
    let currentDate = payload.lastReqDt;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    let totalCount = 0;
    
    while (currentDate < today) {
      const requestPayload = {
        tpin: payload.tpin,
        bhfId: payload.bhfId,
        lastReqDt: currentDate
      };
      
      const response = await axios.post(url, requestPayload, { timeout: 10000 });
      const result = response.data;
      
      if (result.resultCd === '000' && result.data && result.data.saleList) {
        const sales = result.data.saleList;
        
        for (const sale of sales) {
          if (sale.itemList && sale.itemList.length > 0) {
            for (const item of sale.itemList) {
              const systemRequestDate = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
              await models().PurchasesData.create({
                ...sale,
                ...item,
                totAmtItem: item.totAmt,
                System_Request_date: systemRequestDate,
                originalPayload: JSON.stringify(requestPayload),
                processedPayload: JSON.stringify({...sale, ...item}),
                response: JSON.stringify(result),
                status: 'pending'
              });
              totalCount++;
            }
          }
        }
        
        currentDate = result.resultDt || incrementDate(currentDate);
      } else {
        currentDate = incrementDate(currentDate);
      }
      
      // Add small delay to prevent API overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update the LastGetTime record
    await models().LastGetTime.upsert({
      process: 'PurchasesData',
      lastReqDt: today
    });
    
    // Store the updated date in electron-store for persistence
    store.set('lastReqDt_PurchasesData', today);
    
    event.sender.send('notice', { eventType: 'Purchases Fetch', details: `Fetched ${totalCount} purchase records` });
    return { success: true, count: totalCount, newLastReqDt: today };
    
  } catch (error) {
    console.error('Main: fetch-purchases-data error:', error.message);
    event.sender.send('notice', { eventType: 'Purchases Fetch Error', details: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-imports-data', async (event) => {
  console.log('Main: get-imports-data called');
  if (!sequelize()) {
    console.error('Main: get-imports-data: Sequelize not initialized');
    return [];
  }
  try {
    const data = await models().ImportsData.findAll({
      order: [['System_Request_date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000,
      raw: true
    });
    return data;
  } catch (error) {
    console.error('Main: get-imports-data error:', error.message);
    return [];
  }
});

ipcMain.handle('get-purchases-data', async (event) => {
  console.log('Main: get-purchases-data called');
  if (!sequelize()) {
    console.error('Main: get-purchases-data: Sequelize not initialized');
    return [];
  }
  try {
    const data = await models().PurchasesData.findAll({
      order: [['System_Request_date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000,
      raw: true
    });
    return data;
  } catch (error) {
    console.error('Main: get-purchases-data error:', error.message);
    return [];
  }
});

ipcMain.handle('update-import-status', async (event, id, status) => {
  console.log(`Main: update-import-status called for id ${id} with status ${status}`);
  if (!sequelize()) {
    console.error('Main: update-import-status: Sequelize not initialized');
    return { success: false, error: 'Database not initialized' };
  }
  try {
    await models().ImportsData.update({ status }, { where: { id } });
    event.sender.send('notice', { eventType: 'Import Status Update', details: `Import record ${id} ${status}` });
    return { success: true };
  } catch (error) {
    console.error('Main: update-import-status error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-purchase-status', async (event, id, status) => {
  console.log(`Main: update-purchase-status called for id ${id} with status ${status}`);
  if (!sequelize()) {
    console.error('Main: update-purchase-status: Sequelize not initialized');
    return { success: false, error: 'Database not initialized' };
  }
  try {
    await models().PurchasesData.update({ status }, { where: { id } });
    event.sender.send('notice', { eventType: 'Purchase Status Update', details: `Purchase record ${id} ${status}` });
    return { success: true };
  } catch (error) {
    console.error('Main: update-purchase-status error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-filtered-imports-data', async (event, startDate, endDate) => {
  console.log(`Main: get-filtered-imports-data called for date range ${startDate} to ${endDate}`);
  if (!sequelize()) {
    console.error('Main: get-filtered-imports-data: Sequelize not initialized');
    return [];
  }
  try {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.lte]: endDate
      };
    }
    
    const data = await models().ImportsData.findAll({
      where: whereClause,
      order: [['System_Request_date', 'DESC'], ['createdAt', 'DESC']],
      raw: true
    });
    return data;
  } catch (error) {
    console.error('Main: get-filtered-imports-data error:', error.message);
    return [];
  }
});

ipcMain.handle('get-filtered-purchases-data', async (event, startDate, endDate) => {
  console.log(`Main: get-filtered-purchases-data called for date range ${startDate} to ${endDate}`);
  if (!sequelize()) {
    console.error('Main: get-filtered-purchases-data: Sequelize not initialized');
    return [];
  }
  try {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.System_Request_date = {
        [models().Sequelize.Op.lte]: endDate
      };
    }
    
    const data = await models().PurchasesData.findAll({
      where: whereClause,
      order: [['System_Request_date', 'DESC'], ['createdAt', 'DESC']],
      raw: true
    });
    return data;
  } catch (error) {
    console.error('Main: get-filtered-purchases-data error:', error.message);
    return [];
  }
});

function incrementDate(dateStr) {
  const date = new Date(dateStr.slice(0, 4), dateStr.slice(4, 6) - 1, dateStr.slice(6, 8));
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '') + '000000';
}

app.whenReady().then(() => {
  console.log('Main: App is ready, creating window');
  createMainWindow();
});

app.on('window-all-closed', () => {
  console.log('Main: All windows closed');
  if (process.platform !== 'darwin') app.quit();
});