const { contextBridge, ipcRenderer } = require('electron');

// Find the API key in process.argv (passed from main.js)
let apiKey = '';
for (const arg of process.argv) {
  if (arg.startsWith('--openai-api-key=')) {
    apiKey = arg.replace('--openai-api-key=', '');
    break;
  }
}
console.log('preload.js: API key from argv =', apiKey);

contextBridge.exposeInMainWorld('env', {
  OPENAI_API_KEY: apiKey
});

contextBridge.exposeInMainWorld('windowControls', {
  hide: () => ipcRenderer.send('window-hide'),
  exit: () => ipcRenderer.send('window-exit')
});
