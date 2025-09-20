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

    // Pagination logic - optimized for speed
    let articles = sortedArticles;
    const itemsPerPage = 5;
    let currentPage = 1;
    let totalPages = Math.ceil(articles.length / itemsPerPage);
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    function showPage(page) {
        if (isSearching) return; // Don't paginate when searching
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        for (let i = 0; i < articles.length; i++) {
            articles[i].style.display = (i >= start && i < end) ? 'block' : 'none';
        }
        updatePagination();
    }

    function updatePagination() {
        if (totalPages > 1) {
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
        } else {
            pageInfo.textContent = '';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            showPage(currentPage);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            showPage(currentPage);
        }
    });

    // Search functionality
    const searchBar = document.getElementById('search-bar');
    let isSearching = false;
    const originalArticles = Array.from(document.querySelectorAll('main article'));
    let sortedArticles = [...originalArticles];

    function performSearch() {
        const query = searchBar.value.toLowerCase().trim();
        const articles = sortedArticles;

        if (query === '') {
            isSearching = false;
            showPage(currentPage);
            document.getElementById('pagination').style.display = 'flex';
            return;
        }

        isSearching = true;
        document.getElementById('pagination').style.display = 'none';

        articles.forEach(article => {
            const h2 = article.querySelector('h2').textContent.toLowerCase();
            const p = article.querySelector('p').textContent.toLowerCase();
            const category = article.getAttribute('data-category').toLowerCase();
            const matches = h2.includes(query) || p.includes(query) || category.includes(query);
            article.style.display = matches ? 'block' : 'none';
        });
    }

    function sortArticles() {
        const sortValue = document.getElementById('sort-select').value;
        const main = document.querySelector('main');

        if (sortValue === 'default') {
            sortedArticles = [...originalArticles];
        } else if (sortValue === 'alpha') {
            sortedArticles = [...originalArticles].sort((a, b) => {
                const aTitle = a.querySelector('h2').textContent.toLowerCase();
                const bTitle = b.querySelector('h2').textContent.toLowerCase();
                return aTitle.localeCompare(bTitle);
            });
        } else if (sortValue === 'category') {
            sortedArticles = [...originalArticles].sort((a, b) => {
                const aCat = a.getAttribute('data-category').toLowerCase();
                const bCat = b.getAttribute('data-category').toLowerCase();
                return aCat.localeCompare(bCat);
            });
        }

        // Re-append sorted articles
        sortedArticles.forEach(article => main.appendChild(article));

        // Update articles and totalPages
        articles = sortedArticles;
        totalPages = Math.ceil(articles.length / itemsPerPage);

        // Reset to first page
        currentPage = 1;
        showPage(currentPage);
    }

    searchBar.addEventListener('input', performSearch);
    document.getElementById('sort-select').addEventListener('change', sortArticles);

    // Initialize pagination
    showPage(currentPage);
});