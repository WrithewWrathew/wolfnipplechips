import { chromium } from 'playwright-core';

export default async function handler(req, res) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  try {
    await page.goto('https://www.australiansuper.com//api/graphs/dailyrates/download/?start=01/02/2026&end=08/02/2026&cumulative=False&superType=super&truncateDecimalPlaces=True&outputFilename=temp.csv', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    const csv = await page.content();
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const intlIndex = headers.findIndex(h => h.includes('International Shares'));
    
    let intlValue = 0;
    for (let i = lines.length - 1; i > 0; i--) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols[intlIndex]) {
        const val = parseFloat(cols[intlIndex]);
        if (!isNaN(val) && Math.abs(val) > 0.0001) {
          intlValue = val;
          break;
        }
      }
    }
    
    await browser.close();
    
    res.status(200).json({
      value: intlValue.toFixed(4),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await browser.close();
    res.status(500).json({ error: error.message });
  }
}
