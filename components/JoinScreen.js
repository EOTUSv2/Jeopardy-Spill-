import Head from 'next/head';
import { strings } from '../lib/strings';

// The phone's first screen in every game: code and name.
export default function JoinScreen({ title, session }) {
  const { code, setCode, name, setName, error, submit } = session;
  return (
    <main className="center-page">
      <Head>
        <title>{title}</title>
      </Head>
      <h1 className="title">{strings.joinTitle}</h1>
      <form onSubmit={submit} className="join-form">
        <input
          className="input"
          placeholder={strings.codePlaceholder}
          aria-label={strings.codePlaceholder}
          value={code}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <input
          className="input"
          placeholder={strings.namePlaceholder}
          aria-label={strings.namePlaceholder}
          value={name}
          maxLength={20}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-gold btn-lg" type="submit">
          {strings.joinButton}
        </button>
      </form>
    </main>
  );
}
