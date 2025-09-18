document.addEventListener('DOMContentLoaded', function() {
    const CACHE_KEY = 'blog_prefetch_cache';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in ms for aggressive caching

    // Load cache from localStorage
    function loadCache() {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    // Save cache to localStorage
    function saveCache(cache) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
            // localStorage might be full, clear old entries
            clearOldCache();
        }
    }

    // Clear expired cache entries
    function clearOldCache() {
        const cache = loadCache();
        const now = Date.now();
        let hasChanges = false;

        for (const [href, entry] of Object.entries(cache)) {
            if (now - entry.timestamp > CACHE_DURATION) {
                delete cache[href];
                hasChanges = true;
            }
        }

        if (hasChanges) {
            saveCache(cache);
        }
    }

    function isBlogLink(href) {
        return href && href.endsWith('.html') && !href.includes('index.html') && !href.startsWith('http');
    }

    function isLowBandwidth() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
        }
        return false;
    }

    function isCached(href, cache) {
        if (cache[href]) {
            const entry = cache[href];
            return Date.now() - entry.timestamp < CACHE_DURATION;
        }
        return false;
    }

    async function prefetchHTML(href, cache) {
        try {
            const response = await fetch(href, {
                headers: {
                    'Cache-Control': 'max-age=3600', // 1 hour browser cache
                }
            });
            if (response.ok) {
                const content = await response.text();
                cache[href] = { content, timestamp: Date.now() };
                saveCache(cache);
            }
        } catch (error) {
            console.log('Prefetch failed:', error);
        }
    }

    // Aggressive prefetch: prefetch all blog links on page load
    function prefetchAllBlogLinks() {
        if (isLowBandwidth()) return;

        const cache = loadCache();
        const links = document.querySelectorAll('a[href]');
        const prefetchPromises = [];

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (isBlogLink(href) && !isCached(href, cache)) {
                prefetchPromises.push(prefetchHTML(href, cache));
            }
        });

        // Limit concurrent prefetches to avoid overwhelming
        const batchSize = 3;
        for (let i = 0; i < prefetchPromises.length; i += batchSize) {
            setTimeout(() => {
                Promise.all(prefetchPromises.slice(i, i + batchSize));
            }, i * 100); // Stagger requests
        }
    }

    // Clear old cache entries on load
    clearOldCache();

    // Start aggressive prefetching
    prefetchAllBlogLinks();

    // Also prefetch on hover as backup
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('mouseenter', function() {
            const href = this.getAttribute('href');
            if (isBlogLink(href) && !isLowBandwidth()) {
                const cache = loadCache();
                if (!isCached(href, cache)) {
                    prefetchHTML(href, cache);
                }
            }
        });
    });
});