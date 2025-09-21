import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import { MWStreamQuality, MWStreamType, MWCaptionType } from "../helpers/streams";
import { MWMediaType } from "../metadata/types/mw";

// You need to self-host Consumet API - replace with your instance URL
const consumetBase = "https://api.consumet.org"; // Replace with your self-hosted instance

registerProvider({
  id: "consumet-flixhq",
  displayName: "Consumet FlixHQ",
  rank: 30,
  disabled: true, // Enable after setting up your own Consumet instance
  type: [MWMediaType.MOVIE, MWMediaType.SERIES],

  async scrape({ media, episode, progress }) {
    if (!this.type.includes(media.meta.type)) {
      throw new Error("Unsupported type");
    }

    try {
      // Search for the media on FlixHQ via Consumet
      progress(20);
      
      const searchQuery = encodeURIComponent(media.meta.title);
      const searchResponse = await proxiedFetch<any>(`/movies/flixhq/${searchQuery}`, {
        baseURL: consumetBase,
      });

      if (!searchResponse.results || searchResponse.results.length === 0) {
        throw new Error("No results found");
      }

      progress(40);

      // Find the best match
      let bestMatch = searchResponse.results[0];
      
      // Try to find exact match by title and year
      if (media.meta.year) {
        const exactMatch = searchResponse.results.find((result: any) => {
          const titleMatch = result.title.toLowerCase().includes(media.meta.title.toLowerCase());
          const yearMatch = result.releaseDate && result.releaseDate.includes(media.meta.year);
          return titleMatch && yearMatch;
        });
        if (exactMatch) bestMatch = exactMatch;
      }

      if (!bestMatch.id) {
        throw new Error("No valid match found");
      }

      progress(60);

      let streamingUrl = "";
      
      if (media.meta.type === MWMediaType.MOVIE) {
        // Get movie streaming info
        const movieInfo = await proxiedFetch<any>(`/movies/flixhq/info?id=${bestMatch.id}`, {
          baseURL: consumetBase,
        });

        if (!movieInfo || !movieInfo.sources || movieInfo.sources.length === 0) {
          throw new Error("No streaming sources found");
        }

        streamingUrl = movieInfo.sources[0].url;
      } else if (media.meta.type === MWMediaType.SERIES) {
        // Get series info first
        const seriesInfo = await proxiedFetch<any>(`/movies/flixhq/info?id=${bestMatch.id}`, {
          baseURL: consumetBase,
        });

        if (!seriesInfo || !seriesInfo.episodes) {
          throw new Error("Series info not found");
        }

        // Find the correct episode
        const seasonNumber = media.meta.seasonData.number;
        const episodeNumber = media.meta.seasonData.episodes.find(
          (ep) => ep.id === episode
        )?.number;

        const targetEpisode = seriesInfo.episodes.find((ep: any) => 
          ep.season === seasonNumber && ep.number === episodeNumber
        );

        if (!targetEpisode) {
          throw new Error("Episode not found");
        }

        // Get episode streaming info
        const episodeInfo = await proxiedFetch<any>(`/movies/flixhq/watch?episodeId=${targetEpisode.id}`, {
          baseURL: consumetBase,
        });

        if (!episodeInfo || !episodeInfo.sources || episodeInfo.sources.length === 0) {
          throw new Error("No streaming sources found for episode");
        }

        streamingUrl = episodeInfo.sources[0].url;
      }

      progress(80);

      if (!streamingUrl) {
        throw new Error("Failed to get streaming URL");
      }

      // Process subtitles if available
      const captions: any[] = [];
      // Consumet API may provide subtitles in the response
      
      // Determine quality and stream type
      const quality = MWStreamQuality.Q720P; // Default, can be enhanced
      const streamType = streamingUrl.includes(".m3u8") ? MWStreamType.HLS : MWStreamType.MP4;

      return {
        embeds: [],
        stream: {
          streamUrl: streamingUrl,
          quality,
          type: streamType,
          captions,
        },
      };

    } catch (error) {
      throw new Error(`Consumet FlixHQ scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});