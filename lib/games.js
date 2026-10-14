import { strings } from './strings';
import JeopardyPreview from '../components/JeopardyPreview';

// Every game on the menu. To add a game, add one entry here: where it starts,
// a short description, how many can play, and an animated preview component.
export const games = [
  {
    id: 'jeopardy',
    name: strings.title,
    href: '/jeopardy',
    description: strings.jeopardyDescription,
    players: strings.jeopardyPlayers,
    previewLabel: strings.jeopardyPreviewAlt,
    Preview: JeopardyPreview,
  },
];
