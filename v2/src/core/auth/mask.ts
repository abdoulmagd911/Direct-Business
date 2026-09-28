// "Sent to o•••••@d•••.com" (TECH-SPEC §4): the first letter of the name and of the domain, the rest as dots, the
// ending kept. Enough for a person to recognise their own address on a shared screen, not enough to read it.
const DOT = '•';

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return DOT.repeat(5);
  const name = email.slice(0, at);
  const host = email.slice(at + 1);
  const dot = host.lastIndexOf('.');
  const domain = dot > 0 ? host.slice(0, dot) : host;
  const ending = dot > 0 ? host.slice(dot) : '';
  const hide = (s: string, min: number) => s.slice(0, 1) + DOT.repeat(Math.max(min, s.length - 1));
  return `${hide(name, 5)}@${hide(domain, 3)}${ending}`;
}
