import { closestCorners, getFirstCollision, KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core';

const DIRECTIONS: string[] = [KeyboardCode.Up, KeyboardCode.Down, KeyboardCode.Left, KeyboardCode.Right];

/**
 * dnd-kit/sortable's stock `sortableKeyboardCoordinates` only looks within
 * the active item's own SortableContext, so it can't move a card across
 * columns — each kanban column is a separate context. This variant looks
 * across every droppable (columns and cards alike) in the pressed direction
 * and jumps to the geometrically closest one, which resolves cross-column
 * moves the same way pointer drag-and-drop already does.
 */
export const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const {
    context: { active, collisionRect, droppableRects, droppableContainers },
  } = args;

  if (!DIRECTIONS.includes(event.code)) return undefined;
  event.preventDefault();
  if (!active || !collisionRect) return undefined;

  const filtered = droppableContainers.getEnabled().filter((entry) => {
    if (!entry) return false;
    const rect = droppableRects.get(entry.id);
    if (!rect) return false;
    switch (event.code) {
      case KeyboardCode.Down:
        return rect.top > collisionRect.top;
      case KeyboardCode.Up:
        return rect.top < collisionRect.top;
      case KeyboardCode.Left:
        return rect.left < collisionRect.left;
      case KeyboardCode.Right:
        return rect.left > collisionRect.left;
      default:
        return false;
    }
  });

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: filtered,
    pointerCoordinates: null,
  });
  const closestId = getFirstCollision(collisions, 'id');
  if (closestId == null) return undefined;

  const newRect = droppableRects.get(closestId);
  if (!newRect) return undefined;

  return { x: newRect.left, y: newRect.top };
};
