import { Router } from 'express';
import { handleEvent } from '../controllers/eventsController';
import { simulateGeyser, simulateInventoryDrop, simulateUnknownSound, simulateMotorSafety, simulateVoiceCommand } from '../controllers/simulateController';
import { healthCheck, listHomes, getHomeState, getHomeStats, seedHome, resetHome, getEventHistory, updateInventory, identifySoundCluster } from '../controllers/homeController';
import { listDeviceTypes, registerDevice, getDevice, listDevices, updateDeviceProperty, removeDevice, setDeviceOnline } from '../controllers/deviceController';
import { listRooms, createRoom, getRoom, updateOccupancy } from '../controllers/roomController';
import { getRegime, forceRegime, refreshRegime } from '../controllers/regimeController';
import { runMiner, listProposedRules, confirmRule, rejectRule, listT0Rules } from '../controllers/minerController';
import { textToSpeech, textToSpeechGet, speakEventResult, voiceConfig, demoPhrasesAudio } from '../controllers/voiceController';
import { listModules, getModule, listCategories, getStoreStats, installModule, getInstalledModules, publishModule, generateModuleWithAI, getModuleTemplate } from '../controllers/appStoreController';

const router = Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', healthCheck);

// ── Event ingestion (T0 → T1 → T3 cascade) ───────────────────────────────────
router.post('/events', handleEvent);

// ── Homes ─────────────────────────────────────────────────────────────────────
router.get('/homes', listHomes);
router.get('/homes/:home_id', getHomeState);
router.get('/homes/:home_id/stats', getHomeStats);
router.post('/homes/:home_id/seed', seedHome);
router.post('/homes/:home_id/reset', resetHome);
router.get('/homes/:home_id/events', getEventHistory);
router.patch('/homes/:home_id/inventory', updateInventory);
router.patch('/homes/:home_id/sounds/:cluster_id/identify', identifySoundCluster);

// ── Devices ───────────────────────────────────────────────────────────────────
router.get('/device-types', listDeviceTypes);
router.get('/homes/:home_id/devices', listDevices);
router.post('/homes/:home_id/devices', registerDevice);
router.get('/homes/:home_id/devices/:device_id', getDevice);
router.patch('/homes/:home_id/devices/:device_id', updateDeviceProperty);
router.delete('/homes/:home_id/devices/:device_id', removeDevice);
router.patch('/homes/:home_id/devices/:device_id/online', setDeviceOnline);

// ── Rooms ─────────────────────────────────────────────────────────────────────
router.get('/homes/:home_id/rooms', listRooms);
router.post('/homes/:home_id/rooms', createRoom);
router.get('/homes/:home_id/rooms/:room_id', getRoom);
router.patch('/homes/:home_id/rooms/:room_id/occupancy', updateOccupancy);

// ── Regime ────────────────────────────────────────────────────────────────────
router.get('/homes/:home_id/regime', getRegime);
router.post('/homes/:home_id/regime', forceRegime);
router.post('/homes/:home_id/regime/refresh', refreshRegime);

// ── Rule miner ────────────────────────────────────────────────────────────────
router.get('/homes/:home_id/rules', listT0Rules);
router.post('/homes/:home_id/rules/mine', runMiner);
router.get('/homes/:home_id/rules/proposed', listProposedRules);
router.post('/homes/:home_id/rules/proposed/:proposal_id/confirm', confirmRule);
router.post('/homes/:home_id/rules/proposed/:proposal_id/reject', rejectRule);

// ── Voice (TTS + STT) ─────────────────────────────────────────────────────────
router.get('/voice/config', voiceConfig);
router.get('/voice/speak', textToSpeechGet);
router.post('/voice/speak', textToSpeech);
router.post('/voice/respond', speakEventResult);
router.get('/voice/demo-phrases', demoPhrasesAudio);

// ── App Store (MCP Module Marketplace) ───────────────────────────────────────
router.get('/app-store/stats', getStoreStats);
router.get('/app-store/categories', listCategories);
router.get('/app-store/modules', listModules);
router.post('/app-store/modules', publishModule);
router.get('/app-store/modules/template', getModuleTemplate);
router.post('/app-store/generate-module', generateModuleWithAI);
router.get('/app-store/modules/:module_id', getModule);
router.post('/app-store/modules/:module_id/install/:home_id', installModule);
router.get('/homes/:home_id/modules', getInstalledModules);

// ── Hackathon demo scenarios ──────────────────────────────────────────────────
router.post('/simulate/geyser', simulateGeyser);
router.post('/simulate/inventory_drop', simulateInventoryDrop);
router.post('/simulate/unknown_sound', simulateUnknownSound);
router.post('/simulate/motor_safety', simulateMotorSafety);
router.post('/simulate/voice_command', simulateVoiceCommand);

export default router;
