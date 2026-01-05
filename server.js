// Simple development server for local testing
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadGames } from './download-chesscom.js';

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
      const filePath = path.join(__dirname, 'index.html');
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
        const data = JSON.parse(body);
        const { user, months, tail, timeControl } = data;

        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username is required' }));
          return;
        }

        // Validate input
        if (months && (isNaN(months) || months < 0)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Months must be a positive number' }));
          return;
        }

        if (tail && (isNaN(tail) || tail < 0)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tail must be a positive number' }));
          return;
        }

        // Download games
        const output = await downloadGames({
          user,
          months: months ? parseInt(months) : undefined,
          tail: tail ? parseInt(tail) : undefined,
          timeControl,
          logProgress: false
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${user}-games.json"`
        });
        res.end(JSON.stringify(output));
      } catch (error) {
        console.error('Error:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (error.message.includes('not found') || error.message.includes('has no game archives')) {
          statusCode = 404;
        } else if (error.message.includes('required') || error.message.includes('must be')) {
          statusCode = 400;
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: error.message || 'Failed to download games',
          message: error.message
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

