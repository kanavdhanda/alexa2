import { Router } from 'express';
import { handleEvent } from '../controllers/eventsController';
import { simulateGeyser, simulateInventoryDrop, simulateUnknownSound } from '../controllers/simulateController';
import {
  getHomeState,
  listHomes,
  resetHomeState,
  updateDevice,
  getEventHistory,
  getT0Rules,
  healthCheck,
} from '../controllers/homeController';

const router = Router();

// Health
router.get('/health', healthCheck);

// Event ingestion (T0/T3 router)
router.post('/events', handleEvent);

// Home state APIs (mock IoT Device Shadow)
router.get('/homes', listHomes);
router.get('/homes/:home_id', getHomeState);
router.post('/homes/:home_id/reset', resetHomeState);
router.patch('/homes/:home_id/devices/:device_id', updateDevice);
router.get('/homes/:home_id/events', getEventHistory);
router.get('/homes/:home_id/rules', getT0Rules);

// Hackathon demo scenario endpoints
router.post('/simulate/geyser', simulateGeyser);
router.post('/simulate/inventory_drop', simulateInventoryDrop);
router.post('/simulate/unknown_sound', simulateUnknownSound);

export default router;
