import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import { MWStreamQuality, MWStreamType } from "../helpers/streams";
import { MWMediaType } from "../metadata/types/mw";

// Free movie streaming service that doesn't require authentication
const moviesApiBase = "https://cinema-api.up.railway.app"; // Alternative: https://movies-api.nomadcoders.workers.dev

registerProvider({
  id: "publicmovies",
  displayName: "Public Movies",
  rank: 40,
  disabled: true, // Test and enable after verifying the API works
  type: [MWMediaType.MOVIE],

  async scrape({ media, progress }) {
    if (!this.type.includes(media.meta.type)) {
      throw new Error("Unsupported type");
    }

    try {
      progress(25);

      // Search for the movie
      const searchQuery = encodeURIComponent(media.meta.title);
      const searchResponse = await proxiedFetch<any>(`/api/search?q=${searchQuery}`, {
        baseURL: moviesApiBase,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!searchResponse.results || searchResponse.results.length === 0) {
        throw new Error("No results found");
      }

      progress(50);

      // Find the best match by title and year
      let bestMatch = searchResponse.results[0];
      if (media.meta.year) {
        const exactMatch = searchResponse.results.find((result: any) => {
          const titleMatch = result.title?.toLowerCase().includes(media.meta.title.toLowerCase());
          const yearMatch = result.release_date?.includes(media.meta.year);
          return titleMatch && yearMatch;
        });
        if (exactMatch) bestMatch = exactMatch;
      }

      if (!bestMatch.id) {
        throw new Error("No valid match found");
      }

      progress(75);

      // Get movie details and streaming info
      const movieDetails = await proxiedFetch<any>(`/api/movie/${bestMatch.id}`, {
        baseURL: moviesApiBase,
      });

      if (!movieDetails || !movieDetails.stream_url) {
        throw new Error("No streaming URL found");
      }

      const streamUrl = movieDetails.stream_url;
      
      // Determine stream type and quality
      const streamType = streamUrl.includes('.m3u8') ? MWStreamType.HLS : MWStreamType.MP4;
      const quality = movieDetails.quality ? 
        (movieDetails.quality.includes('1080') ? MWStreamQuality.Q1080P :
         movieDetails.quality.includes('720') ? MWStreamQuality.Q720P :
         MWStreamQuality.Q480P) : 
        MWStreamQuality.Q720P;

      return {
        embeds: [],
        stream: {
          streamUrl,
          quality,
          type: streamType,
          captions: [], // Add caption processing if API provides them
        },
      };

    } catch (error) {
      throw new Error(`Public Movies scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});