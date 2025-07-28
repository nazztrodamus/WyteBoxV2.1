//defaults.js
const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();

function saveEndpoints() {
  try {
    const endpoints = JSON.parse(document.getElementById('endpoints').value);
    store.set('endpoints', endpoints);
    alert('Endpoints saved!');
  } catch (e) {
    alert('Invalid JSON for endpoints');
  }
}

function saveRoutes() {
  try {
    const routes = JSON.parse(document.getElementById('routes').value);
    store.set('routes', routes);
    alert('Routes saved!');
  } catch (e) {
    alert('Invalid JSON for routes');
  }
}

function saveSecurityKey() {
  const key = document.getElementById('securityKey').value.trim();
  if (!key) return alert('Security key cannot be empty');
  store.set('securityKey', key);
  alert('Security key saved!');
}

function saveInitDetails() {
  const url = document.getElementById('initUrl').value.trim();
  if (!url) return alert('Initialization URL cannot be empty');
  store.set('initDetails', { url });
  alert('Initialization details saved!');
}