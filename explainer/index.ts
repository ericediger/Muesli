import type { AnimatedScene } from '@explainer/src/kit/types';
import { ColdOpen } from './scenes/ColdOpen';
import { Outro } from './scenes/Outro';

export { spec } from './script';

// Every `component` named by an animated scene in script.ts must be registered here.
export const components: Record<string, AnimatedScene> = { ColdOpen, Outro };
