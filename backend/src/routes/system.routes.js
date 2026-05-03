import { Router } from 'express';
import { healthCheck, getSystemInfo } from '../controllers/system.controller.js';

const router = Router();

router.get('/health', healthCheck);
router.get('/info', getSystemInfo);

export default router;
