import { strings } from './strings';
import JeopardyPreview from '../components/JeopardyPreview';
import NaermestPreview from '../components/NaermestPreview';

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
  {
    id: 'naermest',
    name: strings.nvName,
    href: '/naermest',
    description: strings.nvDescription,
    players: strings.nvPlayers,
    previewLabel: strings.nvPreviewAlt,
    Preview: NaermestPreview,
  },
];
