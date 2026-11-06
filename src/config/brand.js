/**
 * The app's display name, shown on the login screen and sidebar brand mark.
 *
 * Configurable per deployment via VITE_APP_NAME (set it in Netlify's
 * environment variables, or a local .env file) so the same codebase can be
 * deployed for different clients under their own name - e.g. "Betty
 * Cosmetics" for one client, "Miftah Electronics" for another - without
 * forking the code or touching the brand mark's styling.
 *
 * This is only the *default*. The name an admin types in Settings (stored
 * server-side) overrides it at runtime - see BrandContext / useAppName().
 * Falls back to "ERP Suite" when VITE_APP_NAME isn't set.
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'ERP Suite';
