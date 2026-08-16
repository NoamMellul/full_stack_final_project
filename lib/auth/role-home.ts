// Single shared source for the role -> home-route map. Consumed by both the
// root router (app/page.tsx, a Server Component) and the login page
// (app/login/page.tsx, a Client Component) — no `server-only` import, no
// default export, no helper function, so both can import it unchanged.
export const ROLE_HOME: Record<string, string> = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};
