import type { LayoutLoad } from './$types';

export const prerender = true;

export const load: LayoutLoad = async ({ url }) => {
  const path = url.pathname;
  let side: 'dev' | 'personal' | 'maple' | 'neutral' = 'neutral';
  if (path.startsWith('/dev') || path.startsWith('/skills')) side = 'dev';
  else if (path.startsWith('/personal')) side = 'personal';
  else if (path.startsWith('/maple')) side = 'maple';
  return { side };
};
