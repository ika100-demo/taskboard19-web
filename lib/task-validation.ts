export const MSG_NO_TASKS = "No tasks yet";
export const MSG_NO_DUE_DATE = "No due date";
export const MSG_TITLE_INVALID =
  "Title must be 1 to 200 characters and not only spaces.";
export const MSG_LOAD_FAILED =
  "Tasks could not be loaded. Please try again later.";
export const MSG_SAVE_FAILED = "The task could not be saved. Please try again.";

const MAX_TITLE_LENGTH = 200;

/** Returns MSG_TITLE_INVALID when the title is blank or over 200 code points, else null. */
export function validateTitle(title: string): string | null {
  if (title.trim() === "" || [...title].length > MAX_TITLE_LENGTH) {
    return MSG_TITLE_INVALID;
  }
  return null;
}
