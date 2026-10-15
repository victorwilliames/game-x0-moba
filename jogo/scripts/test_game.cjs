const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('=== INICIANDO TESTE AUTÔNOMO MOBATEST V0 ===');
  
  let browser;
  let testPassed = true;
  
  try {
    console.log('1. Abrindo navegador headless via Puppeteer...');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      protocolTimeout: 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--use-gl=swiftshader',
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    
    page.on('console', msg => {
      console.log('💬 ' + msg.text());
    });
    page.on('pageerror', err => {
      console.error('❌ PAGE ERROR CRASH:', err.stack);
      testPassed = false;
    });
    
    console.log('2. Acessando http://localhost:3005...');
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    console.log('3. Aguardando a Caitlyn ser carregada...');
    await page.waitForFunction(() => {
      const el = document.getElementById('loading-status');
      return el && el.innerText === 'Pronto!';
    }, { timeout: 15000 });
    
    console.log('4. Simulando cliques no chão (canvas) para movimentação...');
    // Clica no centro da tela
    await page.mouse.click(512, 384);
    await new Promise(r => setTimeout(r, 1000));
    
    // Clica no canto inferior direito
    await page.mouse.click(800, 600);
    await new Promise(r => setTimeout(r, 1500));
    
    // Clica no canto superior esquerdo
    await page.mouse.click(200, 200);
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('5. Verificação final de estabilidade...');
    await new Promise(r => setTimeout(r, 500));
    
  } catch (err) {
    console.error('❌ Ocorreu um erro durante a execução do teste:', err);
    testPassed = false;
  } finally {
    if (browser) {
      console.log('6. Fechando o navegador...');
      await browser.close();
    }
    
    console.log('=== FIM DO TESTE AUTÔNOMO V0 ===');
    process.exit(testPassed ? 0 : 1);
  }
})();
