// The one password rule (the backend enforces exactly the same, see PasswordPolicy.java):
// at least 12 characters, an uppercase letter, a lowercase letter, a number and a special character.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { key: 'upper', label: 'An uppercase letter (A-Z)', test: (p) => /\p{Lu}/u.test(p) },
  { key: 'lower', label: 'A lowercase letter (a-z)', test: (p) => /\p{Ll}/u.test(p) },
  { key: 'digit', label: 'A number (0-9)', test: (p) => /\d/.test(p) },
  { key: 'special', label: 'A special character (! @ # $ % ...)', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

/** The labels of the rules the password does not meet yet (empty = acceptable). */
export function passwordProblems(password) {
  const p = password || '';
  return PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
}

export function isPasswordValid(password) {
  return passwordProblems(password).length === 0 && (password || '').length <= 100;
}
