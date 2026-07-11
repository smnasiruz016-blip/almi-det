// Constants shared between the logged-in review server action
// (src/lib/reviews.ts, marked "use server") and the client form component.
// A "use server" file can only export async functions, so plain constants
// live here.

export const TEXT_MIN = 10;
export const TEXT_MAX = 2000;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
