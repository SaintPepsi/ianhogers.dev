import type { GuestbookNote } from './types';

export class OccupancyMap {
  private occupied = new Set<string>();

  constructor(notes: GuestbookNote[]) {
    for (const note of notes) {
      this.addNote(note);
    }
  }

  addNote(note: Pick<GuestbookNote, 'row_start' | 'row_end' | 'col_start' | 'col_end'>) {
    for (let r = note.row_start; r < note.row_end; r++) {
      for (let c = note.col_start; c < note.col_end; c++) {
        this.occupied.add(`${r}:${c}`);
      }
    }
  }

  isRegionFree(rowStart: number, rowEnd: number, colStart: number, colEnd: number): boolean {
    for (let r = rowStart; r < rowEnd; r++) {
      for (let c = colStart; c < colEnd; c++) {
        if (this.occupied.has(`${r}:${c}`)) return false;
      }
    }
    return true;
  }

  getOccupancy(totalCells: number = 144): number {
    return this.occupied.size / totalCells;
  }
}
