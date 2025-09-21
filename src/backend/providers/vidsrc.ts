import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import {
  MWCaptionType,
  MWStreamQuality,
  MWStreamType,
} from "../helpers/streams";
import { MWMediaType } from "../metadata/types/mw";

const vidsrcBase = "https://vidsrc.xyz"; // Updated base URL

registerProvider({
  id: "vidsrc",
  displayName: "VidSrc",
  rank: 25,
  type: [MWMediaType.MOVIE, MWMediaType.SERIES],

  async scrape({ media, episode, progress }) {
    if (!this.type.includes(media.meta.type)) {
      throw new Error("Unsupported type");
    }

    try {
      progress(25);

      // Get IMDB ID from metadata
      const imdbId = media.imdbId;
      if (!imdbId) {
        throw new Error("IMDB ID not available");
      }

      let apiUrl = "";

      if (media.meta.type === MWMediaType.MOVIE) {
        // For movies, use IMDB ID directly
        apiUrl = `/api/movie/${imdbId}`;
      } else if (media.meta.type === MWMediaType.SERIES) {
        // For series, we need season and episode
        const seasonNumber = media.meta.seasonData.number;
        const episodeNumber = media.meta.seasonData.episodes.find(
          (ep) => ep.id === episode
        )?.number;

        if (!episodeNumber) {
          throw new Error("Episode not found");
        }

        apiUrl = `/api/tv/${imdbId}/${seasonNumber}/${episodeNumber}`;
      }

      progress(50);

      // Make API request to VidSrc
      const response = await proxiedFetch<any>(apiUrl, {
        baseURL: vidsrcBase,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://vidsrc.xyz/",
        },
      });

      progress(75);

      if (!response || !response.sources || response.sources.length === 0) {
        throw new Error("No streams found");
      }

      // Get the best quality stream
      const bestSource = response.sources[0];
      if (!bestSource.url) {
        throw new Error("Stream URL not found");
      }

      // Process captions/subtitles if available
      const captions = (response.subtitles || []).map((sub: any) => ({
        needsProxy: false,
        url: sub.url,
        type: MWCaptionType.VTT,
        langIso: sub.lang || "en",
      }));

      // Determine stream quality
      let quality = MWStreamQuality.Q720P;
      if (bestSource.quality) {
        const qualityMap: Record<string, MWStreamQuality> = {
          "360": MWStreamQuality.Q360P,
          "480": MWStreamQuality.Q480P,
          "720": MWStreamQuality.Q720P,
          "1080": MWStreamQuality.Q1080P,
        };
        quality = qualityMap[bestSource.quality] || MWStreamQuality.Q720P;
      }

      // Determine stream type
      const streamType = bestSource.url.includes(".m3u8")
        ? MWStreamType.HLS
        : MWStreamType.MP4;

      return {
        embeds: [],
        stream: {
          streamUrl: bestSource.url,
          quality,
          type: streamType,
          captions,
        },
      };
    } catch (error) {
      throw new Error(
        `VidSrc scraping failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});
