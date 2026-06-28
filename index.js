const { app, BrowserWindow } = require('electron');
const { createWebSocketConnection, authenticate } = require('league-connect');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

let mainWindow;

// Cargamos perks.json para convertir ID -> Imagen
const PERKS_DATA_PATH = path.join(__dirname, 'perks.json');
const perksData = fs.existsSync(PERKS_DATA_PATH) ? JSON.parse(fs.readFileSync(PERKS_DATA_PATH, 'utf-8')) : [];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 250,
        resizable: false,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });
    mainWindow.loadFile('index.html');
}

async function startApp() {
    const CHAMP_DATA_PATH = path.join(__dirname, 'champions.json');
    const CD_PATH = path.join(__dirname, 'champion-rune-recommendations.json');
    
    const champNames = fs.existsSync(CHAMP_DATA_PATH) ? JSON.parse(fs.readFileSync(CHAMP_DATA_PATH, 'utf-8')) : {};
    const officialRunes = fs.existsSync(CD_PATH) ? JSON.parse(fs.readFileSync(CD_PATH, 'utf-8')) : [];

    try {
        const creds = await authenticate({ awaitConnection: true });
        const ws = await createWebSocketConnection({ authenticationOptions: creds });
        
        const riotApi = axios.create({
            baseURL: `https://127.0.0.1:${creds.port}`,
            auth: { username: 'riot', password: creds.password },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });

        ws.subscribe('/lol-champ-select/v1/session', async (data) => {
            if (!data || !data.myTeam) return;
            const player = data.myTeam.find(j => j.cellId === data.localPlayerCellId);
            if (!player || player.championId === 0) return;

            const champName = champNames[player.championId.toString()] || "Desconocido";
            const champEntry = officialRunes.find(c => c.championId === player.championId);
            const rec = champEntry?.runeRecommendations?.[0];

            // CONVERSIÓN DE IDs A URLs
            const runeImageUrls = rec ? rec.perkIds.map(id => {
                const rune = perksData.find(p => p.id === id);
                return rune ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/${rune.iconPath.toLowerCase()}` : null;
            }).filter(url => url !== null) : [];

            // Envío de URLs al frontend
            mainWindow.webContents.send('update-ui', {
                name: champName,
                lane: player.assignedPosition || 'N/A',
                champIcon: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${player.championId}.png`,
                runes: runeImageUrls
            });

            if (rec) {
                try {
                    const pages = await riotApi.get('/lol-perks/v1/pages');
                    const editables = pages.data.filter(p => p.isEditable);
                    for (const p of editables) await riotApi.delete(`/lol-perks/v1/pages/${p.id}`);

                    await riotApi.post('/lol-perks/v1/pages', {
                        name: `jey.gg: ${champName}`,
                        primaryStyleId: rec.primaryPerkStyleId,
                        subStyleId: rec.secondaryPerkStyleId,
                        selectedPerkIds: rec.perkIds,
                        current: true
                    });
                } catch (err) { console.error("Error inyectando runas:", err); }
            }
        });
    } catch (e) { console.error("Error de conexión:", e); }
}

app.whenReady().then(() => {
    createWindow();
    startApp();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});