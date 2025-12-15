// src/routes/campaign.routes.js
import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth.middleware.js';
import {
  createCampaignFromRag,
  sendCampaign,
} from '../controllers/campaign.controller.js';

const router = Router();

// Crea una campaña a partir de un segmento en vector-rag
router.post('/from-rag', authenticate, createCampaignFromRag);

// Dispara el envío de la campaña (usa runFordCampaign y la cola existente)
router.post('/:campaignId/send', authenticate, sendCampaign);

export default router;


