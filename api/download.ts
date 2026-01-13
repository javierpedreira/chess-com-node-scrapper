import { downloadGames } from '../download-chesscom.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { user, months, tail, timeControl } = req.body as {
      user?: string;
      months?: number | string;
      tail?: number | string;
      timeControl?: string;
    };

    if (!user) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    // Validate input
    if (months && (isNaN(Number(months)) || Number(months) < 0)) {
      res.status(400).json({ error: 'Months must be a positive number' });
      return;
    }

    if (tail && (isNaN(Number(tail)) || Number(tail) < 0)) {
      res.status(400).json({ error: 'Tail must be a positive number' });
      return;
    }

    // Download games
    const output = await downloadGames({
      user,
      months: months ? parseInt(String(months), 10) : undefined,
      tail: tail ? parseInt(String(tail), 10) : undefined,
      timeControl,
      logProgress: false
    });

    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${user}-games.json"`);

    res.status(200).json(output);
  } catch (error) {
    console.error('Error downloading games:', error);
    
    const err = error as Error;
    
    // Determine appropriate status code based on error message
    let statusCode = 500;
    if (err.message.includes('not found') || err.message.includes('has no game archives')) {
      statusCode = 404;
    } else if (err.message.includes('required') || err.message.includes('must be')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      error: err.message || 'Failed to download games',
      message: err.message 
    });
  }
}

