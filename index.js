const { app, BrowserWindow } = require('electron');
const { createWebSocketConnection, authenticate } = require('league-connect');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

let mainWindow;

// Cargamos los archivos necesarios
const PERKS_DATA_PATH = path.join(__dirname, 'perks.json');
const perksData = fs.existsSync(PERKS_DATA_PATH) ? JSON.parse(fs.readFileSync(PERKS_DATA_PATH, 'utf-8')) : [];

function createWindow() {
    const { screen } = require('electron');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 500,     // Tamaño más grande
        height: 400,    // Tamaño más grande
        x: width - 520, // Posición: Ancho total menos el ancho de la ventana + margen
        y: 20,          // Un poco de margen desde arriba
        resizable: false,
        frame: false,   // Quitamos los bordes de ventana (estilo pro)
        transparent: true, // Fondo transparente
        alwaysOnTop: true, // La app se mantiene sobre el juego
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false,
            webSecurity: false 
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

         // MAPEO DE ID A RAMA (Para encontrar la carpeta correcta)
// Esto es necesario porque el iconPath de Riot es inconsistente
            const getBranch = (id) => {
                if (id >= 8100 && id <= 8199) return "domination";
                if (id >= 8200 && id <= 8299) return "sorcery";
                if (id >= 8300 && id <= 8399) return "inspiration";
                if (id >= 8400 && id <= 8499) return "resolve";
                if (id >= 8000 && id <= 8099) return "precision";
                return "statmods"; // Por defecto para las de estadísticas
            };

            // CONVERSIÓN DE IDs A URLs - ESTRUCTURA DEFINITIVA
            const getSummonerImageUrl = (spellId) => {
            // Busca el hechizo en tu archivo de datos cargado
            const spell = summonersData.find(s => s.id === spellId);
            if (!spell) return null;

            // La ruta estándar de CommunityDragon para hechizos
            const fileName = spell.iconPath.split('/').pop().toLowerCase();
            return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/data/spells/icons2d/${fileName}`;
        };
            const runeImageUrls = rec ? rec.perkIds.map(id => {
                const rune = perksData.find(p => p.id === id);
                
                // Si la runa no existe en tu JSON local, la ignoramos completamente
                if (!rune) return null;

                // Validación de nombres obsoletos (puedes añadir los que vayas encontrando)
                const obsoletas = ['triumph', 'legendhaste']; 
                const fileName = rune.iconPath.split('/').pop().toLowerCase();
                
                if (obsoletas.some(nombre => fileName.includes(nombre))) {
                    return null; // Saltamos esta runa porque ya no existe
                }

                const branch = getBranch(id);
                const cleanName = fileName.replace('.png', '');

                // Construcción segura
                if (branch === "statmods") {
                    return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/${fileName}`;
                }

                return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${branch}/${cleanName}/${fileName}`;
            }).filter(url => url !== null) : [];

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