import { writable } from 'svelte/store';

/** True while a drag-selection is in progress on any page */
export const isDragging = writable(false);
