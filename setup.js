
const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();

function setStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
}

async function initializeDatabase() {
  setStatus('Initializing SQLite database...', 'info');
  const initBtn = document.querySelector('button[onclick="initializeDatabase()"]');
  initBtn.disabled = true;

  try {
    const result = await ipcRenderer.invoke('test-connection');
    
    initBtn.disabled = false;
    if (result.success) {
      setStatus(`Database initialized successfully! Path: ${result.dbPath}`, 'success');
      document.getElementById('createBtn').disabled = false;
    } else {
      setStatus(`Failed to initialize database: ${result.error}`, 'error');
    }
  } catch (error) {
    initBtn.disabled = false;
    setStatus(`Error: ${error.message}`, 'error');
  }
}

async function createDatabase() {
  setStatus('Creating/resetting database...', 'info');
  const createBtn = document.getElementById('createBtn');
  createBtn.disabled = true;

  try {
    const result = await ipcRenderer.invoke('create-database');
    
    createBtn.disabled = false;
    if (result.success) {
      setStatus(`Database created with tables: ${result.tables.join(', ')}`, 'success');
    } else {
      setStatus(`Failed to create database: ${result.error}`, 'error');
    }
  } catch (error) {
    createBtn.disabled = false;
    setStatus(`Error: ${error.message}`, 'error');
  }
}

async function dumpDatabase() {
  if (!confirm('Are you sure you want to delete the entire database? This action cannot be undone.')) {
    return;
  }

  setStatus('Deleting database...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('dump-database');
    
    if (result.success) {
      setStatus('Database deleted successfully', 'success');
      document.getElementById('createBtn').disabled = true;
    } else {
      setStatus(`Failed to delete database: ${result.error}`, 'error');
    }
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeDatabase();
});
