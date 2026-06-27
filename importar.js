const axios = require('axios');
const fs = require('fs');
const path = require('path');

const URL = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-rune-recommendations.json";
const DESTINO = path.join(__dirname, 'champion-rune-recommendations.json');

async function descargarRunas() {
    try {
        console.log("📥 Descargando recomendaciones de CommunityDragon...");
        const response = await axios.get(URL);
        
        // Guardamos el archivo
        fs.writeFileSync(DESTINO, JSON.stringify(response.data, null, 2));
        
        console.log("✅ Datos guardados correctamente en champion-rune-recommendations.json");
    } catch (e) {
        console.error("❌ Error al descargar:", e.message);
    }
}

descargarRunas();