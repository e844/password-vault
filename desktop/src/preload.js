'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// ממשק מצומצם בלבד לממשק המשתמש. אין גישה ל-Node או לקבצים.
contextBridge.exposeInMainWorld('vault', {
  state: () => ipcRenderer.invoke('state'),
  create: (password, confirm) => ipcRenderer.invoke('create', password, confirm),
  unlock: (password) => ipcRenderer.invoke('unlock', password),
  lock: () => ipcRenderer.invoke('lock'),
  list: () => ipcRenderer.invoke('list'),
  get: (id) => ipcRenderer.invoke('get', id),
  save: (entry) => ipcRenderer.invoke('save', entry),
  remove: (id) => ipcRenderer.invoke('delete', id),
  copyField: (id, field) => ipcRenderer.invoke('copyField', id, field),
  copyText: (text) => ipcRenderer.invoke('copyText', text),
  generate: (options) => ipcRenderer.invoke('generate', options),
  strength: (password) => ipcRenderer.invoke('strength', password),
  activity: () => ipcRenderer.send('activity'),
  onLocked: (cb) => ipcRenderer.on('locked', (_e, info) => cb(info)),
});
