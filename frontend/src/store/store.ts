import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type {
  PlacedObject,
  Room,
  UIState,
  AssetType,
  AlexaDeviceState,
  ActivePanel,
  AlexaNotification,
  Routine,
  Scene,
  AlexaTab,
} from '../types';
import { DEFAULT_ROOMS, ASSET_MAP, DEFAULT_ROUTINES, DEFAULT_SCENES } from '../constants/assets';
import { DEFAULT_PLACED_OBJECTS } from '../constants/defaults';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function notifId(): string {
  return Math.random().toString(36).slice(2);
}

interface AppState {
  rooms: Room[];
  placedObjects: PlacedObject[];
  ui: UIState;
  notifications: AlexaNotification[];
  routines: Routine[];
  scenes: Scene[];
  simulationTick: number;

  // Room actions
  setActiveRoom: (roomId: string | null) => void;
  setHoveredRoom: (roomId: string | null) => void;

  // Object actions
  addPlacedObject: (type: AssetType, position: { x: number; y: number; z: number }, roomId: string | null) => void;
  updatePlacedObject: (id: string, updates: Partial<Omit<PlacedObject, 'id'>>) => void;
  removePlacedObject: (id: string) => void;
  toggleAlexaDevice: (id: string) => void;
  updateAlexaState: (id: string, stateUpdates: Partial<AlexaDeviceState>) => void;

  // UI actions
  setSelectedObject: (id: string | null) => void;
  setHoveredObject: (id: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setAlexaTab: (tab: AlexaTab) => void;
  enterPlacementMode: (assetType: AssetType) => void;
  exitPlacementMode: () => void;
  toggleMiniMap: () => void;
  setListeningVoice: (v: boolean) => void;
  setDraggedAsset: (type: AssetType | null) => void;
  enterLayoutEditMode: () => void;
  exitLayoutEditMode: () => void;
  lockLayout: () => void;

  // Notifications
  addNotification: (message: string, type: AlexaNotification['type'], deviceId?: string) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Scenes
  triggerScene: (sceneId: string) => void;

  // Routines
  toggleRoutine: (id: string) => void;

  // Voice commands
  executeVoiceCommand: (text: string) => string;

  // Simulation
  tickSimulation: () => void;

  // Persistence
  exportState: () => string;
  importState: (json: string) => void;
}

const INITIAL_UI: UIState = {
  activeRoomId: null,
  selectedObjectId: null,
  hoveredObjectId: null,
  activePanel: 'alexa',
  placementAssetType: null,
  isPlacementMode: false,
  hoveredRoomId: null,
  alexaTab: 'home',
  showMiniMap: true,
  isListeningVoice: false,
  draggedAssetType: null,
  isLayoutEditMode: false,
  layoutLocked: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        rooms: DEFAULT_ROOMS,
        placedObjects: DEFAULT_PLACED_OBJECTS,
        notifications: [
          {
            id: notifId(),
            message: 'Your home is ready! Click a room to zoom in, or hover a device for live sensor data.',
            type: 'info',
            timestamp: Date.now(),
          },
        ],
        routines: DEFAULT_ROUTINES,
        scenes: DEFAULT_SCENES,
        simulationTick: 0,

        ui: INITIAL_UI,

        setActiveRoom: (roomId) =>
          set((s) => ({
            ui: {
              ...s.ui,
              activeRoomId: roomId,
              selectedObjectId: null,
              hoveredObjectId: null,
              activePanel: roomId !== s.ui.activeRoomId ? 'alexa' : s.ui.activePanel,
            },
          })),

        setHoveredRoom: (roomId) =>
          set((s) => ({ ui: { ...s.ui, hoveredRoomId: roomId } })),

        addPlacedObject: (type, position, roomId) => {
          const def = ASSET_MAP.get(type);
          if (!def) return;
          const room = roomId ? get().rooms.find((r) => r.id === roomId) : null;
          const obj: PlacedObject = {
            id: generateId(),
            type,
            position,
            rotation: { x: 0, y: 0, z: 0 },
            description: `${def.label}${room ? ` in ${room.name}` : ''}. ${def.defaultDescription}`,
            deviceName: `${def.label}${room ? ` (${room.name})` : ''}`,
            parentRoomId: roomId,
            isAlexaDevice: def.isAlexaDevice,
            alexaDeviceState: { ...def.defaultState },
            color: def.color,
          };
          set((s) => ({
            placedObjects: [...s.placedObjects, obj],
            // Auto-select new object and open inspector so user can rename/describe it
            ui: {
              ...s.ui,
              selectedObjectId: obj.id,
              activePanel: 'inspector',
            },
          }));
          if (def.isAlexaDevice) {
            get().addNotification(
              `${def.emoji} ${def.label} added${room ? ` to ${room.name}` : ''}.`,
              'success',
              obj.id
            );
          }
        },

        updatePlacedObject: (id, updates) =>
          set((s) => ({
            placedObjects: s.placedObjects.map((o) =>
              o.id === id ? { ...o, ...updates } : o
            ),
          })),

        removePlacedObject: (id) => {
          const obj = get().placedObjects.find((o) => o.id === id);
          set((s) => ({
            placedObjects: s.placedObjects.filter((o) => o.id !== id),
            ui: {
              ...s.ui,
              selectedObjectId: s.ui.selectedObjectId === id ? null : s.ui.selectedObjectId,
              hoveredObjectId: s.ui.hoveredObjectId === id ? null : s.ui.hoveredObjectId,
            },
          }));
          if (obj) {
            get().addNotification(`${obj.deviceName} removed.`, 'info');
          }
        },

        toggleAlexaDevice: (id) => {
          const obj = get().placedObjects.find((o) => o.id === id);
          if (!obj) return;
          const newState = !obj.alexaDeviceState.isOn;
          set((s) => ({
            placedObjects: s.placedObjects.map((o) =>
              o.id === id
                ? { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: newState } }
                : o
            ),
          }));
          const def = ASSET_MAP.get(obj.type);
          get().addNotification(
            `${def?.emoji ?? ''} ${obj.deviceName} turned ${newState ? 'on' : 'off'}.`,
            newState ? 'success' : 'info',
            id
          );
        },

        updateAlexaState: (id, stateUpdates) =>
          set((s) => ({
            placedObjects: s.placedObjects.map((o) =>
              o.id === id
                ? { ...o, alexaDeviceState: { ...o.alexaDeviceState, ...stateUpdates } }
                : o
            ),
          })),

        setSelectedObject: (id) =>
          set((s) => ({
            ui: {
              ...s.ui,
              selectedObjectId: id,
              activePanel: id ? 'inspector' : s.ui.activePanel,
            },
          })),

        setHoveredObject: (id) =>
          set((s) => ({ ui: { ...s.ui, hoveredObjectId: id } })),

        setActivePanel: (panel) =>
          set((s) => ({ ui: { ...s.ui, activePanel: panel } })),

        setAlexaTab: (tab) =>
          set((s) => ({ ui: { ...s.ui, alexaTab: tab } })),

        enterPlacementMode: (assetType) =>
          set((s) => ({
            ui: {
              ...s.ui,
              isPlacementMode: true,
              placementAssetType: assetType,
              selectedObjectId: null,
              activePanel: 'library',
            },
          })),

        exitPlacementMode: () =>
          set((s) => ({
            ui: {
              ...s.ui,
              isPlacementMode: false,
              placementAssetType: null,
              draggedAssetType: null,
            },
          })),

        toggleMiniMap: () =>
          set((s) => ({ ui: { ...s.ui, showMiniMap: !s.ui.showMiniMap } })),

        setListeningVoice: (v) =>
          set((s) => ({ ui: { ...s.ui, isListeningVoice: v } })),

        setDraggedAsset: (type) =>
          set((s) => ({ ui: { ...s.ui, draggedAssetType: type } })),

        enterLayoutEditMode: () =>
          set((s) => ({ ui: { ...s.ui, isLayoutEditMode: true, isPlacementMode: false } })),

        exitLayoutEditMode: () =>
          set((s) => ({ ui: { ...s.ui, isLayoutEditMode: false } })),

        lockLayout: () =>
          set((s) => ({ ui: { ...s.ui, layoutLocked: true, isLayoutEditMode: false } })),

        addNotification: (message, type, deviceId) => {
          const notif: AlexaNotification = {
            id: notifId(),
            message,
            type,
            timestamp: Date.now(),
            deviceId,
          };
          set((s) => ({
            notifications: [notif, ...s.notifications].slice(0, 20),
          }));
        },

        dismissNotification: (id) =>
          set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

        clearNotifications: () => set({ notifications: [] }),

        triggerScene: (sceneId) => {
          const { scenes } = get();
          const scene = scenes.find((s) => s.id === sceneId);
          if (!scene) return;

          switch (sceneId) {
            case 'morning':
              set((s) => ({
                placedObjects: s.placedObjects.map((o) => {
                  if (o.type === 'smart-bulb')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true, brightness: 100, colorTemp: 5000 } };
                  if (o.type === 'thermostat')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true, temperature: 21 } };
                  if (o.type === 'echo-dot' || o.type === 'echo-show')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true } };
                  return o;
                }),
              }));
              break;
            case 'movie':
              set((s) => ({
                placedObjects: s.placedObjects.map((o) => {
                  if (o.type === 'smart-bulb')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true, brightness: 20, colorTemp: 2700 } };
                  if (o.type === 'smart-tv')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true, volume: 40 } };
                  if (o.type === 'ceiling-fan')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: true, speed: 1 } };
                  return o;
                }),
              }));
              break;
            case 'night':
              set((s) => ({
                placedObjects: s.placedObjects.map((o) => {
                  if (o.isAlexaDevice && o.type !== 'camera' && o.type !== 'smoke-detector' && o.type !== 'motion-sensor' && o.type !== 'doorbell')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: false } };
                  if (o.type === 'smart-lock')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isLocked: true } };
                  return o;
                }),
              }));
              break;
            case 'away':
              set((s) => ({
                placedObjects: s.placedObjects.map((o) => {
                  if (o.isAlexaDevice) {
                    const keepOn = o.type === 'camera' || o.type === 'smoke-detector' || o.type === 'motion-sensor' || o.type === 'doorbell';
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn: keepOn } };
                  }
                  if (o.type === 'smart-lock')
                    return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isLocked: true } };
                  return o;
                }),
              }));
              break;
          }

          get().addNotification(`${scene.emoji} Scene "${scene.name}" activated.`, 'success');
        },

        toggleRoutine: (id) =>
          set((s) => ({
            routines: s.routines.map((r) =>
              r.id === id ? { ...r, isEnabled: !r.isEnabled } : r
            ),
          })),

        executeVoiceCommand: (text: string): string => {
          const lower = text.toLowerCase().trim();
          const { placedObjects, rooms } = get();

          if (/turn (on|off) (all |the )?lights?/.test(lower)) {
            const isOn = lower.includes('turn on');
            let count = 0;
            set((s) => ({
              placedObjects: s.placedObjects.map((o) => {
                if (o.type === 'smart-bulb' || (o.type === 'smart-plug' && o.alexaDeviceState.isOn !== isOn)) {
                  count++;
                  return { ...o, alexaDeviceState: { ...o.alexaDeviceState, isOn } };
                }
                return o;
              }),
            }));
            get().addNotification(`Lights turned ${isOn ? 'on' : 'off'}.`, isOn ? 'success' : 'info');
            return `Turning ${isOn ? 'on' : 'off'} ${count} light${count !== 1 ? 's' : ''}.`;
          }

          if (/good morning/.test(lower)) { get().triggerScene('morning'); return 'Good morning! Turning on the lights and setting the temperature.'; }
          if (/good night|bedtime/.test(lower)) { get().triggerScene('night'); return 'Good night! Turning off devices and locking the doors.'; }
          if (/movie time|movie night/.test(lower)) { get().triggerScene('movie'); return 'Enjoy the movie! Dimming the lights and turning on the TV.'; }
          if (/away mode|leaving|i.m leaving/.test(lower)) { get().triggerScene('away'); return 'Away mode activated. Securing your home.'; }

          for (const room of rooms) {
            if (lower.includes(room.name.toLowerCase())) {
              get().setActiveRoom(room.id);
              return `Showing ${room.name}.`;
            }
          }

          const brightnessMatch = lower.match(/set brightness (?:to )?(\d+)/);
          if (brightnessMatch) {
            const val = Math.min(100, Math.max(0, parseInt(brightnessMatch[1])));
            let count = 0;
            set((s) => ({
              placedObjects: s.placedObjects.map((o) => {
                if (o.type === 'smart-bulb') { count++; return { ...o, alexaDeviceState: { ...o.alexaDeviceState, brightness: val } }; }
                return o;
              }),
            }));
            get().addNotification(`Brightness set to ${val}%.`, 'info');
            return `Setting brightness to ${val}% for ${count} bulb${count !== 1 ? 's' : ''}.`;
          }

          const tempMatch = lower.match(/set (?:the )?temperature (?:to )?(\d+)/);
          if (tempMatch) {
            const val = Math.min(30, Math.max(16, parseInt(tempMatch[1])));
            set((s) => ({
              placedObjects: s.placedObjects.map((o) =>
                o.type === 'thermostat' ? { ...o, alexaDeviceState: { ...o.alexaDeviceState, temperature: val } } : o
              ),
            }));
            get().addNotification(`Temperature set to ${val}°C.`, 'info');
            return `Setting temperature to ${val}°C.`;
          }

          if (/lock|unlock/.test(lower)) {
            const isLocked = lower.includes('lock') && !lower.includes('unlock');
            set((s) => ({
              placedObjects: s.placedObjects.map((o) =>
                o.type === 'smart-lock' ? { ...o, alexaDeviceState: { ...o.alexaDeviceState, isLocked } } : o
              ),
            }));
            get().addNotification(`Door ${isLocked ? 'locked' : 'unlocked'}.`, isLocked ? 'success' : 'warning');
            return `${isLocked ? 'Locking' : 'Unlocking'} the door.`;
          }

          for (const obj of placedObjects) {
            if (obj.isAlexaDevice && lower.includes(obj.deviceName.toLowerCase())) {
              const isOn = lower.includes('turn on') || (!lower.includes('turn off') && !obj.alexaDeviceState.isOn);
              get().updateAlexaState(obj.id, { isOn });
              const def = ASSET_MAP.get(obj.type);
              get().addNotification(`${def?.emoji ?? ''} ${obj.deviceName} turned ${isOn ? 'on' : 'off'}.`, 'success', obj.id);
              return `Turning ${isOn ? 'on' : 'off'} ${obj.deviceName}.`;
            }
          }

          if (/show (?:the )?house|home view|all rooms/.test(lower)) {
            get().setActiveRoom(null);
            return 'Showing full house view.';
          }

          return "Sorry, I didn't understand that. Try \"turn on the lights\" or \"good morning\".";
        },

        tickSimulation: () => {
          set((s) => {
            const tick = s.simulationTick + 1;
            const placedObjects = s.placedObjects.map((o) => {
              if (!o.isAlexaDevice || !o.alexaDeviceState.isOn) return o;
              const ds = { ...o.alexaDeviceState };

              if (o.type === 'thermostat') {
                ds.temperature = parseFloat(((ds.temperature ?? 22) + (Math.random() - 0.5) * 0.1).toFixed(1));
                ds.humidity = parseFloat(((ds.humidity ?? 45) + (Math.random() - 0.5) * 0.2).toFixed(1));
                ds.temperature = Math.max(16, Math.min(30, ds.temperature));
                ds.humidity = Math.max(20, Math.min(80, ds.humidity));
              }
              if (o.type === 'motion-sensor' && tick % 30 === 0) {
                ds.motionDetected = Math.random() < 0.12;
              }
              if (o.type === 'air-purifier') {
                ds.airQuality = Math.max(0, Math.min(200, (ds.airQuality ?? 35) + (Math.random() - 0.5) * 3));
              }
              if (ds.batteryLevel !== undefined && tick % 120 === 0) {
                ds.batteryLevel = Math.max(0, ds.batteryLevel - 0.05);
              }
              if (ds.powerConsumption !== undefined) {
                ds.powerConsumption = parseFloat(((ds.powerConsumption ?? 0) * (0.95 + Math.random() * 0.1)).toFixed(1));
              }

              return { ...o, alexaDeviceState: ds };
            });

            return { placedObjects, simulationTick: tick };
          });
        },

        exportState: () => {
          const { rooms, placedObjects, routines } = get();
          return JSON.stringify({ rooms, placedObjects, routines }, null, 2);
        },

        importState: (json) => {
          try {
            const { rooms, placedObjects, routines } = JSON.parse(json);
            set({ rooms, placedObjects, routines });
            get().addNotification('State imported successfully.', 'success');
          } catch {
            get().addNotification('Failed to import: invalid JSON.', 'alert');
          }
        },
      }),
      {
        name: 'alexa-twin-v3',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          placedObjects: state.placedObjects,
          ui: {
            isLayoutEditMode: state.ui.isLayoutEditMode,
            layoutLocked: state.ui.layoutLocked,
          },
        }),
        merge: (persisted: unknown, current) => {
          const p = persisted as Partial<{ placedObjects: typeof current.placedObjects; ui: Partial<typeof current.ui> }>;
          return {
            ...current,
            placedObjects: p.placedObjects ?? current.placedObjects,
            ui: { ...current.ui, ...(p.ui ?? {}) },
          };
        },
      }
    ),
    { name: 'alexa-digital-twin' }
  )
);
