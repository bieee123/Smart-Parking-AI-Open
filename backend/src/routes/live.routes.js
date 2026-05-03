import { Router } from 'express';
const router = Router();

let clients = [];

// Endpoint for React Frontend to listen to real-time events (SSE)
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    clients.push(res);
    
    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// Endpoint for camera_worker.py to post the latest AI data
router.post('/broadcast', (req, res) => {
    const data = req.body; // { vehicle_count, density_level, recommendation }
    
    // Broadcast data to all open dashboard tabs
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
    
    res.status(200).json({ success: true });
});

export default router;
