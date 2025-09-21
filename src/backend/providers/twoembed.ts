import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import { MWStreamQuality, MWStreamType } from "../helpers/streams";
import { MWMediaType } from "../metadata/types/mw";

registerProvider({
  id: "twoembed",
  displayName: "2Embed",
  rank: 35,
  type: [MWMediaType.MOVIE, MWMediaType.SERIES],

  async scrape({ media, episode, progress }) {
    if (!this.type.includes(media.meta.type)) {
      throw new Error("Unsupported type");
    }

    try {
      progress(25);

      // Get TMDB ID from metadata
      const tmdbId = media.tmdbId;
      if (!tmdbId) {
        throw new Error("TMDB ID not available");
      }

      let embedUrl = "";
      
      if (media.meta.type === MWMediaType.MOVIE) {
        // For movies, use TMDB ID
        embedUrl = `https://www.2embed.cc/embed/tmdb/movie?id=${tmdbId}`;
      } else if (media.meta.type === MWMediaType.SERIES) {
        // For series, we need season and episode
        const seasonNumber = media.meta.seasonData.number;
        const episodeNumber = media.meta.seasonData.episodes.find(
          (ep) => ep.id === episode
        )?.number;

        if (!episodeNumber) {
          throw new Error("Episode not found");
        }

        embedUrl = `https://www.2embed.cc/embed/tmdb/tv?id=${tmdbId}&s=${seasonNumber}&e=${episodeNumber}`;
      }

      progress(50);

      // Fetch the embed page
      const embedResponse = await proxiedFetch<string>(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Referer": "https://www.2embed.cc/",
        },
      });

      progress(75);

      if (!embedResponse) {
        throw new Error("Failed to load embed page");
      }

      // Extract stream URL from embed page
      // This is a simplified example - you may need to adjust based on 2embed's actual structure
      const streamUrlMatch = embedResponse.match(/(?:file|source)["']?\s*:\s*["']([^"']+\.m3u8[^"']*)/i);
      let streamUrl = streamUrlMatch ? streamUrlMatch[1] : null;

      // Alternative patterns to look for
      if (!streamUrl) {
        const altPatterns = [
          /src["']?\s*:\s*["']([^"']+)/i,
          /source["']?\s*:\s*["']([^"']+)/i,
          /url["']?\s*:\s*["']([^"']+)/i,
        ];

        for (const pattern of altPatterns) {
          const match = embedResponse.match(pattern);
          if (match && (match[1].includes('.m3u8') || match[1].includes('.mp4'))) {
            streamUrl = match[1];
            break;
          }
        }
      }

      if (!streamUrl) {
        throw new Error("Stream URL not found in embed");
      }

      // Clean up the URL if needed
      if (streamUrl.startsWith('//')) {
        streamUrl = 'https:' + streamUrl;
      } else if (streamUrl.startsWith('/')) {
        streamUrl = 'https://www.2embed.cc' + streamUrl;
      }

      // Determine stream type and quality
      const streamType = streamUrl.includes('.m3u8') ? MWStreamType.HLS : MWStreamType.MP4;
      const quality = MWStreamQuality.Q720P; // Default quality

      return {
        embeds: [],
        stream: {
          streamUrl,
          quality,
          type: streamType,
          captions: [], // 2embed typically doesn't provide subtitles directly
        },
      };

    } catch (error) {
      throw new Error(`2Embed scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});