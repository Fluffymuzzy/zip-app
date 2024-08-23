import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runWorker = (workerData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), { workerData });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
};