const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// ... Aquí importas tus funciones actuales (authenticate, createWebSocketConnection, etc.)

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// Aquí adentro va toda tu lógica de League of Legends que tenías en index.js
// Usando ipcMain.send para avisarle a la interfaz cuando algo pase