// Simple development server for local testing
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadGames } from './download-chesscom.js';
import type { DownloadGamesOptions } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve index.html
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const filePath = path.join(__dirname, 'public', 'index.html');
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html');
    }
    return;
  }

  // API endpoint
  if (req.url === '/api/download' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body) as {
          user?: string;
          months?: number | string;
          tail?: number | string;
          timeControl?: string;
        };
        const { user, months, tail, timeControl } = data;

        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username is required' }));
          return;
        }

        // Validate input
        if (months && (isNaN(Number(months)) || Number(months) < 0)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Months must be a positive number' }));
          return;
        }

        if (tail && (isNaN(Number(tail)) || Number(tail) < 0)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tail must be a positive number' }));
          return;
        }

        // Download games
        const options: DownloadGamesOptions = {
          user,
          months: months ? parseInt(String(months), 10) : undefined,
          tail: tail ? parseInt(String(tail), 10) : undefined,
          timeControl,
          logProgress: false
        };

        const output = await downloadGames(options);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${user}-games.json"`
        });
        res.end(JSON.stringify(output));
      } catch (error) {
        console.error('Error:', error);
        
        const err = error as Error;
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (err.message.includes('not found') || err.message.includes('has no game archives')) {
          statusCode = 404;
        } else if (err.message.includes('required') || err.message.includes('must be')) {
          statusCode = 400;
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: err.message || 'Failed to download games',
          message: err.message
        }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📝 Open http://localhost:${PORT} in your browser`);
});


