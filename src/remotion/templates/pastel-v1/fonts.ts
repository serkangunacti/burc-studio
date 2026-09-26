import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces';
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';

const heading = loadFraunces('normal', { weights: ['500', '600'], subsets: ['latin', 'latin-ext'] });
const body = loadNunito('normal', { weights: ['400', '600', '700'], subsets: ['latin', 'latin-ext'] });

export const HEADING_FONT = heading.fontFamily;
export const BODY_FONT = body.fontFamily;

export function waitForFonts(): Promise<unknown> {
  return Promise.all([heading.waitUntilDone(), body.waitUntilDone()]);
}
