/** Seating rule choices, worded the same on an exam's Seating page and in Admin › Settings. */
export const ORDER_OPTIONS = [
  { value: "student_number", label: "By student number" },
  { value: "name", label: "By name (A–Z)" },
  { value: "random", label: "Random" },
];
export const SPACING_OPTIONS = [
  { value: "none", label: "Fill every seat" },
  { value: "every_other_seat", label: "Every other seat (checkerboard)" },
  { value: "every_other_seat_and_row", label: "One seat in four" },
];
export const VERSION_OPTIONS = [
  { value: "1", label: "One version" },
  { value: "2", label: "Two (A, B)" },
  { value: "3", label: "Three (A, B, C)" },
  { value: "4", label: "Four (A–D)" },
];
export const FILL_OPTIONS = [
  { value: "in_turn", label: "Fill each room in turn" },
  { value: "evenly", label: "Spread evenly across rooms" },
];
export const FRONT_ROW_OPTIONS = [
  { value: "use", label: "Seat students in the front row" },
  { value: "empty", label: "Leave the front row empty" },
];

/** Whether automatic seating may use a seat under a spacing rule; matches the backend's _seat_allowed. */
export function seatAllowed(row: number, col: number, spacing: string, frontRowEmpty = false): boolean {
  if (frontRowEmpty && row === 1) return false;
  if (spacing === "every_other_seat") return (row + col) % 2 === 0;
  if (spacing === "every_other_seat_and_row") return row % 2 === 1 && col % 2 === 1;
  return true;
}
