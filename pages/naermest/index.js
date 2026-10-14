import Head from 'next/head';
import Link from 'next/link';
import { strings } from '../../lib/strings';

export default function NaermestStart() {
  return (
    <main className="center-page">
      <Head>
        <title>{strings.nvName}</title>
      </Head>
      <h1 className="title">{strings.nvName}</h1>
      <p className="hint">{strings.chooseDevice}</p>
      <div className="role-buttons">
        <Link href="/naermest/host" className="btn btn-gold btn-lg">
          {strings.hostRole}
        </Link>
        <Link href="/naermest/play" className="btn btn-blue btn-lg">
          {strings.playerRole}
        </Link>
      </div>
      <Link href="/" className="back-link">
        {strings.backToMenu}
      </Link>
    </main>
  );
}
