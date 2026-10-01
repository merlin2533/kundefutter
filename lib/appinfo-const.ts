/**
 * Standard-Produktname, falls keine individuelle Bezeichnung hinterlegt ist.
 * Bewusst importfrei: wird von Client-Seiten genutzt und darf deshalb weder
 * `prisma` noch andere server-only Module nachziehen (GlitchTip AGRI-1S).
 */
export const DEFAULT_APP_NAME = "AGRI-Office";
