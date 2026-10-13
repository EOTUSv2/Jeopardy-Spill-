import Head from 'next/head';
import '@fontsource-variable/fredoka';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* viewport-fit=cover lets the player's colour reach behind the notch;
            content keeps clear of it through safe-area padding. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
