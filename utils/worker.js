import { parentPort, workerData } from "worker_threads";
import { renderPage } from "./renderPage.js";
import path from "path";
import fs from "fs";

const { tempDir, entryFiles, action } = workerData;

const findHtmlFiles = (dir) => {
  const files = fs.readdirSync(dir);
  let htmlFiles = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      htmlFiles = htmlFiles.concat(findHtmlFiles(filePath));
    } else if (path.extname(file) === ".html") {
      htmlFiles.push(path.relative(tempDir, filePath));
    }
  }
  return htmlFiles;
};

const renderPages = async (files) => {
  const results = [];
  for (const file of files) {
    try {
      const screenshot = await renderPage(tempDir, file);
      results.push({ file, screenshot });
    } catch (error) {
      results.push({ file, error: error.message });
    }
  }
  return results;
};

if (action === 'findHtmlFiles') {
  const htmlFiles = findHtmlFiles(tempDir);
  parentPort.postMessage(htmlFiles);
} else if (action === 'renderPages') {
  renderPages(entryFiles)
    .then((results) => {
      parentPort.postMessage(results);
    })
    .catch((error) => {
      parentPort.postMessage({ error: error.message });
    });
}