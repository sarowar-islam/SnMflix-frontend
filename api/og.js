import axios from 'axios';

export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;
  const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY || 'dd09381517f08b551e2162a3826b2695';

  if (!id) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="SnM Flix — Stream Movies, TV Shows & Anime Online Free" />
          <meta property="og:image" content="https://snmflix.vercel.app/images/og-image.png" />
          <meta property="og:description" content="Watch the latest Hollywood, Bollywood, Bangla movies, TV series, anime and more — all free on SnM Flix." />
        </head>
        <body></body>
      </html>
    `);
  }

  try {
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${id}`, {
      params: { api_key: TMDB_API_KEY }
    });
    const movie = tmdbRes.data;
    const title = movie.title || movie.name || 'Movie';
    const description = `Watch ${title} online in HD on SnM Flix. Stream now for free!`;
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : 'https://snmflix.vercel.app/images/og-image.png';

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${title} — Watch Online Free | SnM Flix</title>
          <meta name="description" content="${description}" />

          <meta property="og:type" content="video.movie" />
          <meta property="og:url" content="https://snmflix.vercel.app/movie/${id}?type=${type}" />
          <meta property="og:title" content="${title} — Watch Online Free | SnM Flix" />
          <meta property="og:description" content="${description}" />
          <meta property="og:image" content="${backdrop}" />
          <meta property="og:site_name" content="SnM Flix" />

          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content="https://snmflix.vercel.app/movie/${id}?type=${type}" />
          <meta name="twitter:title" content="${title} — Watch Online Free | SnM Flix" />
          <meta name="twitter:description" content="${description}" />
          <meta name="twitter:image" content="${backdrop}" />
        </head>
        <body>
          <h1>${title}</h1>
          <p>${description}</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="SnM Flix — Stream Movies, TV Shows & Anime Online Free" />
          <meta property="og:image" content="https://snmflix.vercel.app/images/og-image.png" />
          <meta property="og:description" content="Watch the latest Hollywood, Bollywood, Bangla movies, TV series, anime and more — all free on SnM Flix." />
        </head>
        <body></body>
      </html>
    `);
  }
}
