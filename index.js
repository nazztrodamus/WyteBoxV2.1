
const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();

let noticesData = [];
let unreadNotices = 0;
let dashboardInterval;
let systemStartTime = Date.now();

// Dashboard Functions
function updateDashboardStats() {
  updateConnectionStatus();
  updateSystemMetrics();
  updateDocumentCounts();
}

async function updateConnectionStatus() {
  // Database connection status
  try {
    const dbResult = await ipcRenderer.invoke('test-connection');
    const dbStatus = document.getElementById('dbConnectionStatus');
    const dbDetails = document.getElementById('dbConnectionDetails');
    
    if (dbResult && dbResult.success) {
      dbStatus.className = 'connection-status online';
      dbDetails.textContent = `Connected - ${dbResult.tables ? dbResult.tables.length : 0} tables`;
    } else {
      dbStatus.className = 'connection-status offline';
      dbDetails.textContent = 'Disconnected - Database not available';
    }
  } catch (error) {
    const dbStatus = document.getElementById('dbConnectionStatus');
    const dbDetails = document.getElementById('dbConnectionDetails');
    dbStatus.className = 'connection-status offline';
    dbDetails.textContent = `Error: ${error.message}`;
  }

  // VSDC connection status
  try {
    const initDetails = store.get('initDetails') || { url: 'http://localhost:8080/sandboxvsdc1.0.7.5/initializer/selectInitInfo' };
    const vsdcResult = await ipcRenderer.invoke('check-init-status', initDetails.url);
    const vsdcStatus = document.getElementById('vsdcConnectionStatus');
    const vsdcDetails = document.getElementById('vsdcConnectionDetails');
    const topNavVsdc = document.getElementById('vsdcStatus');
    
    if (vsdcResult && vsdcResult.running) {
      vsdcStatus.className = 'connection-status online';
      vsdcDetails.textContent = 'Connected - Server running normally';
      topNavVsdc.className = 'status-indicator online';
      topNavVsdc.querySelector('.connection-status').className = 'connection-status online';
    } else {
      vsdcStatus.className = 'connection-status offline';
      vsdcDetails.textContent = 'Disconnected - Server not accessible';
      topNavVsdc.className = 'status-indicator offline';
      topNavVsdc.querySelector('.connection-status').className = 'connection-status offline';
    }
  } catch (error) {
    const vsdcStatus = document.getElementById('vsdcConnectionStatus');
    const vsdcDetails = document.getElementById('vsdcConnectionDetails');
    const topNavVsdc = document.getElementById('vsdcStatus');
    
    vsdcStatus.className = 'connection-status offline';
    vsdcDetails.textContent = `Error: ${error.message}`;
    topNavVsdc.className = 'status-indicator offline';
    topNavVsdc.querySelector('.connection-status').className = 'connection-status offline';
  }

  // Internet status (simulate check)
  updateInternetStatus();
}

function updateInternetStatus() {
  const internetStatus = document.getElementById('internetStatus');
  // Simple online check
  if (navigator.onLine) {
    internetStatus.className = 'status-indicator online';
    internetStatus.querySelector('.connection-status').className = 'connection-status online';
  } else {
    internetStatus.className = 'status-indicator offline';
    internetStatus.querySelector('.connection-status').className = 'connection-status offline';
  }
}

function updateSystemMetrics() {
  // System uptime
  const uptime = Math.floor((Date.now() - systemStartTime) / (1000 * 60 * 60));
  document.getElementById('systemUptime').textContent = uptime;

  // Simulate performance metrics (in a real app, these would come from actual system monitoring)
  document.getElementById('memoryUsage').textContent = `${Math.floor(Math.random() * 40 + 30)}%`;
  document.getElementById('cpuUsage').textContent = `${Math.floor(Math.random() * 20 + 10)}%`;
  document.getElementById('activeConnections').textContent = Math.floor(Math.random() * 10 + 1);
  document.getElementById('responseTime').textContent = `${Math.floor(Math.random() * 100 + 50)}ms`;
}

async function updateDocumentCounts() {
  try {
    // Get sales invoices count
    const salesDocs = await ipcRenderer.invoke('get-processed-docs', 'SalesInvoices', 0, 1000);
    document.getElementById('salesCount').textContent = salesDocs ? salesDocs.length : 0;
    document.getElementById('salesChange').textContent = '+12% from last month';

    // Get purchase invoices count
    const purchaseDocs = await ipcRenderer.invoke('get-processed-docs', 'PurchaseInvoices', 0, 1000);
    document.getElementById('purchaseCount').textContent = purchaseDocs ? purchaseDocs.length : 0;
    document.getElementById('purchaseChange').textContent = '+8% from last month';

    // Get items count
    const itemsDocs = await ipcRenderer.invoke('get-processed-docs', 'Items', 0, 1000);
    document.getElementById('itemsCount').textContent = itemsDocs ? itemsDocs.length : 0;
    document.getElementById('itemsChange').textContent = '+5% from last month';
  } catch (error) {
    console.error('Error updating document counts:', error);
  }
}

// Status Functions
function setDbStatus(message, success) {
  console.log(`Setting DB status: ${message}`);
  const status = document.getElementById('dbStatus');
  if (status) {
    status.className = success ? 'status success' : 'status error';
    status.innerHTML = `<i class="fas ${success ? 'fa-check' : 'fa-times'}"></i> ${message}`;
  }
}

function setInitStatus(message, success) {
  console.log(`Setting init status: ${message}`);
  const status = document.getElementById('initStatus');
  if (status) {
    status.className = success ? 'status success' : 'status error';
    status.innerHTML = `<i class="fas ${success ? 'fa-check' : 'fa-times'}"></i> ${message}`;
  }
}

// Navigation
function showSection(id) {
  console.log(`showSection: Showing section ${id}`);
  
  // Update active section
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  const section = document.getElementById(id);
  if (section) {
    section.classList.add('active');
  } else {
    console.error(`showSection: Section ${id} not found`);
    addNotice('Rendering Error', `Section ${id} not found in DOM`);
    return;
  }
  
  // Update active nav item
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.sidebar a[onclick="showSection('${id}')"]`);
  if (link) link.classList.add('active');

  // Load section-specific data
  if (id === 'dashboard') {
    startDashboardUpdates();
  } else {
    stopDashboardUpdates();
  }
  
  if (id === 'defaultsSetup') loadDefaults();
  if (id === 'processedDocs') loadProcessedDocs();
  if (id === 'notices') showNotices();
  if (id === 'deviceInit') {
    startStatusPolling();
    checkInitRecordsAndStatus();
  }
  if (id === 'payloads') loadPayloads();
  if (id === 'imports') loadImportsSection();
  if (id === 'purchases') loadPurchasesSection();
}

function startDashboardUpdates() {
  updateDashboardStats();
  getTableCounts();
  dashboardInterval = setInterval(() => {
    updateDashboardStats();
    getTableCounts();
  }, 30000); // Update every 30 seconds
}

function stopDashboardUpdates() {
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }
}

// Database Functions
let currentTableData = [];
let currentSearchResults = [];

async function refreshDatabase() {
  console.log('Refreshing database');
  const dbInfo = document.getElementById('dbConnectionInfo');
  dbInfo.textContent = 'Checking database status...';
  dbInfo.className = 'status info';

  try {
    const result = await ipcRenderer.invoke('test-connection');
    
    if (result.success) {
      dbInfo.textContent = `Database connected: ${result.dbPath}`;
      dbInfo.className = 'status success';
      
      // Clear current table selection
      document.getElementById('tableSelect').value = '';
      clearTableData();
    } else {
      dbInfo.textContent = `Database error: ${result.error}`;
      dbInfo.className = 'status error';
    }
  } catch (error) {
    dbInfo.textContent = `Connection error: ${error.message}`;
    dbInfo.className = 'status error';
  }
}

async function loadTableData() {
  const tableSelect = document.getElementById('tableSelect');
  const selectedTable = tableSelect.value;
  
  if (!selectedTable) {
    clearTableData();
    return;
  }

  const container = document.getElementById('tableDataContainer');
  container.innerHTML = '<div class="text-center" style="padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading table data...</div>';

  try {
    const data = await ipcRenderer.invoke('get-table-data', selectedTable);
    currentTableData = data;
    displayTableData(data, selectedTable);
    showTableInfo(selectedTable, data.length);
  } catch (error) {
    container.innerHTML = `<div class="text-center" style="padding: 40px; color: var(--error-color);"><i class="fas fa-exclamation-triangle"></i> Error loading table: ${error.message}</div>`;
  }
}

function displayTableData(data, tableName) {
  const container = document.getElementById('tableDataContainer');
  const recordCount = document.getElementById('recordCount');
  
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-secondary);"><i class="fas fa-database"></i> No records found</div>';
    recordCount.textContent = '0 records';
    return;
  }

  recordCount.textContent = `${data.length} records`;
  
  // Get all unique keys from the data
  const keys = [...new Set(data.flatMap(Object.keys))];
  
  let html = '<table class="table"><thead><tr>';
  keys.forEach(key => {
    html += `<th>${key}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  data.forEach(row => {
    html += '<tr>';
    keys.forEach(key => {
      let value = row[key];
      // Format the value for display
      if (value === null || value === undefined) {
        value = '<span style="color: var(--text-secondary);">NULL</span>';
      } else if (typeof value === 'string' && value.length > 100) {
        value = `<span title="${value.replace(/"/g, '&quot;')}">${value.substring(0, 100)}...</span>`;
      } else if (typeof value === 'object') {
        value = `<span title="${JSON.stringify(value).replace(/"/g, '&quot;')}">${JSON.stringify(value).substring(0, 100)}...</span>`;
      }
      html += `<td>${value}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function showTableInfo(tableName, recordCount) {
  const tableInfo = document.getElementById('tableInfo');
  const tableInfoContent = document.getElementById('tableInfoContent');
  
  const tableDescriptions = {
    'SalesInvoices': 'Sales invoice transactions and their processing status',
    'PurchaseInvoices': 'Purchase invoice transactions and their processing status',
    'Items': 'Item master data and product information',
    'Stocks': 'Stock movement and inventory transactions',
    'Imports': 'Import declaration data and processing status',
    'ImportsData': 'Fetched import items with approval status',
    'PurchasesData': 'Fetched purchase transactions with approval status',
    'Logs': 'System activity logs and events',
    'Init': 'Device initialization and configuration data',
    'StandardCodes': 'Standard code definitions from ZRA',
    'ItemClassCodes': 'Item classification codes from ZRA',
    'LastGetTime': 'Last synchronization timestamps for data fetching',
    'ZRANotices': 'Official notices and announcements from ZRA'
  };
  
  tableInfoContent.innerHTML = `
    <div class="metric-grid">
      <div class="metric-item">
        <div class="metric-value">${recordCount}</div>
        <div class="metric-label">Total Records</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${tableName}</div>
        <div class="metric-label">Table Name</div>
      </div>
    </div>
    <p style="margin-top: 16px; color: var(--text-secondary);">${tableDescriptions[tableName] || 'No description available'}</p>
  `;
  
  tableInfo.style.display = 'block';
}

function clearTableData() {
  document.getElementById('tableDataContainer').innerHTML = `
    <div id="noTableSelected" class="text-center" style="padding: 40px; color: var(--text-secondary);">
      <i class="fas fa-table" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>Select a table to view its data</p>
    </div>
  `;
  document.getElementById('recordCount').textContent = '';
  document.getElementById('tableInfo').style.display = 'none';
  document.getElementById('searchInput').value = '';
}

function searchTable() {
  const searchInput = document.getElementById('searchInput');
  const searchTerm = searchInput.value.toLowerCase().trim();
  const tableSelect = document.getElementById('tableSelect');
  
  if (!searchTerm) {
    displayTableData(currentTableData, tableSelect.value);
    return;
  }
  
  if (!currentTableData || currentTableData.length === 0) {
    return;
  }
  
  const filteredData = currentTableData.filter(row => {
    return Object.values(row).some(value => {
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(searchTerm);
    });
  });
  
  currentSearchResults = filteredData;
  displayTableData(filteredData, tableSelect.value);
  
  // Update record count to show search results
  const recordCount = document.getElementById('recordCount');
  recordCount.textContent = `${filteredData.length} of ${currentTableData.length} records`;
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const tableSelect = document.getElementById('tableSelect');
  
  searchInput.value = '';
  currentSearchResults = [];
  displayTableData(currentTableData, tableSelect.value);
  
  // Reset record count
  const recordCount = document.getElementById('recordCount');
  recordCount.textContent = `${currentTableData.length} records`;
}

function exportTableData() {
  const tableSelect = document.getElementById('tableSelect');
  const selectedTable = tableSelect.value;
  
  if (!selectedTable) {
    alert('Please select a table first');
    return;
  }
  
  const dataToExport = currentSearchResults.length > 0 ? currentSearchResults : currentTableData;
  
  if (!dataToExport || dataToExport.length === 0) {
    alert('No data to export');
    return;
  }
  
  // Get all unique keys
  const keys = [...new Set(dataToExport.flatMap(Object.keys))];
  
  let csv = [];
  csv.push(keys.join(','));
  
  dataToExport.forEach(row => {
    const values = keys.map(key => {
      let value = row[key];
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csv.push(values.join(','));
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedTable}_export.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function createDatabase() {
  console.log('Creating database');
  const dbInfo = document.getElementById('dbConnectionInfo');
  dbInfo.textContent = 'Creating/resetting database...';
  dbInfo.className = 'status info';

  try {
    const result = await ipcRenderer.invoke('create-database');
    
    if (createBtn) createBtn.disabled = false;
    if (result.success) {
      setDbStatus(`Database created with tables: ${result.tables.join(', ')}`, true);
      const testBtn = document.querySelector('#dbSetup .btn-primary');
      if (testBtn) testBtn.disabled = true;
    } else {
      setDbStatus(`Failed to create database: ${result.error}`, false);
    }
  } catch (error) {
    if (createBtn) createBtn.disabled = false;
    setDbStatus(`Creation error: ${error.message}`, false);
  }
}

async function resetConnection() {
  console.log('Resetting connection');
  setDbStatus('Resetting connection...', true);
  await ipcRenderer.invoke('reset-connection');
  store.delete('dbConfig');
  const testBtn = document.querySelector('#dbSetup .btn-primary');
  const createBtn = document.getElementById('createDbBtn');
  if (testBtn) testBtn.disabled = false;
  if (createBtn) createBtn.disabled = true;
  setDbStatus('Connection reset. Please test a new connection.', true);
}

async function dumpDatabase() {
  if (!confirm('Are you sure you want to delete the entire database? This action cannot be undone.')) {
    return;
  }

  console.log('Dumping database');
  setDbStatus('Deleting database...', true);
  
  try {
    const result = await ipcRenderer.invoke('dump-database');
    if (result.success) {
      setDbStatus('Database deleted successfully', true);
      const testBtn = document.querySelector('#dbSetup .btn-primary');
      const createBtn = document.getElementById('createDbBtn');
      if (testBtn) testBtn.disabled = false;
      if (createBtn) createBtn.disabled = false;
    } else {
      setDbStatus(`Failed to delete database: ${result.error}`, false);
    }
  } catch (error) {
    setDbStatus(`Delete error: ${error.message}`, false);
  }
}

// Comprehensive Sync Functions
async function triggerComprehensiveSync() {
  const confirmMessage = 'This will sync all ItemClassCodes, StandardCodes, and ZRANotices from 2024-01-01 to current date and remove duplicates. This may take several minutes. Continue?';
  
  if (!confirm(confirmMessage)) {
    return;
  }

  const syncBtn = document.getElementById('comprehensiveSyncBtn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
  }

  try {
    const response = await fetch('/trigger-comprehensive-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ securityKey: store.get('securityKey') || 'defaultKey123' })
    });

    const result = await response.json();
    
    if (result.success) {
      addNotice('Comprehensive Sync', 'Comprehensive sync started successfully');
    } else {
      addNotice('Comprehensive Sync Error', `Failed to start sync: ${result.error}`);
    }
  } catch (error) {
    addNotice('Comprehensive Sync Error', `Request failed: ${error.message}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Start Comprehensive Sync';
    }
  }
}

async function getTableCounts() {
  try {
    const counts = await ipcRenderer.invoke('get-table-counts');
    
    document.getElementById('standardCodesCount').textContent = counts.standardCodes;
    document.getElementById('itemCodesCount').textContent = counts.itemCodes;
    document.getElementById('zraNoticesCount').textContent = counts.notices;
  } catch (error) {
    console.error('Error getting table counts:', error);
    // Fallback to 0 if error
    document.getElementById('standardCodesCount').textContent = 0;
    document.getElementById('itemCodesCount').textContent = 0;
    document.getElementById('zraNoticesCount').textContent = 0;
  }
}

// Device Initialization Functions
async function checkStatus() {
  console.log('Checking status');
  const initDetails = store.get('initDetails') || { url: 'http://localhost:8080/sandboxvsdc1.0.7.5/initializer/selectInitInfo' };
  try {
    const result = await ipcRenderer.invoke('check-init-status', initDetails.url);
    setInitStatus(result.running ? 'Running and connection is healthy' : 'Not connected or running', result.running);
  } catch (error) {
    setInitStatus(`Status check failed: ${error.message}`, false);
  }
}

async function initialize() {
  const initDetails = store.get('initDetails');
  if (!initDetails?.url) {
    alert('Please set initialization URL in Configuration');
    return;
  }

  setInitStatus('Initializing device...', true);
  const initBtn = document.getElementById('initBtn');
  if (initBtn) initBtn.disabled = true;

  try {
    const branch = document.getElementById('initBranch').value;
    const payload = {
      tpin: initDetails.tpin || '1000000000',
      bhfId: branch,
      dvcSrlNo: initDetails.deviceSerial || '20180520000000'
    };

    const result = await ipcRenderer.invoke('initialize-device', initDetails.url, payload);
    
    if (initBtn) initBtn.disabled = false;
    if (result.success) {
      setInitStatus('Device initialized successfully', true);
    } else {
      setInitStatus(`Initialization failed: ${result.error || result.response?.resultMsg}`, false);
    }
  } catch (error) {
    if (initBtn) initBtn.disabled = false;
    setInitStatus(`Initialization error: ${error.message}`, false);
  }
}

async function resetInitialization() {
  if (!confirm('Are you sure you want to reset the initialization? This will clear all initialization data.')) {
    return;
  }

  try {
    const result = await ipcRenderer.invoke('reset-initialization');
    if (result.success) {
      setInitStatus('Initialization reset successfully', true);
    } else {
      setInitStatus(`Reset failed: ${result.error}`, false);
    }
  } catch (error) {
    setInitStatus(`Reset error: ${error.message}`, false);
  }
}

async function checkInitRecordsAndStatus() {
  try {
    const result = await ipcRenderer.invoke('check-init-records');
    if (result.hasRecords) {
      setInitStatus('Device already initialized', true);
    } else {
      await checkStatus();
    }
  } catch (error) {
    setInitStatus(`Check failed: ${error.message}`, false);
  }
}

let pollingInterval;
function startStatusPolling() {
  clearInterval(pollingInterval);
  checkStatus();
  pollingInterval = setInterval(checkStatus, 60000); // Poll every 60 seconds
}

// Notice Functions
function addNotice(eventType, details) {
  const notice = {
    eventType,
    details,
    timestamp: new Date().toISOString(),
    read: false
  };
  noticesData.unshift(notice);
  unreadNotices++;
  updateNoticesTable();
  updateUnreadCount();
}

function updateNoticesTable() {
  const tbody = document.querySelector('#noticesTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  noticesData.slice(0, 100).forEach(notice => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><span class="badge ${getBadgeClass(notice.eventType)}">${notice.eventType}</span></td>
      <td>${notice.details}</td>
      <td>${formatTimestamp(notice.timestamp)}</td>
    `;
  });
}

function getBadgeClass(eventType) {
  const type = eventType.toLowerCase();
  if (type.includes('error') || type.includes('failed')) return 'badge-error';
  if (type.includes('success') || type.includes('created')) return 'badge-success';
  if (type.includes('warning')) return 'badge-warning';
  return 'badge-info';
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function updateUnreadCount() {
  const badge = document.getElementById('unreadCount');
  if (badge) {
    badge.textContent = unreadNotices;
    badge.style.display = unreadNotices > 0 ? 'flex' : 'none';
  }
}

function showNotices() {
  noticesData.forEach(notice => notice.read = true);
  unreadNotices = 0;
  updateUnreadCount();
  updateNoticesTable();
}

// Configuration Functions
function loadDefaults() {
  loadEndpointsTable();
  loadRoutesTable();
  
  const securityKey = store.get('securityKey') || 'defaultKey123';
  document.getElementById('securityKey').value = securityKey;
  
  const initDetails = store.get('initDetails') || {};
  document.getElementById('initUrl').value = initDetails.url || 'https://zra-vsdc-init';
  document.getElementById('companyTpin').value = initDetails.tpin || '1000000000';
  document.getElementById('companyBranch').value = initDetails.branch || '000';
  document.getElementById('deviceSerial').value = initDetails.deviceSerial || '20180520000000';
}

function loadEndpointsTable() {
  const table = document.getElementById('endpointsTable');
  const endpoints = store.get('savedEndpoints') || {
    salesInvoice: 'http://localhost:8080/sandboxvsdc1.0.7.5/trnsSales/saveSales',
    purchaseInvoice: 'http://localhost:8080/sandboxvsdc1.0.7.5/trnsPurchase/savePurchase',
    items: 'http://localhost:8080/sandboxvsdc1.0.7.5/items/saveItem',
    stock: 'http://localhost:8080/sandboxvsdc1.0.7.5/stock/saveStockItems',
    stockMaster: 'http://localhost:8080/sandboxvsdc1.0.7.5/stockMaster/saveStockMaster',
    imports: 'http://localhost:8080/sandboxvsdc1.0.7.5/imports/updateImportItems'
  };

  table.innerHTML = '<tr><th>Service</th><th>Endpoint URL</th></tr>';
  Object.entries(endpoints).forEach(([key, value]) => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>${key}</td>
      <td><input class="form-input" type="text" value="${value}" data-endpoint="${key}"></td>
    `;
  });
}

function loadRoutesTable() {
  const table = document.getElementById('routesTable');
  const routes = store.get('routes') || {
    'sales-invoice': 'SalesInvoices',
    'purchase-invoice': 'PurchaseInvoices',
    'items': 'Items',
    'stock': 'Stocks',
    'imports': 'Imports'
  };

  table.innerHTML = '<tr><th>Route</th><th>Model</th></tr>';
  Object.entries(routes).forEach(([key, value]) => {
    const row = table.insertRow();
    row.innerHTML = `
      <td>${key}</td>
      <td><input class="form-input" type="text" value="${value}" data-route="${key}"></td>
    `;
  });
}

function saveEndpoints() {
  const table = document.getElementById('endpointsTable');
  const inputs = table.querySelectorAll('input[data-endpoint]');
  const endpoints = {};
  
  inputs.forEach(input => {
    endpoints[input.dataset.endpoint] = input.value;
  });
  
  store.set('savedEndpoints', endpoints);
  addNotice('Configuration', 'Endpoints saved successfully');
}

function saveRoutes() {
  const table = document.getElementById('routesTable');
  const inputs = table.querySelectorAll('input[data-route]');
  const routes = {};
  
  inputs.forEach(input => {
    routes[input.dataset.route] = input.value;
  });
  
  store.set('routes', routes);
  addNotice('Configuration', 'Routes saved successfully');
}

function saveSecurityKey() {
  const key = document.getElementById('securityKey').value;
  store.set('securityKey', key);
  addNotice('Configuration', 'Security key saved successfully');
}

function saveInitDetails() {
  const initDetails = {
    url: document.getElementById('initUrl').value,
    tpin: document.getElementById('companyTpin').value,
    branch: document.getElementById('companyBranch').value,
    deviceSerial: document.getElementById('deviceSerial').value
  };
  store.set('initDetails', initDetails);
  addNotice('Configuration', 'Initialization details saved successfully');
}

// Document Functions
async function loadProcessedDocs() {
  const tables = ['SalesInvoices', 'PurchaseInvoices', 'Items', 'Stocks', 'Imports'];
  const tbody = document.querySelector('#docsTable tbody');
  tbody.innerHTML = '';

  for (const table of tables) {
    try {
      const docs = await ipcRenderer.invoke('get-processed-docs', table, 0, 50);
      docs.forEach(doc => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${table}</td>
          <td>${doc.originalPayload ? 'Yes' : 'No'}</td>
          <td>${doc.processedPayload ? 'Yes' : 'No'}</td>
          <td>${doc.response ? 'Yes' : 'No'}</td>
          <td>${formatTimestamp(doc.receivedAt)}</td>
        `;
      });
    } catch (error) {
      console.error(`Error loading ${table}:`, error);
    }
  }
}

async function loadPayloads() {
  try {
    const records = await ipcRenderer.invoke('get-last-get-time');
    const tbody = document.querySelector('#payloadsTable tbody');
    tbody.innerHTML = '';
    
    records.forEach(record => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${record.process}</td>
        <td>${record.lastReqDt}</td>
        <td>${formatTimestamp(record.updatedAt)}</td>
      `;
    });
  } catch (error) {
    console.error('Error loading payloads:', error);
  }
}

// Utility Functions
function exportToCSV(tableId) {
  const table = document.getElementById(tableId);
  let csv = [];
  
  // Get headers
  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
  csv.push(headers.join(','));
  
  // Get data rows
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td')).map(td => `"${td.textContent}"`);
    csv.push(cells.join(','));
  });
  
  // Download
  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tableId}_export.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Imports Management Functions
let currentImportsData = [];

async function loadImportsSection() {
  await loadLastReqDt('ImportsData', 'importsLastReqDt');
  await refreshImportsDisplay();
}

async function loadLastReqDt(tableName, inputId) {
  try {
    const lastReqDt = await ipcRenderer.invoke('get-last-req-dt', tableName);
    const input = document.getElementById(inputId);
    input.value = lastReqDt;
  } catch (error) {
    console.error(`Error loading last request date for ${tableName}:`, error);
    document.getElementById(inputId).value = '20231215000000';
  }
}

async function fetchImportsData() {
  const btn = document.getElementById('fetchImportsBtn');
  const status = document.getElementById('importsStatus');
  const lastReqDtInput = document.getElementById('importsLastReqDt');
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
  status.style.display = 'block';
  status.className = 'status info';
  status.textContent = 'Fetching imports data...';

  try {
    const initDetails = store.get('initDetails') || {};
    const tpin = initDetails.tpin || '2001188640';
    const bhfId = initDetails.branch || '000';
    const lastReqDt = lastReqDtInput.value || '20241215000000';

    const result = await ipcRenderer.invoke('fetch-imports-data', {
      tpin: tpin,
      bhfId: bhfId,
      lastReqDt: lastReqDt
    });

    if (result.success) {
      status.className = 'status success';
      status.textContent = `Successfully fetched ${result.count} import records`;
      
      // Update last request date
      lastReqDtInput.value = result.newLastReqDt;
      
      await refreshImportsDisplay();
      addNotice('Imports Fetch', `Fetched ${result.count} import records`);
    } else {
      status.className = 'status error';
      status.textContent = `Fetch failed: ${result.error}`;
      addNotice('Imports Fetch Error', result.error);
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Fetch error: ${error.message}`;
    addNotice('Imports Fetch Error', error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download"></i> Fetch Imports Data';
  }
}

async function refreshImportsDisplay() {
  try {
    const data = await ipcRenderer.invoke('get-imports-data');
    currentImportsData = data;
    displayImportsData(data);
  } catch (error) {
    console.error('Error refreshing imports display:', error);
  }
}

function displayImportsData(data) {
  const container = document.getElementById('importsTableContainer');
  const recordCount = document.getElementById('importsRecordCount');
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div id="noImportsData" class="text-center" style="padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-ship" style="font-size: 48px; margin-bottom: 16px;"></i>
        <p>No imports data available. Click "Fetch Imports Data" to load data.</p>
      </div>
    `;
    recordCount.textContent = '0 records';
    return;
  }

  recordCount.textContent = `${data.length} records`;
  
  // Add export controls before the table
  let exportControls = `
    <div style="margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
      <label style="font-weight: bold;">Export Date Range:</label>
      <input type="text" id="importsStartDate" placeholder="YYYYMMDD000000" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      <span>to</span>
      <input type="text" id="importsEndDate" placeholder="YYYYMMDD000000" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      <button class="btn btn-secondary" onclick="exportFilteredImportsData()">
        <i class="fas fa-download"></i> Export Filtered
      </button>
      <button class="btn btn-secondary" onclick="exportImportsData()">
        <i class="fas fa-download"></i> Export All
      </button>
    </div>
  `;
  
  let html = exportControls + `
    <table id="importsTable" class="table">
      <thead>
        <tr>
          <th>System Request Date</th>
          <th>Task Code</th>
          <th>Declaration Date</th>
          <th>Item Seq</th>
          <th>Declaration No</th>
          <th>HS Code</th>
          <th>Item Name</th>
          <th>Import Status Code</th>
          <th>Origin Country</th>
          <th>Export Country</th>
          <th>Package</th>
          <th>Package Unit</th>
          <th>Quantity</th>
          <th>Quantity Unit</th>
          <th>Total Weight</th>
          <th>Net Weight</th>
          <th>Supplier Name</th>
          <th>Agent Name</th>
          <th>Invoice FC Amount</th>
          <th>Invoice FC Currency</th>
          <th>Invoice FC Rate</th>
          <th>Declaration Ref No</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  data.forEach(row => {
    const statusClass = row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning';
    html += `
      <tr>
        <td>${row.System_Request_date || ''}</td>
        <td>${row.taskCd || ''}</td>
        <td>${row.dclDe || ''}</td>
        <td>${row.itemSeq || ''}</td>
        <td>${row.dclNo || ''}</td>
        <td>${row.hsCd || ''}</td>
        <td title="${row.itemNm || ''}">${(row.itemNm || '').substring(0, 30)}${(row.itemNm || '').length > 30 ? '...' : ''}</td>
        <td>${row.imptItemsttsCd || ''}</td>
        <td>${row.orgnNatCd || ''}</td>
        <td>${row.exptNatCd || ''}</td>
        <td>${row.pkg || ''}</td>
        <td>${row.pkgUnitCd || ''}</td>
        <td>${row.qty || ''}</td>
        <td>${row.qtyUnitCd || ''}</td>
        <td>${row.totWt || ''}</td>
        <td>${row.netWt || ''}</td>
        <td title="${row.spplrNm || ''}">${(row.spplrNm || '').substring(0, 20)}${(row.spplrNm || '').length > 20 ? '...' : ''}</td>
        <td title="${row.agntNm || ''}">${(row.agntNm || '').substring(0, 20)}${(row.agntNm || '').length > 20 ? '...' : ''}</td>
        <td>${row.invcFcurAmt || ''}</td>
        <td>${row.invcFcurCd || ''}</td>
        <td>${row.invcFcurExcrt || ''}</td>
        <td>${row.dclRefNum || ''}</td>
        <td><span class="badge badge-${statusClass}">${row.status}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-success" style="padding: 4px 8px; font-size: 12px;" onclick="updateImportStatus(${row.id}, 'approved')" ${row.status === 'approved' ? 'disabled' : ''}>
              <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="updateImportStatus(${row.id}, 'rejected')" ${row.status === 'rejected' ? 'disabled' : ''}>
              <i class="fas fa-times"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function updateImportStatus(id, action) {
  try {
    // Get the import record data
    const importData = currentImportsData.find(item => item.id === id);
    if (!importData) {
      addNotice('Import Status Error', 'Import record not found');
      return;
    }

    // Determine the imptItemSttsCd value based on action
    const imptItemSttsCd = action === 'approved' ? '3' : '4';
    
    // Get endpoints from configuration
    const endpoints = store.get('savedEndpoints') || {};
    const importsEndpoint = endpoints.imports || 'http://localhost:8080/sandboxvsdc1.0.7.5/imports/updateImportItems';
    
    // Get initialization details
    const initDetails = store.get('initDetails') || {};
    
    // Prepare payload for imports approval/rejection
    const payload = {
      tpin: initDetails.tpin || '2001188640',
      bhfId: initDetails.branch || '000',
      taskCd: importData.taskCd,
      dclDe: importData.dclDe,
      importItemList: [
        {
          itemSeq: importData.itemSeq,
          hsCd: importData.hsCd,
          itemClsCd: importData.itemClsCd || '',
          itemCd: importData.itemCd || '',
          imptItemSttsCd: imptItemSttsCd,
          remark: importData.remark || null,
          modrNm: initDetails.modrNm || '',
          modrId: initDetails.modrId || ''
        }
      ]
    };

    // Send to imports endpoint
    const response = await fetch(importsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.resultCd === '000') {
      // Update local database status
      const updateResult = await ipcRenderer.invoke('update-import-status', id, action);
      if (updateResult.success) {
        addNotice('Import Status', `Import record ${action} successfully`);
        
        // If approved, also send to stock master
        if (action === 'approved') {
          await sendToStockMaster(importData);
        }
        
        await refreshImportsDisplay();
      } else {
        addNotice('Import Status Error', updateResult.error);
      }
    } else {
      addNotice('Import Status Error', `Failed to ${action} import: ${result.resultMsg || 'Unknown error'}`);
    }
  } catch (error) {
    addNotice('Import Status Error', error.message);
  }
}

async function sendToStockMaster(importData) {
  try {
    const endpoints = store.get('savedEndpoints') || {};
    const stockMasterEndpoint = endpoints.stockMaster || 'http://localhost:8080/sandboxvsdc1.0.7.5/stockMaster/saveStockMaster';
    const initDetails = store.get('initDetails') || {};
    
    // Calculate stock quantity (using imported quantity)
    const rsdQty = parseFloat(importData.qty || 0);
    
    const stockPayload = {
      tpin: initDetails.tpin || '2001188640',
      bhfId: initDetails.branch || '000',
      regrId: initDetails.regrId || '',
      regrNm: initDetails.regrNm || '',
      modrNm: initDetails.modrNm || '',
      modrId: initDetails.modrId || '',
      stockItemList: [
        {
          itemCd: importData.itemCd || '',
          rsdQty: rsdQty
        }
      ]
    };

    const response = await fetch(stockMasterEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stockPayload)
    });

    const result = await response.json();
    
    if (response.ok && result.resultCd === '000') {
      addNotice('Stock Master Update', 'Stock master updated successfully');
    } else {
      addNotice('Stock Master Error', `Failed to update stock master: ${result.resultMsg || 'Unknown error'}`);
    }
  } catch (error) {
    addNotice('Stock Master Error', `Error updating stock master: ${error.message}`);
  }
}

// Purchases Management Functions
let currentPurchasesData = [];

async function loadPurchasesSection() {
  await loadLastReqDt('PurchasesData', 'purchasesLastReqDt');
  await refreshPurchasesDisplay();
}

async function fetchPurchasesData() {
  const btn = document.getElementById('fetchPurchasesBtn');
  const status = document.getElementById('purchasesStatus');
  const lastReqDtInput = document.getElementById('purchasesLastReqDt');
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
  status.style.display = 'block';
  status.className = 'status info';
  status.textContent = 'Fetching purchases data...';

  try {
    const initDetails = store.get('initDetails') || {};
    const tpin = initDetails.tpin || '2001188640';
    const bhfId = initDetails.branch || '000';
    const lastReqDt = lastReqDtInput.value || '20241215000000';

    const result = await ipcRenderer.invoke('fetch-purchases-data', {
      tpin: tpin,
      bhfId: bhfId,
      lastReqDt: lastReqDt
    });

    if (result.success) {
      status.className = 'status success';
      status.textContent = `Successfully fetched ${result.count} purchase records`;
      
      // Update last request date
      lastReqDtInput.value = result.newLastReqDt;
      
      await refreshPurchasesDisplay();
      addNotice('Purchases Fetch', `Fetched ${result.count} purchase records`);
    } else {
      status.className = 'status error';
      status.textContent = `Fetch failed: ${result.error}`;
      addNotice('Purchases Fetch Error', result.error);
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Fetch error: ${error.message}`;
    addNotice('Purchases Fetch Error', error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download"></i> Fetch Purchases Data';
  }
}

async function refreshPurchasesDisplay() {
  try {
    const data = await ipcRenderer.invoke('get-purchases-data');
    currentPurchasesData = data;
    displayPurchasesData(data);
  } catch (error) {
    console.error('Error refreshing purchases display:', error);
  }
}

function displayPurchasesData(data) {
  const container = document.getElementById('purchasesTableContainer');
  const recordCount = document.getElementById('purchasesRecordCount');
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div id="noPurchasesData" class="text-center" style="padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-shopping-cart" style="font-size: 48px; margin-bottom: 16px;"></i>
        <p>No purchases data available. Click "Fetch Purchases Data" to load data.</p>
      </div>
    `;
    recordCount.textContent = '0 records';
    return;
  }

  // Group data by invoice to show unique invoices
  const invoiceMap = new Map();
  data.forEach(row => {
    const key = `${row.spplrTpin}_${row.spplrInvcNo}`;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        ...row,
        items: []
      });
    }
    invoiceMap.get(key).items.push(row);
  });

  const uniqueInvoices = Array.from(invoiceMap.values());
  recordCount.textContent = `${uniqueInvoices.length} invoices (${data.length} line items)`;
  
  let html = `
    <div style="margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
      <label style="font-weight: bold;">Export Date Range:</label>
      <input type="text" id="purchasesStartDate" placeholder="YYYYMMDD000000" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      <span>to</span>
      <input type="text" id="purchasesEndDate" placeholder="YYYYMMDD000000" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      <button class="btn btn-secondary" onclick="exportFilteredPurchasesData()">
        <i class="fas fa-download"></i> Export Filtered
      </button>
      <button class="btn btn-secondary" onclick="exportPurchasesData()">
        <i class="fas fa-download"></i> Export All Data
      </button>
    </div>
    <table id="purchasesTable" class="table">
      <thead>
        <tr>
          <th>System Request Date</th>
          <th>Supplier TPIN</th>
          <th>Supplier Name</th>
          <th>Supplier BHF ID</th>
          <th>Invoice No</th>
          <th>Receipt Type</th>
          <th>Payment Type</th>
          <th>Confirm Date</th>
          <th>Sales Date</th>
          <th>Stock Release Date</th>
          <th>Total Item Count</th>
          <th>Total Taxable Amount</th>
          <th>Total Tax Amount</th>
          <th>Total Amount</th>
          <th>Remark</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  uniqueInvoices.forEach(invoice => {
    const statusClass = invoice.status === 'approved' ? 'success' : invoice.status === 'rejected' ? 'error' : 'warning';
    html += `
      <tr>
        <td>${invoice.System_Request_date || ''}</td>
        <td>${invoice.spplrTpin || ''}</td>
        <td title="${invoice.spplrNm || ''}">${(invoice.spplrNm || '').substring(0, 30)}${(invoice.spplrNm || '').length > 30 ? '...' : ''}</td>
        <td>${invoice.spplrBhfId || ''}</td>
        <td>${invoice.spplrInvcNo || ''}</td>
        <td>${invoice.rcptTyCd || ''}</td>
        <td>${invoice.pmtTyCd || ''}</td>
        <td>${invoice.cfmDt || ''}</td>
        <td>${invoice.salesDt || ''}</td>
        <td>${invoice.stockRlsDt || ''}</td>
        <td>${invoice.totItemCnt || ''}</td>
        <td>${invoice.totTaxblAmt || ''}</td>
        <td>${invoice.totTaxAmt || ''}</td>
        <td>${invoice.totAmt || ''}</td>
        <td title="${invoice.remark || ''}">${(invoice.remark || '').substring(0, 20)}${(invoice.remark || '').length > 20 ? '...' : ''}</td>
        <td><span class="badge badge-${statusClass}">${invoice.status}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-info" style="padding: 4px 8px; font-size: 12px;" onclick="viewInvoice('${invoice.spplrTpin}_${invoice.spplrInvcNo}')">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-success" style="padding: 4px 8px; font-size: 12px;" onclick="updateInvoiceStatus('${invoice.spplrTpin}_${invoice.spplrInvcNo}', 'approved')" ${invoice.status === 'approved' ? 'disabled' : ''}>
              <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="updateInvoiceStatus('${invoice.spplrTpin}_${invoice.spplrInvcNo}', 'rejected')" ${invoice.status === 'rejected' ? 'disabled' : ''}>
              <i class="fas fa-times"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function updatePurchaseStatus(id, status) {
  try {
    const result = await ipcRenderer.invoke('update-purchase-status', id, status);
    if (result.success) {
      addNotice('Purchase Status', `Purchase record ${status}`);
      await refreshPurchasesDisplay();
    } else {
      addNotice('Purchase Status Error', result.error);
    }
  } catch (error) {
    addNotice('Purchase Status Error', error.message);
  }
}

async function updateInvoiceStatus(invoiceKey, action) {
  try {
    // Get all items for this invoice
    const invoiceItems = currentPurchasesData.filter(r => `${r.spplrTpin}_${r.spplrInvcNo}` === invoiceKey);
    if (invoiceItems.length === 0) {
      addNotice('Purchase Status Error', 'Invoice items not found');
      return;
    }

    const firstItem = invoiceItems[0]; // Use first item for header data
    
    // Get endpoints from configuration
    const endpoints = store.get('savedEndpoints') || {};
    const purchaseEndpoint = endpoints.purchaseInvoice || 'http://localhost:8080/sandboxvsdc1.0.7.5/trnsPurchase/savePurchase';
    
    // Get initialization details
    const initDetails = store.get('initDetails') || {};
    
    // Prepare item list for payload
    const itemList = invoiceItems.map(item => ({
      itemSeq: item.itemSeq,
      itemCd: item.itemCd,
      itemClsCd: item.itemClsCd,
      itemNm: item.itemNm,
      bcd: item.bcd || null,
      pkgUnitCd: item.pkgUnitCd,
      pkg: item.pkg,
      qtyUnitCd: item.qtyUnitCd,
      qty: item.qty,
      prc: item.prc,
      splyAmt: item.splyAmt,
      dcRt: item.dcRt || 0,
      dcAmt: item.dcAmt || 0,
      vatCatCd: item.vatCatCd,
      iplCatCd: item.iplCatCd || null,
      tlCatCd: item.tlCatCd || null,
      exciseTxCatCd: item.exciseTxCatCd || null,
      vatTaxblAmt: item.vatTaxblAmt,
      exciseTaxblAmt: item.exciseTaxblAmt || 0,
      iplTaxblAmt: item.iplTaxblAmt || 0,
      tlTaxblAmt: item.tlTaxblAmt || 0,
      taxblAmt: item.taxblAmt,
      vatAmt: item.vatAmt,
      iplAmt: item.iplAmt || 0,
      tlAmt: item.tlAmt || 0,
      exciseTxAmt: item.exciseTxAmt || 0,
      totAmt: item.totAmtItem
    }));

    // Prepare payload for purchase approval/rejection
    const payload = {
      tpin: initDetails.tpin || '2001188640',
      bhfId: initDetails.branch || '000',
      spplrTpin: firstItem.spplrTpin,
      spplrBhfId: firstItem.spplrBhfId,
      spplrNm: firstItem.spplrNm,
      spplrInvcNo: firstItem.spplrInvcNo,
      regTyCd: 'A',
      pchsTyCd: '01',
      rcptTyCd: firstItem.rcptTyCd,
      pmtTyCd: firstItem.pmtTyCd,
      pchsSttsCd: action === 'approved' ? '02' : '03',
      cfmDt: firstItem.cfmDt,
      pchsDt: firstItem.salesDt,
      totItemCnt: firstItem.totItemCnt,
      totTaxblAmt: firstItem.totTaxblAmt,
      totTaxAmt: firstItem.totTaxAmt,
      totAmt: firstItem.totAmt,
      remark: firstItem.remark || null,
      regrId: initDetails.regrId || '',
      regrNm: initDetails.regrNm || '',
      modrId: initDetails.modrId || '',
      modrNm: initDetails.modrNm || '',
      itemList: itemList
    };

    // Send to purchase endpoint
    const response = await fetch(purchaseEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.resultCd === '000') {
      // Update local database status for all items
      const updatePromises = invoiceItems.map(item => 
        ipcRenderer.invoke('update-purchase-status', item.id, action)
      );
      
      await Promise.all(updatePromises);
      addNotice('Purchase Status', `Purchase invoice ${action} successfully`);
      
      // If approved, update stock for each item
      if (action === 'approved') {
        for (const item of invoiceItems) {
          await updateStockForPurchaseItem(item);
        }
      }
      
      await refreshPurchasesDisplay();
    } else {
      addNotice('Purchase Status Error', `Failed to ${action} purchase: ${result.resultMsg || 'Unknown error'}`);
    }
  } catch (error) {
    addNotice('Purchase Status Error', error.message);
  }
}

async function updateStockForPurchaseItem(item) {
  try {
    const endpoints = store.get('savedEndpoints') || {};
    const stockEndpoint = endpoints.stock || 'http://localhost:8080/sandboxvsdc1.0.7.5/stock/saveStockItems';
    const initDetails = store.get('initDetails') || {};
    
    // Calculate amounts for stock entry
    const qty = parseFloat(item.qty || 0);
    const price = parseFloat(item.prc || 0);
    const taxAmt = parseFloat(item.vatTaxblAmt || 0);
    const taxblAmt = parseFloat(item.vatAmt || 0);
    const totAmt = parseFloat(item.totAmtItem || 0);
    
    // Generate sequential numbers (simplified approach)
    const sarNo = 1;
    const orgSarNo = Math.floor(Date.now() / 1000); // Use timestamp as unique number
    
    const stockPayload = {
      tpin: initDetails.tpin || '2001188640',
      bhfId: initDetails.branch || '000',
      sarTyCd: '01',
      sarNo: sarNo,
      orgSarNo: orgSarNo,
      regTyCd: 'A',
      custTpin: null,
      custNm: null,
      custBhfId: null,
      ocrnDt: item.salesDt,
      totItemCnt: 1,
      totTaxblAmt: taxblAmt,
      totTaxAmt: taxAmt,
      totAmt: totAmt,
      remark: item.remark || null,
      regrId: initDetails.regrId || '',
      regrNm: initDetails.regrNm || '',
      modrNm: initDetails.modrNm || '',
      modrId: initDetails.modrId || '',
      itemList: [
        {
          itemSeq: item.itemSeq,
          itemNm: item.itemNm,
          itemClsCd: item.itemClsCd,
          itemCd: item.itemCd,
          pkgUnitCd: item.pkgUnitCd,
          vatCatCd: item.vatCatCd,
          qtyUnitCd: item.qtyUnitCd,
          pkg: item.pkg,
          qty: qty,
          prc: price,
          splyAmt: qty * price,
          totDcAmt: 0.0,
          taxAmt: taxAmt,
          taxblAmt: taxblAmt,
          totAmt: totAmt,
          remark: item.remark || null,
          modrNm: initDetails.modrNm || '',
          modrId: initDetails.modrId || ''
        }
      ]
    };

    const response = await fetch(stockEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stockPayload)
    });

    const result = await response.json();
    
    if (response.ok && result.resultCd === '000') {
      // Also update stock master
      await updateStockMasterForItem(item, qty);
      addNotice('Stock Update', `Stock updated for item: ${item.itemCd}`);
    } else {
      addNotice('Stock Update Error', `Failed to update stock for item ${item.itemCd}: ${result.resultMsg || 'Unknown error'}`);
    }
  } catch (error) {
    addNotice('Stock Update Error', `Error updating stock for item ${item.itemCd}: ${error.message}`);
  }
}

async function updateStockMasterForItem(item, qty) {
  try {
    const endpoints = store.get('savedEndpoints') || {};
    const stockMasterEndpoint = endpoints.stockMaster || 'http://localhost:8080/sandboxvsdc1.0.7.5/stockMaster/saveStockMaster';
    const initDetails = store.get('initDetails') || {};
    
    const stockMasterPayload = {
      tpin: initDetails.tpin || '2001188640',
      bhfId: initDetails.branch || '000',
      regrId: initDetails.regrId || '',
      regrNm: initDetails.regrNm || '',
      modrNm: initDetails.modrNm || '',
      modrId: initDetails.modrId || '',
      stockItemList: [
        {
          itemCd: item.itemCd,
          rsdQty: qty
        }
      ]
    };

    const response = await fetch(stockMasterEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stockMasterPayload)
    });

    const result = await response.json();
    
    if (response.ok && result.resultCd === '000') {
      addNotice('Stock Master Update', `Stock master updated for item: ${item.itemCd}`);
    } else {
      addNotice('Stock Master Error', `Failed to update stock master for item ${item.itemCd}: ${result.resultMsg || 'Unknown error'}`);
    }
  } catch (error) {
    addNotice('Stock Master Error', `Error updating stock master for item ${item.itemCd}: ${error.message}`);
  }
}

function exportPurchasesData() {
  if (!currentPurchasesData || currentPurchasesData.length === 0) {
    alert('No data to export');
    return;
  }
  
  exportPurchasesDataInternal(currentPurchasesData, 'purchases_export_all');
}

async function exportFilteredPurchasesData() {
  const startDate = document.getElementById('purchasesStartDate').value;
  const endDate = document.getElementById('purchasesEndDate').value;
  
  if (!startDate && !endDate) {
    alert('Please enter at least one date for filtering');
    return;
  }
  
  try {
    const filteredData = await ipcRenderer.invoke('get-filtered-purchases-data', startDate, endDate);
    if (!filteredData || filteredData.length === 0) {
      alert('No data found for the specified date range');
      return;
    }
    
    const filename = `purchases_export_${startDate || 'start'}_to_${endDate || 'end'}`;
    exportPurchasesDataInternal(filteredData, filename);
  } catch (error) {
    alert('Error exporting filtered data: ' + error.message);
  }
}

function exportPurchasesDataInternal(data, filename) {
  const headers = [
    'System Request Date', 'Supplier TPIN', 'Supplier Name', 'Supplier BHF ID', 'Invoice No',
    'Receipt Type', 'Payment Type', 'Confirm Date', 'Sales Date', 'Stock Release Date',
    'Total Item Count', 'Total Taxable Amount', 'Total Tax Amount', 'Total Amount', 'Remark',
    'Item Seq', 'Item Code', 'Item Class Code', 'Item Name', 'Barcode', 'Package Unit Code',
    'Package', 'Quantity Unit Code', 'Quantity', 'Price', 'Supply Amount', 'Discount Rate',
    'Discount Amount', 'VAT Category Code', 'IPL Category Code', 'TL Category Code',
    'Excise Tax Category Code', 'VAT Taxable Amount', 'Excise Taxable Amount', 'IPL Taxable Amount',
    'TL Taxable Amount', 'Taxable Amount', 'VAT Amount', 'IPL Amount', 'TL Amount',
    'Excise Tax Amount', 'Total Amount Item', 'Status'
  ];
  
  let csv = [headers.join(',')];
  
  data.forEach(row => {
    const values = [
      row.System_Request_date || '', row.spplrTpin || '', row.spplrNm || '', row.spplrBhfId || '',
      row.spplrInvcNo || '', row.rcptTyCd || '', row.pmtTyCd || '', row.cfmDt || '',
      row.salesDt || '', row.stockRlsDt || '', row.totItemCnt || '', row.totTaxblAmt || '',
      row.totTaxAmt || '', row.totAmt || '', row.remark || '', row.itemSeq || '',
      row.itemCd || '', row.itemClsCd || '', row.itemNm || '', row.bcd || '',
      row.pkgUnitCd || '', row.pkg || '', row.qtyUnitCd || '', row.qty || '',
      row.prc || '', row.splyAmt || '', row.dcRt || '', row.dcAmt || '',
      row.vatCatCd || '', row.iplCatCd || '', row.tlCatCd || '', row.exciseTxCatCd || '',
      row.vatTaxblAmt || '', row.exciseTaxblAmt || '', row.iplTaxblAmt || '', row.tlTaxblAmt || '',
      row.taxblAmt || '', row.vatAmt || '', row.iplAmt || '', row.tlAmt || '',
      row.exciseTxAmt || '', row.totAmtItem || '', row.status || ''
    ];
    
    const escapedValues = values.map(value => `"${String(value).replace(/"/g, '""')}"`);
    csv.push(escapedValues.join(','));
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function formatDateForExport(dateStr) {
  if (!dateStr) return '';
  // Convert from YYYYMMDD or YYYY-MM-DD HH:MM:SS to DD/MM/YYYY
  if (dateStr.includes('-')) {
    const datePart = dateStr.split(' ')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  } else if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

function exportImportsData() {
  if (!currentImportsData || currentImportsData.length === 0) {
    alert('No data to export');
    return;
  }
  
  exportImportsDataInternal(currentImportsData, 'imports_export_all');
}

async function exportFilteredImportsData() {
  const startDate = document.getElementById('importsStartDate').value;
  const endDate = document.getElementById('importsEndDate').value;
  
  if (!startDate && !endDate) {
    alert('Please enter at least one date for filtering');
    return;
  }
  
  try {
    const filteredData = await ipcRenderer.invoke('get-filtered-imports-data', startDate, endDate);
    if (!filteredData || filteredData.length === 0) {
      alert('No data found for the specified date range');
      return;
    }
    
    const filename = `imports_export_${startDate || 'start'}_to_${endDate || 'end'}`;
    exportImportsDataInternal(filteredData, filename);
  } catch (error) {
    alert('Error exporting filtered data: ' + error.message);
  }
}

function exportImportsDataInternal(data, filename) {
  const headers = [
    'System Request Date', 'Task Code', 'Declaration Date', 'Item Seq', 'Declaration No', 'HS Code',
    'Item Name', 'Import Status Code', 'Origin Country', 'Export Country', 'Package', 'Package Unit',
    'Quantity', 'Quantity Unit', 'Total Weight', 'Net Weight', 'Supplier Name', 'Agent Name',
    'Invoice FC Amount', 'Invoice FC Currency', 'Invoice FC Rate', 'Declaration Ref No', 'Status'
  ];
  
  let csv = [headers.join(',')];
  
  data.forEach(row => {
    const values = [
      row.System_Request_date || '', row.taskCd || '', row.dclDe || '', row.itemSeq || '',
      row.dclNo || '', row.hsCd || '', row.itemNm || '', row.imptItemsttsCd || '',
      row.orgnNatCd || '', row.exptNatCd || '', row.pkg || '', row.pkgUnitCd || '',
      row.qty || '', row.qtyUnitCd || '', row.totWt || '', row.netWt || '', row.spplrNm || '',
      row.agntNm || '', row.invcFcurAmt || '', row.invcFcurCd || '', row.invcFcurExcrt || '',
      row.dclRefNum || '', row.status || ''
    ];
    
    const escapedValues = values.map(value => `"${String(value).replace(/"/g, '""')}"`);
    csv.push(escapedValues.join(','));
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function viewInvoice(invoiceKey) {
  const invoiceItems = currentPurchasesData.filter(r => `${r.spplrTpin}_${r.spplrInvcNo}` === invoiceKey);
  if (!invoiceItems || invoiceItems.length === 0) {
    alert('Invoice record not found');
    return;
  }

  const invoice = invoiceItems[0]; // Main invoice data

  // Create modal HTML with ERPNext-style layout
  const modalHtml = `
    <div id="invoiceModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
    ">
      <div style="
        background: white;
        border-radius: 8px;
        max-width: 1200px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        margin: 20px;
        width: 95%;
      ">
        <div style="
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
        ">
          <h2 style="margin: 0; color: #333;">Purchase Invoice #${invoice.spplrInvcNo}</h2>
          <button onclick="closeInvoiceModal()" style="
            background: none;
            border: none;
            font-size: 24px;
            color: #666;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">&times;</button>
        </div>
        <div style="padding: 30px;">
          <!-- Invoice Header -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <div>
              <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 5px;">Supplier Information</h3>
              <p><strong>Name:</strong> ${invoice.spplrNm || 'N/A'}</p>
              <p><strong>TPIN:</strong> ${invoice.spplrTpin || 'N/A'}</p>
              <p><strong>BHF ID:</strong> ${invoice.spplrBhfId || 'N/A'}</p>
            </div>
            <div>
              <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 5px;">Invoice Details</h3>
              <p><strong>Invoice No:</strong> ${invoice.spplrInvcNo || 'N/A'}</p>
              <p><strong>Sales Date:</strong> ${invoice.salesDt || 'N/A'}</p>
              <p><strong>Confirm Date:</strong> ${invoice.cfmDt || 'N/A'}</p>
              <p><strong>Receipt Type:</strong> ${invoice.rcptTyCd || 'N/A'}</p>
              <p><strong>Payment Type:</strong> ${invoice.pmtTyCd || 'N/A'}</p>
              <p><strong>Stock Release Date:</strong> ${invoice.stockRlsDt || 'N/A'}</p>
            </div>
          </div>
          
          <!-- Items Table -->
          <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #28a745; padding-bottom: 5px;">Item Details</h3>
          <div style="overflow-x: auto; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
              <thead>
                <tr style="background: #f1f1f1;">
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item Code</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item Name</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Class Code</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qty</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Unit Price</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Supply Amount</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">VAT Amount</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceItems.map(item => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.itemCd || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.itemNm || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.itemClsCd || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.qty || 0} ${item.qtyUnitCd || ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.prc || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.splyAmt || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.vatAmt || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.totAmtItem || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- Invoice Summary -->
          <div style="background: #e8f5e8; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin-bottom: 15px;">Invoice Summary</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
              <div>
                <p><strong>Total Items:</strong> ${invoice.totItemCnt || 'N/A'}</p>
                <p><strong>Receipt Type:</strong> ${invoice.rcptTyCd || 'N/A'}</p>
                <p><strong>Payment Type:</strong> ${invoice.pmtTyCd || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Total Taxable Amount:</strong> ${invoice.totTaxblAmt || 'N/A'}</p>
                <p><strong>Total Tax Amount:</strong> ${invoice.totTaxAmt || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="badge badge-${invoice.status === 'approved' ? 'success' : invoice.status === 'rejected' ? 'error' : 'warning'}">${invoice.status}</span></p>
              </div>
              <div>
                <p style="font-size: 18px; font-weight: bold; color: #155724;"><strong>Total Amount:</strong> ${invoice.totAmt || 'N/A'}</p>
                <p><strong>Remarks:</strong> ${invoice.remark || 'No remarks'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeInvoiceModal() {
  const modal = document.getElementById('invoiceModal');
  if (modal) {
    modal.remove();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded: Initializing modern UI');
  showSection('dashboard');
  updateNoticesTable();
  
  // Initialize database status
  refreshDatabase();

  // Listen for connection status updates
  ipcRenderer.on('connection-status', (event, data) => {
    console.log(`connection-status: ${JSON.stringify(data)}`);
    const testBtn = document.querySelector('#dbSetup .btn-primary');
    const createBtn = document.getElementById('createDbBtn');
    if (data.isConnected) {
      setDbStatus('Database connection is healthy', true);
      if (testBtn) testBtn.disabled = true;
      if (createBtn) createBtn.disabled = data.dbExists;
    } else {
      setDbStatus('Database not connected', false);
      if (testBtn) testBtn.disabled = false;
      if (createBtn) createBtn.disabled = true;
    }
  });

  // Listen for notices
  ipcRenderer.on('notice', (event, notice) => {
    console.log('notice: Received notice:', notice);
    addNotice(notice.eventType, notice.details);
  });

  // Listen for online/offline events
  window.addEventListener('online', updateInternetStatus);
  window.addEventListener('offline', updateInternetStatus);

  updateUnreadCount();
  updateInternetStatus();
});
