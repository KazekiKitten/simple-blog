document.addEventListener('DOMContentLoaded', function() {
    const cache = new Map(); // url -> {content, timestamp}
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms

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

    function isCached(href) {
        if (cache.has(href)) {
            const entry = cache.get(href);
            return Date.now() - entry.timestamp < CACHE_DURATION;
        }
        return false;
    }

    async function prefetchHTML(href) {
        try {
            const response = await fetch(href);
            if (response.ok) {
                const content = await response.text();
                cache.set(href, { content, timestamp: Date.now() });
            }
        } catch (error) {
            console.log('Prefetch failed:', error);
        }
    }

    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('mouseenter', function() {
            const href = this.getAttribute('href');
            if (isBlogLink(href) && !isLowBandwidth() && !isCached(href)) {
                prefetchHTML(href);
            }
        });
    });
});