import { Request, Response } from 'express';
import { stateStore, Room, RoomType } from '../stateStore';
import { wsServer } from '../websocket';

const VALID_ROOM_TYPES: RoomType[] = ['kitchen', 'bedroom', 'living_room', 'bathroom', 'balcony', 'study', 'utility', 'other'];

export function listRooms(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  return res.json({ home_id, count: Object.keys(home.rooms).length, rooms: home.rooms });
}

export function createRoom(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { room_id, name, type, knowledge_pack_id } = req.body;

  if (!room_id || !name || !type) {
    return res.status(400).json({ error: 'room_id, name, and type are required', valid_types: VALID_ROOM_TYPES });
  }
  if (!VALID_ROOM_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid room type: ${type}`, valid_types: VALID_ROOM_TYPES });
  }

  const room: Room = {
    room_id, name, type: type as RoomType,
    device_ids: [],
    occupancy: { occupied: false, confidence: 0, last_updated: new Date().toISOString() },
    knowledge_pack_id: knowledge_pack_id || `${type}_pack`,
  };

  stateStore.addRoom(home_id, room);
  return res.status(201).json({ message: `Room ${room_id} created`, room });
}

export function getRoom(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const room_id = req.params['room_id'] as string;
  const home = stateStore.get(home_id);
  const room = home.rooms[room_id];
  if (!room) return res.status(404).json({ error: `Room ${room_id} not found` });
  const devices = room.device_ids.map(id => home.devices[id]).filter(Boolean);
  return res.json({ ...room, devices });
}

export function updateOccupancy(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const room_id = req.params['room_id'] as string;
  const { occupied, confidence = 0.9, person_count } = req.body;

  if (occupied === undefined) return res.status(400).json({ error: 'occupied (boolean) is required' });

  stateStore.setOccupancy(home_id, room_id, { occupied: !!occupied, confidence, person_count, last_updated: new Date().toISOString() });
  wsServer?.broadcastDeviceUpdate(home_id, room_id, 'occupancy', { occupied, confidence, person_count });

  return res.json({ home_id, room_id, occupancy: stateStore.get(home_id).rooms[room_id]?.occupancy });
}
