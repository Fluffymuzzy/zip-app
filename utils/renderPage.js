import puppeteer from "puppeteer";
import path from "path";
import { pathToFileURL } from "url";

let browser;

export const renderPage = async (outputDir, entryFile) => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const page = await browser.newPage();
  try {
    const filePath = pathToFileURL(path.join(outputDir, entryFile)).href;
    await page.goto(filePath, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    
    const screenshot = await page.screenshot({ encoding: "base64" });

    return screenshot;
  } finally {
    await page.close();
  }
};

export const closeBrowser = async () => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};
