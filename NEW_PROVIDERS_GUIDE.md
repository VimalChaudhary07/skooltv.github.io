# 🎬 New Streaming Providers Guide

This guide explains the new streaming providers added to your streaming app and how to set them up.

## 📋 Available Providers

### ✅ **Ready to Use (Enabled)**

#### 1. **VidSrc Provider** (`vidsrc.ts`)
- **Rank**: 25 (High priority)
- **Supports**: Movies, TV Series
- **Features**: Direct stream URLs, subtitle support
- **Status**: ✅ Enabled and ready to use

#### 2. **Multi Source Provider** (`multisource.ts`)
- **Rank**: 20 (Highest priority)
- **Supports**: Movies, TV Series
- **Features**: Multiple fallback sources, quality detection
- **Sources**: VidSrc.cc, VidSrc.pro, Embed.su, SuperEmbed
- **Status**: ✅ Enabled with automatic fallback

#### 3. **2Embed Provider** (`twoembed.ts`)
- **Rank**: 35
- **Supports**: Movies, TV Series
- **Features**: TMDB integration, embed-based streaming
- **Status**: ✅ Enabled

### 🔧 **Requires Setup (Disabled)**

#### 4. **Consumet FlixHQ Provider** (`consumet-flixhq.ts`)
- **Rank**: 30
- **Supports**: Movies, TV Series
- **Features**: Comprehensive API, multiple sources
- **Status**: ❌ Disabled (requires self-hosting)
- **Setup Required**: Deploy your own Consumet instance

#### 5. **Public Movies Provider** (`publicmovies.ts`)
- **Rank**: 40
- **Supports**: Movies only
- **Features**: Free public API
- **Status**: ❌ Disabled (needs testing)

#### 6. **HDStream Provider** (`hdstream.ts`)
- **Status**: ❌ Disabled (complex implementation needed)

## 🚀 Quick Start

### Immediate Use
The following providers are already enabled and working:
- ✅ **Multi Source** (tries 4 different sources)
- ✅ **VidSrc** (reliable direct streams)
- ✅ **2Embed** (TMDB-based)

### Provider Priority Order
1. **Multi Source** (Rank 20) - Tries multiple sources
2. **VidSrc** (Rank 25) - Direct streaming
3. **2Embed** (Rank 35) - Embed-based

## 🛠️ Setup Instructions

### Enable Consumet Provider

1. **Deploy Consumet API**:
   ```bash
   git clone https://github.com/consumet/api.consumet.org.git
   cd api.consumet.org
   npm install
   npm start
   ```

2. **Update the provider**:
   ```typescript
   // In consumet-flixhq.ts, update this line:
   const consumetBase = "https://your-consumet-instance.vercel.app";
   
   // Then enable it:
   disabled: false,
   ```

3. **Enable in index.ts**:
   ```typescript
   import "./providers/consumet-flixhq";
   ```

### Test Public Movies Provider

1. **Verify the API endpoint works**:
   ```bash
   curl "https://cinema-api.up.railway.app/api/search?q=avengers"
   ```

2. **If working, enable it**:
   ```typescript
   // In publicmovies.ts
   disabled: false,
   ```

3. **Add to index.ts**:
   ```typescript
   import "./providers/publicmovies";
   ```

## 📊 Provider Comparison

| Provider | Movies | Series | Quality | Subtitles | Reliability | Setup |
|----------|--------|--------|---------|-----------|-------------|-------|
| Multi Source | ✅ | ✅ | Auto-detect | ✅ | ⭐⭐⭐⭐⭐ | None |
| VidSrc | ✅ | ✅ | 720p+ | ✅ | ⭐⭐⭐⭐ | None |
| 2Embed | ✅ | ✅ | 720p | ❌ | ⭐⭐⭐ | None |
| Consumet | ✅ | ✅ | Various | ✅ | ⭐⭐⭐⭐ | Self-host |
| Public Movies | ✅ | ❌ | Various | ❌ | ⭐⭐ | Test needed |

## 🔍 How It Works

### Multi Source Provider
1. Tries VidSrc.cc first
2. Falls back to VidSrc.pro
3. Then tries Embed.su
4. Finally attempts SuperEmbed
5. Returns the first working stream

### VidSrc Provider
1. Uses IMDB ID from metadata
2. Constructs API URL based on content type
3. Fetches direct stream URL
4. Processes subtitles if available

### 2Embed Provider
1. Uses TMDB ID for content lookup
2. Embeds content via 2embed.cc
3. Extracts stream URL from embed HTML
4. Supports both movies and series

## 🎯 Best Practices

### For Maximum Reliability
1. Keep **Multi Source** as highest priority (Rank 20)
2. Use **VidSrc** as secondary (Rank 25)
3. Keep **2Embed** as fallback (Rank 35)

### For Adding New Providers
1. Follow the existing pattern in `src/backend/providers/`
2. Use the `registerProvider()` function
3. Handle errors gracefully
4. Update `src/backend/index.ts` to import your provider

### Quality Detection
```typescript
// Example quality detection logic
const detectQuality = (url: string, html: string) => {
  if (/1080|FHD/i.test(url + html)) return MWStreamQuality.Q1080P;
  if (/720|HD/i.test(url + html)) return MWStreamQuality.Q720P;
  if (/480|SD/i.test(url + html)) return MWStreamQuality.Q480P;
  return MWStreamQuality.Q360P;
};
```

## 🐛 Troubleshooting

### Common Issues

1. **"IMDB ID not available"**
   - Ensure your metadata includes IMDB IDs
   - Check TMDB API configuration

2. **"Stream URL not found"**
   - Provider may be temporarily down
   - Try a different provider

3. **CORS errors**
   - Verify proxy configuration in `helpers/fetch.ts`
   - Check `conf().PROXY_URLS` setup

### Debug Mode
Enable debug logging by modifying the provider:
```typescript
console.log(`Trying source: ${source.name}`);
console.log(`Embed URL: ${embedUrl}`);
console.log(`Stream URL found: ${streamUrl}`);
```

## 🚧 Future Enhancements

### Planned Features
- [ ] Dynamic quality selection
- [ ] Subtitle language detection
- [ ] Provider health monitoring
- [ ] Automatic provider ranking
- [ ] Stream quality testing

### Provider Ideas
- [ ] Internet Archive integration
- [ ] YouTube free movies
- [ ] Plex/Jellyfin integration
- [ ] Custom torrent streaming

## 📝 Contributing

To add a new provider:

1. Create `src/backend/providers/your-provider.ts`
2. Follow the `MWProvider` interface
3. Handle all media types you support
4. Add proper error handling
5. Include in `src/backend/index.ts`
6. Test thoroughly
7. Update this documentation

---

🎉 **Your streaming app now has multiple reliable sources!** The Multi Source provider alone gives you 4 fallback options, ensuring users can almost always find working streams.