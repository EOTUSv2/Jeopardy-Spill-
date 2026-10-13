import Head from 'next/head';
import Link from 'next/link';
import { strings } from '../lib/strings';

export default function Home() {
  return (
    <main className="center-page">
      <Head>
        <title>{strings.titleHome}</title>
      </Head>
      <h1 className="title">{strings.title}</h1>
      <p className="hint">{strings.chooseDevice}</p>
      <div className="role-buttons">
        <Link href="/host" className="btn btn-gold btn-lg">
          {strings.hostRole}
        </Link>
        <Link href="/play" className="btn btn-blue btn-lg">
          {strings.playerRole}
        </Link>
      </div>
    </main>
  );
}
