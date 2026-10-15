import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ========== CONFIG ==========
const API_BASE = 'https://api-samehadaku-li-anichin.vercel.app';

// ========== UTILITIES ==========
const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
};

// Fungsi untuk membersihkan URL dari spasi
const cleanUrl = (url) => {
    if (!url) return '';
    return url.toString().trim().replace(/\s+/g, '');
};

// ========== COMPONENT: VIDEO PLAYER ==========
const VideoPlayer = ({ stream, source, episodeUrl, onProgressSave }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [error, setError] = useState(null);
    const controlsTimeoutRef = useRef(null);

    // Fungsi untuk mendapatkan URL video yang sudah dibersihkan
    const getVideoUrl = useCallback(() => {
        if (!stream?.url) return null;

        // Bersihkan URL dari spasi
        let url = cleanUrl(stream.url);

        // Handle OK.ru URL
        if (stream.provider === 'okru') {
            // OK.ru video biasanya butuh embed URL
            if (url.includes('videoembed')) {
                return url;
            }
        }

        return url;
    }, [stream]);

    // Load video
    useEffect(() => {
        const videoUrl = getVideoUrl();
        if (!videoUrl || !videoRef.current) {
            setError('No video URL available');
            return;
        }

        const loadVideo = async () => {
            try {
                setError(null);
                setCurrentTime(0);
                setDuration(0);
                setIsPlaying(false);

                console.log('Loading video from:', videoUrl);
                videoRef.current.src = videoUrl;
                videoRef.current.load();

                // Load saved progress
                if (source && episodeUrl) {
                    const key = `watch_progress_${source}_${episodeUrl}`;
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        const time = parseFloat(saved);
                        if (time > 10) {
                            videoRef.current.currentTime = time;
                            setCurrentTime(time);
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading video:', err);
                setError(err.message);
            }
        };

        loadVideo();
    }, [stream, source, episodeUrl, getVideoUrl]);

    // Video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (Math.floor(video.currentTime) % 5 === 0 && source && episodeUrl) {
                const key = `watch_progress_${source}_${episodeUrl}`;
                localStorage.setItem(key, video.currentTime.toString());
                onProgressSave?.(video.currentTime);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setError(null);
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        const handleError = (e) => {
            console.error('Video error:', e);
            const videoError = video.error;
            if (videoError) {
                setError(`Video error: ${videoError.message || 'Unknown error'}`);
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
        };
    }, [source, episodeUrl, onProgressSave]);

    // Controls auto-hide
    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    }, [isPlaying]);

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(err => {
                console.error('Play failed:', err);
                setError('Failed to play video: ' + err.message);
            });
        } else {
            videoRef.current.pause();
        }
    };

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * duration;
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = volume || 0.5;
                setIsMuted(false);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    const toggleFullscreen = () => {
        const container = videoRef.current?.parentElement;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(v => Math.min(1, v + 0.1));
                    if (videoRef.current) videoRef.current.volume = Math.min(1, volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(v => Math.max(0, v - 0.1));
                    if (videoRef.current) videoRef.current.volume = Math.max(0, volume - 0.1);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [duration, volume, isPlaying]);

    // Render error state
    if (error) {
        return (
            <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <i className="ri-error-warning-line text-4xl text-red-500 mb-3"></i>
                    <p className="text-red-400 font-medium mb-2">Video Error</p>
                    <p className="text-gray-400 text-sm mb-4">{error}</p>
                    <p className="text-xs text-gray-500">Try refreshing or check if the video source is available</p>
                </div>
            </div>
        );
    }

    if (!stream?.url) {
        return (
            <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
                <div className="text-center">
                    <i className="ri-video-off-line text-4xl text-gray-600 mb-2"></i>
                    <p className="text-gray-400">No stream available</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative group bg-black rounded-xl overflow-hidden aspect-video"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                className="w-full h-full"
                poster={stream.thumbnail}
                onClick={togglePlay}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
            />

            {/* Loading indicator */}
            {videoRef.current?.readyState < 3 && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <i className="ri-loader-4-line text-3xl text-white animate-spin"></i>
                </div>
            )}

            {/* Controls overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* Top controls */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-600/80 rounded text-xs font-medium text-white">
                            {stream.provider?.toUpperCase() || 'STREAM'}
                        </span>
                        {stream.quality && stream.quality !== 'unknown' && (
                            <span className="px-2 py-1 bg-black/60 rounded text-xs text-white">
                                {stream.quality}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <i className={`ri-${isFullscreen ? 'fullscreen-exit' : 'fullscreen'}-line text-white`}></i>
                    </button>
                </div>

                {/* Center play button (when paused) */}
                {!isPlaying && (
                    <button
                        onClick={togglePlay}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="w-16 h-16 bg-purple-600/90 rounded-full flex items-center justify-center hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/30">
                            <i className="ri-play-fill text-3xl text-white ml-1"></i>
                        </div>
                    </button>
                )}

                {/* Bottom controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                    {/* Progress bar */}
                    <div
                        className="h-1.5 bg-white/20 rounded-full cursor-pointer group/progress"
                        onClick={handleSeek}
                    >
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full relative"
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow"></div>
                        </div>
                    </div>

                    {/* Control buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <i className={`ri-${isPlaying ? 'pause' : 'play'}-fill text-white text-xl`}></i>
                            </button>

                            <div className="flex items-center gap-2 group/volume">
                                <button onClick={toggleMute} className="p-1 hover:bg-white/10 rounded">
                                    <i className={`ri-${isMuted || volume === 0 ? 'volume-mute' : volume < 0.5 ? 'volume-down' : 'volume-up'}-line text-white`}></i>
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-purple-500"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            <span className="text-xs text-white/80 font-mono">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                className="px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white focus:outline-none"
                                defaultValue="1"
                                onChange={(e) => {
                                    if (videoRef.current) videoRef.current.playbackRate = parseFloat(e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="0.5">0.5x</option>
                                <option value="0.75">0.75x</option>
                                <option value="1">1x</option>
                                <option value="1.25">1.25x</option>
                                <option value="1.5">1.5x</option>
                                <option value="2">2x</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ========== COMPONENT: EPISODE CARD ==========
const EpisodeCard = ({ episode, isActive, onClick }) => {
    // Bersihkan thumbnail URL
    const thumbnail = episode.thumbnail?.split(',')[0]?.trim() || '';

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex gap-3 group ${isActive
                    ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/50'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
        >
            <div className="relative w-20 h-14 bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={episode.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/80x56?text=No+Image';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-film-line text-gray-600"></i>
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300'
                        }`}>
                        Eps {episode.number}
                    </span>
                    {isActive && (
                        <span className="text-xs text-purple-400 flex items-center gap-1">
                            <i className="ri-play-fill"></i> Playing
                        </span>
                    )}
                </div>
                <p className={`text-sm line-clamp-2 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {episode.title}
                </p>
                {episode.info && <p className="text-xs text-gray-500 mt-1">{episode.info}</p>}
            </div>
        </button>
    );
};

// ========== COMPONENT: SKELETON LOADER ==========
const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`}></div>
);

// ========== MAIN COMPONENT ==========
const WatchPage = () => {
    const { type, slug } = useParams();
    const navigate = useNavigate();

    const validTypes = ['anime', 'donghua'];
    const safeType = validTypes.includes(type) ? type : 'anime';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStream, setSelectedStream] = useState(null);
    const [activeTab, setActiveTab] = useState('episodes');

    useEffect(() => {
        const fetchData = async () => {
            if (!slug) {
                setError('Slug is required');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const endpoint = `${API_BASE}/api/${safeType}/watch/${slug}`;
                console.log('Fetching:', endpoint);

                const res = await fetch(endpoint);

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const result = await res.json();
                console.log('API Response:', result);

                if (!result.success) {
                    throw new Error(result.error || 'Failed to fetch data');
                }

                setData(result.data);

                // Bersihkan URL stream dari spasi
                if (result.data?.streams?.length > 0) {
                    const cleanedStreams = result.data.streams.map(stream => ({
                        ...stream,
                        url: cleanUrl(stream.url)
                    }));
                    setSelectedStream(cleanedStreams[0]);
                }
            } catch (err) {
                setError(err.message);
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug, safeType]);

    const handleNavigate = (url) => {
        if (!url) return;

        const cleanEpisodeUrl = cleanUrl(url);
        const match = cleanEpisodeUrl.match(/\/([^/]+-subtitle-indonesia)\/?$/);
        if (match?.[1]) {
            navigate(`/watch/${safeType}/${match[1]}`);
        } else {
            window.open(cleanEpisodeUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleProgressSave = (time) => {
        console.log('Progress saved:', time);
    };

    if (!slug) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <i className="ri-question-line text-5xl text-gray-600 mb-4"></i>
                    <h2 className="text-xl font-bold mb-2">Episode not found</h2>
                    <p className="text-gray-400 mb-6">Please check the URL or go back to home</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white">
                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    <Skeleton className="aspect-video w-full" />
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <i className="ri-error-warning-line text-5xl text-red-500 mb-4"></i>
                    <h2 className="text-xl font-bold mb-2">Oops! Something went wrong</h2>
                    <p className="text-gray-400 mb-6">{error || 'Failed to load episode'}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { episode, streams, navigation, related_episodes, recommendations, series_details, episode_list, source } = data;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <i className="ri-arrow-left-line text-xl"></i>
                        </button>
                        <div>
                            <h1 className="font-bold text-lg line-clamp-1">
                                {episode?.series_title || episode?.title || 'Loading...'}
                            </h1>
                            <p className="text-sm text-gray-400">
                                Episode {episode?.number || '?'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${safeType === 'donghua'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                            {safeType === 'donghua' ? '🇨🇳 Donghua' : '🇯🇵 Anime'}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
                {/* Video Player Section */}
                <section className="space-y-4">
                    <VideoPlayer
                        stream={selectedStream}
                        source={source}
                        episodeUrl={data.url}
                        onProgressSave={handleProgressSave}
                    />

                    {/* Stream Selector */}
                    {streams?.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                            {streams.map((stream, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedStream({
                                        ...stream,
                                        url: cleanUrl(stream.url)
                                    })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedStream?.url === cleanUrl(stream.url)
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                                        }`}
                                >
                                    <i className={`ri-${stream.provider === 'okru' ? 'video-on' :
                                            stream.provider === 'blogger' ? 'google' : 'server'
                                        }-line mr-1`}></i>
                                    {stream.server || stream.provider}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* Episode Info & Actions */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-xl font-bold mb-2">{episode?.title}</h2>
                        {episode?.release_date && (
                            <p className="text-gray-400 text-sm">
                                Released: {new Date(episode.release_date).toLocaleDateString()}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => handleNavigate(navigation?.prev?.url)}
                            disabled={!navigation?.prev?.url}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            <i className="ri-skip-back-fill"></i>
                            <span className="hidden sm:inline">Prev</span>
                        </button>

                        <button
                            onClick={() => handleNavigate(navigation?.next?.url)}
                            disabled={!navigation?.next?.url}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <i className="ri-skip-forward-fill"></i>
                        </button>

                        {(data.download_url || data.has_download || data.has_downloads) && (
                            <a
                                href={cleanUrl(data.download_url || '#')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors border border-green-500/30"
                            >
                                <i className="ri-download-line"></i>
                                Download
                            </a>
                        )}

                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                            <i className="ri-share-line"></i>
                            <span className="hidden sm:inline">Share</span>
                        </button>
                    </div>
                </section>

                {/* Series Info (for anime) */}
                {series_details && (
                    <section className="bg-gradient-to-br from-gray-900 to-gray-900/50 rounded-xl p-5 border border-white/10">
                        <div className="flex flex-col md:flex-row gap-4">
                            {series_details.thumbnail && (
                                <img
                                    src={series_details.thumbnail.split(',')[0].trim()}
                                    alt={series_details.title}
                                    className="w-24 h-36 object-cover rounded-lg shadow-lg"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://via.placeholder.com/96x144?text=No+Image';
                                    }}
                                />
                            )}

                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3 className="font-bold text-lg">{series_details.title}</h3>
                                    {series_details.alt_titles && (
                                        <p className="text-sm text-gray-400">{series_details.alt_titles}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                    {series_details.info?.status && (
                                        <span><i className="ri-time-line mr-1"></i>{series_details.info.status}</span>
                                    )}
                                    {series_details.info?.released && (
                                        <span><i className="ri-calendar-line mr-1"></i>{series_details.info.released}</span>
                                    )}
                                    {series_details.info?.type && (
                                        <span><i className="ri-movie-line mr-1"></i>{series_details.info.type}</span>
                                    )}
                                    {series_details.info?.episodes && (
                                        <span><i className="ri-list-unordered mr-1"></i>{series_details.info.episodes} Eps</span>
                                    )}
                                </div>

                                {series_details.genres?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {series_details.genres.slice(0, 5).map((genre, i) => (
                                            <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {series_details.synopsis && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <p className="text-sm text-gray-300 line-clamp-3">{series_details.synopsis}</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Tabs: Episodes / Related / Recommendations */}
                <section className="space-y-4">
                    <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
                        {[
                            { id: 'episodes', label: 'Episodes', count: episode_list?.length },
                            { id: 'related', label: 'Related', count: related_episodes?.length },
                            { id: 'recommendations', label: 'Recommendations', count: recommendations?.length }
                        ].filter(tab => tab.count > 0).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-purple-600 text-white shadow'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/10'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {activeTab === 'episodes' && episode_list?.map((ep, idx) => (
                            <EpisodeCard
                                key={idx}
                                episode={{
                                    ...ep,
                                    thumbnail: ep.thumbnail
                                }}
                                isActive={ep.is_current}
                                onClick={() => handleNavigate(ep.url)}
                            />
                        ))}

                        {activeTab === 'related' && related_episodes?.map((ep, idx) => (
                            <EpisodeCard
                                key={idx}
                                episode={{
                                    ...ep,
                                    thumbnail: ep.thumbnail
                                }}
                                isActive={ep.is_current}
                                onClick={() => handleNavigate(ep.url)}
                            />
                        ))}

                        {activeTab === 'recommendations' && recommendations?.map((rec, idx) => {
                            const recUrl = typeof rec.url === 'string' ? rec.url : rec.url?.detail;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const match = recUrl?.match(/\/([^/]+-subtitle-indonesia)\/?$/);
                                        if (match?.[1]) {
                                            navigate(`/watch/${safeType}/${match[1]}`);
                                        } else if (recUrl) {
                                            window.open(recUrl, '_blank');
                                        }
                                    }}
                                    className="text-left p-3 rounded-lg hover:bg-white/5 transition-colors group"
                                >
                                    <div className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden mb-3">
                                        {rec.image ? (
                                            <img
                                                src={rec.image.split(',')[0].trim()}
                                                alt={rec.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://via.placeholder.com/300x400?text=No+Image';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <i className="ri-image-line text-gray-600 text-2xl"></i>
                                            </div>
                                        )}
                                        {rec.status && (
                                            <span className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs">
                                                {rec.status}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-medium text-sm line-clamp-2 group-hover:text-purple-400 transition-colors">
                                        {rec.title}
                                    </h4>
                                    {rec.episode_info && (
                                        <p className="text-xs text-gray-500 mt-1">{rec.episode_info}</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 mt-12 py-6 text-center text-sm text-gray-500">
                <p>Streamed via {source?.toUpperCase()} • For educational purposes only</p>
                <p className="mt-1">Support creators by watching on official platforms 🙏</p>
            </footer>
        </div>
    );
};

export default WatchPage;