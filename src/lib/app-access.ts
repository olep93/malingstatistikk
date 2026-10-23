/**
 * The portal (jobbverktoy.no) creates the users and picks which apps each may open. It keeps that list
 * in app_metadata.apps, e.g. ["driftssjekk", "malingstatistikk"], which only the secret key can change.
 * Unlike Driftssjekk, accounts without the list get no access: accounts from before the portal must be
 * given Malingstatistikk explicitly.
 */
export const NO_ACCESS = "Du har ikke tilgang til Malingstatistikk";

type PortalUser = { app_metadata?: unknown; banned_until?: string | null } | null | undefined;

export function hasMalingstatistikkAccess(user: PortalUser) {
  if (!user) return false;
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return false;
  const apps = (user.app_metadata as { apps?: unknown } | null | undefined)?.apps;
  return Array.isArray(apps) && apps.includes("malingstatistikk");
}

export function mustChangePassword(user: PortalUser) {
  return (user?.app_metadata as { must_change_password?: unknown } | null | undefined)?.must_change_password === true;
}
