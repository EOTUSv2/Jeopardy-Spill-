import Head from 'next/head';
import Link from 'next/link';
import { strings } from '../lib/strings';
import { games } from '../lib/games';

export default function GameMenu() {
  return (
    <main className="menu-page">
      <Head>
        <title>{strings.titleMenu}</title>
      </Head>
      <header className="menu-header">
        <h1 className="title">{strings.siteName}</h1>
        <p className="hint">{strings.menuIntro}</p>
      </header>
      <ul className={`game-list ${games.length === 1 ? 'game-list-single' : ''}`}>
        {games.map(({ id, name, href, description, players, previewLabel, Preview }) => (
          <li key={id}>
            <Link href={href} className="game-card">
              <span className="game-preview" role="img" aria-label={previewLabel}>
                <Preview />
              </span>
              <span className="game-body">
                <span className="game-name">{name}</span>
                <span className="game-players">{players}</span>
                <span className="game-description">{description}</span>
                <span className="game-cta">{strings.menuPlay(name)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
