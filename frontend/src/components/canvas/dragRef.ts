import { createRef } from 'react';

// Shared ref for tracking which object is being dragged in layout edit mode.
// Set on pointer-down by PlacedObjectMesh; read on mouse-move by DigitalTwinCanvas.
export const draggingObjectIdRef = createRef<string | null>() as React.MutableRefObject<string | null>;
draggingObjectIdRef.current = null;
