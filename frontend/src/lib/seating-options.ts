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
