const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();

async function checkStatus() {
  const initDetails = store.get('initDetails') || { url: 'https://zra-vsdc-init' };
  const status = document.getElementById('status');
  status.textContent = 'Checking...';
  status.className = '';

  const result = await ipcRenderer.invoke('check-init-status', initDetails.url);
  status.textContent = result.running ? 'Running and accessible' : 'Not running and inaccessible';
  status.className = result.running ? 'running' : 'not-running';
}

async function initialize() {
  const initDetails = store.get('initDetails');
  if (!initDetails?.url) {
    alert('Please set initialization URL in Defaults');
    return;
  }

  const status = document.getElementById('status');
  status.textContent = 'Initializing...';
  status.className = '';

  const result = await ipcRenderer.invoke('initialize-device', initDetails.url);
  status.textContent = result.success ? 'Initialized successfully' : 'Initialization failed';
  status.className = result.success ? 'running' : 'not-running';
}