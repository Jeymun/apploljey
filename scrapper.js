const puppeteer = require('puppeteer');
const fs = require('fs');

async function obtenerRunasOPGG() {
    console.log("🚀 Abriendo navegador para extraer data de OP.GG...");
    
    // Lanzamos un navegador real
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Entramos a la página de estadísticas globales de runas
    // (Ejemplo para un campeón, esto habría que iterarlo o buscar un listado)
    await page.goto('https://www.op.gg/champions/brand/mid/runes', { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        // Acá extraeríamos los IDs de las runas desde el HTML de OP.GG
        // Esto requiere un selector preciso del DOM
        return {
            primaryStyle: document.querySelector('.perk-style-title').innerText, // Ejemplo lógico
            // ... lógica de extracción ...
        };
    });

    console.log("✅ Data extraída:", data);
    await browser.close();
}

obtenerRunasOPGG();