import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import {
  MWCaptionType,
  MWStreamQuality,
  MWStreamType,
} from "../helpers/streams";
import { MWMediaType } from "../metadata/types/mw";

// Multi-source provider that tries multiple endpoints
registerProvider({
  id: "multisource",
  displayName: "Multi Source",
  rank: 20,
  type: [MWMediaType.MOVIE, MWMediaType.SERIES],

  async scrape({ media, episode, progress }) {
    if (!this.type.includes(media.meta.type)) {
      throw new Error("Unsupported type");
    }

    const sources = [
      {
        name: "VidSrc.cc",
        baseUrl: "https://vidsrc.cc/v2/embed",
        format: (
          baseUrl: string,
          imdbId: string,
          season?: number,
          episodeNum?: number
        ) => {
          if (media.meta.type === MWMediaType.MOVIE) {
            return `${baseUrl}/movie/${imdbId}`;
          }
          return `${baseUrl}/tv/${imdbId}/${season}/${episodeNum}`;
        },
      },
      {
        name: "VidSrc.pro",
        baseUrl: "https://vidsrc.pro/embed",
        format: (
          baseUrl: string,
          imdbId: string,
          season?: number,
          episodeNum?: number
        ) => {
          if (media.meta.type === MWMediaType.MOVIE) {
            return `${baseUrl}/movie/${imdbId}`;
          }
          return `${baseUrl}/tv/${imdbId}/${season}-${episodeNum}`;
        },
      },
      {
        name: "Embed.su",
        baseUrl: "https://embed.su/embed",
        format: (
          baseUrl: string,
          imdbId: string,
          season?: number,
          episodeNum?: number
        ) => {
          if (media.meta.type === MWMediaType.MOVIE) {
            return `${baseUrl}/movie/${imdbId}`;
          }
          return `${baseUrl}/tv/${imdbId}/${season}/${episodeNum}`;
        },
      },
      {
        name: "SuperEmbed",
        baseUrl: "https://multiembed.mov",
        format: (
          baseUrl: string,
          imdbId: string,
          season?: number,
          episodeNum?: number
        ) => {
          if (media.meta.type === MWMediaType.MOVIE) {
            return `${baseUrl}/directstream.php?video_id=${imdbId}`;
          }
          return `${baseUrl}/directstream.php?video_id=${imdbId}&s=${season}&e=${episodeNum}`;
        },
      },
    ];

    let lastError = "";
    progress(10);

    // Get required parameters
    const imdbId = media.imdbId;
    if (!imdbId) {
      throw new Error("IMDB ID not available");
    }

    let seasonNumber: number | undefined;
    let episodeNumber: number | undefined;

    if (media.meta.type === MWMediaType.SERIES) {
      seasonNumber = media.meta.seasonData.number;
      episodeNumber = media.meta.seasonData.episodes.find(
        (ep) => ep.id === episode
      )?.number;

      if (!episodeNumber) {
        throw new Error("Episode not found");
      }
    }

    // Try each source
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      try {
        progress(20 + i * 15);

        const embedUrl = source.format(
          source.baseUrl,
          imdbId,
          seasonNumber,
          episodeNumber
        );

        // Fetch embed page
        const embedResponse = await proxiedFetch<string>(embedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Referer: source.baseUrl,
          },
        });

        if (!embedResponse) {
          lastError = `${source.name}: Failed to load embed page`;
          continue;
        }

        // Try to extract stream URL using multiple patterns
        const streamPatterns = [
          /(?:file|source|src)["']?\s*[:=]\s*["']([^"']+\.m3u8[^"']*)/gi,
          /(?:file|source|src)["']?\s*[:=]\s*["']([^"']+\.mp4[^"']*)/gi,
          /(?:url|link)["']?\s*[:=]\s*["']([^"']+(?:\.m3u8|\.mp4)[^"']*)/gi,
          /["']([^"']*(?:\.m3u8|\.mp4)[^"']*)/g,
        ];

        let streamUrl = "";
        for (const pattern of streamPatterns) {
          const matches = [...embedResponse.matchAll(pattern)];
          for (const match of matches) {
            const url = match[1];
            if (
              url &&
              (url.includes(".m3u8") || url.includes(".mp4")) &&
              url.length > 10
            ) {
              streamUrl = url;
              break;
            }
          }
          if (streamUrl) break;
        }

        if (!streamUrl) {
          lastError = `${source.name}: Stream URL not found`;
          continue;
        }

        // Clean up URL
        if (streamUrl.startsWith("//")) {
          streamUrl = `https:${streamUrl}`;
        } else if (streamUrl.startsWith("/")) {
          const baseUrlObj = new URL(source.baseUrl);
          streamUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${streamUrl}`;
        }

        // Validate URL
        if (!streamUrl.startsWith("http")) {
          lastError = `${source.name}: Invalid stream URL format`;
          continue;
        }

        // Test if the stream URL is accessible
        try {
          await proxiedFetch(streamUrl, {
            method: "HEAD",
          });
        } catch (testError) {
          lastError = `${source.name}: Stream URL not accessible`;
          continue;
        }

        // Success! Return the stream
        const streamType = streamUrl.includes(".m3u8")
          ? MWStreamType.HLS
          : MWStreamType.MP4;

        // Detect quality from URL or embed HTML
        let quality = MWStreamQuality.Q720P; // Default
        const combined = `${streamUrl} ${embedResponse}`;
        if (/1080|FHD/i.test(combined)) {
          quality = MWStreamQuality.Q1080P;
        } else if (/720|HD/i.test(combined)) {
          quality = MWStreamQuality.Q720P;
        } else if (/480|SD/i.test(combined)) {
          quality = MWStreamQuality.Q480P;
        } else if (/360/i.test(combined)) {
          quality = MWStreamQuality.Q360P;
        }

        // Extract captions
        const captions: any[] = [];
        const subPatterns = [
          /(?:subtitle|track|caption).*?src["']?\s*[:=]\s*["']([^"']+\.(?:vtt|srt))/gi,
          /(?:subtitle|track|caption).*?file["']?\s*[:=]\s*["']([^"']+\.(?:vtt|srt))/gi,
        ];

        for (const pattern of subPatterns) {
          const matches = [...embedResponse.matchAll(pattern)];
          for (const match of matches) {
            captions.push({
              needsProxy: false,
              url: match[1],
              type: match[1].includes(".vtt")
                ? MWCaptionType.VTT
                : MWCaptionType.SRT,
              langIso: "en",
            });
          }
        }

        return {
          embeds: [],
          stream: {
            streamUrl,
            quality,
            type: streamType,
            captions,
          },
        };
      } catch (error) {
        lastError = `${source.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        continue;
      }
    }

    throw new Error(`All sources failed. Last error: ${lastError}`);
  },
});
