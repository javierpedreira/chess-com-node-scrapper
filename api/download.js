import { downloadGames } from '../download-chesscom.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user, months, tail, timeControl } = req.body;

    if (!user) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate input
    if (months && (isNaN(months) || months < 0)) {
      return res.status(400).json({ error: 'Months must be a positive number' });
    }

    if (tail && (isNaN(tail) || tail < 0)) {
      return res.status(400).json({ error: 'Tail must be a positive number' });
    }

    // Download games
    const output = await downloadGames({
      user,
      months: months ? parseInt(months) : undefined,
      tail: tail ? parseInt(tail) : undefined,
      timeControl,
      logProgress: false
    });

    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${user}-games.json"`);

    return res.status(200).json(output);
  } catch (error) {
    console.error('Error downloading games:', error);
    
    // Determine appropriate status code based on error message
    let statusCode = 500;
    if (error.message.includes('not found') || error.message.includes('has no game archives')) {
      statusCode = 404;
    } else if (error.message.includes('required') || error.message.includes('must be')) {
      statusCode = 400;
    }
    
    return res.status(statusCode).json({ 
      error: error.message || 'Failed to download games',
      message: error.message 
    });
  }
}

