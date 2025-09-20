document.addEventListener('DOMContentLoaded', function() {
    const CACHE_KEY = 'blog_prefetch_cache';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    function loadCache() {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    function saveCache(cache) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
            clearOldCache(); 
        }
    }

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

        if (hasChanges) saveCache(cache);
    }

    function isBlogLink(href) {
        return href && href.endsWith('.html') && !href.includes('index.html') && !href.startsWith('http');
    }

    function isLowBandwidth() {
        if ('connection' in navigator) {
            const c = navigator.connection;
            return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
        }
        return false;
    }

    function isCached(href, cache) {
        if (cache[href]) {
            return Date.now() - cache[href].timestamp < CACHE_DURATION;
        }
        return false;
    }

    async function prefetchHTML(href, cache) {
        try {
            const response = await fetch(href, {
                headers: { 'Cache-Control': 'max-age=3600' }
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

        const batchSize = 3;
        for (let i = 0; i < prefetchPromises.length; i += batchSize) {
            setTimeout(() => {
                Promise.all(prefetchPromises.slice(i, i + batchSize));
            }, i * 100);
        }
    }

    function setupLazyPrefetch() {
        if (isLowBandwidth()) return;
        const cache = loadCache();
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const href = entry.target.getAttribute('href');
                    if (isBlogLink(href) && !isCached(href, cache)) {
                        prefetchHTML(href, cache);
                    }
                    observer.unobserve(entry.target);
                }
            });
        });

        document.querySelectorAll('a[href]').forEach(link => observer.observe(link));
    }

    function setupHoverPrefetch() {
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
    }

    clearOldCache();

    if ('requestIdleCallback' in window) {
        requestIdleCallback(prefetchAllBlogLinks, { timeout: 2000 });
    } else {
        setTimeout(prefetchAllBlogLinks, 1000);
    }

    setupLazyPrefetch();
    setupHoverPrefetch();

    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    const originalArticles = Array.from(document.querySelectorAll('main article'));
    originalArticles.forEach(article => {
        const timestamp = article.getAttribute('data-timestamp');
        const dateElement = article.querySelector('.post-date');
        if (dateElement && timestamp) {
            dateElement.textContent = formatDate(timestamp);
        }
    });
    let sortedArticles = [...originalArticles];
    const searchBar = document.getElementById('search-bar');
    let isSearching = false;

    let articles = sortedArticles;
    const itemsPerPage = 5;
    let currentPage = 1;
    let totalPages = Math.ceil(articles.length / itemsPerPage);
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    function showPage(page) {
        if (isSearching) return;
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

        if (sortValue === 'newest') {
            sortedArticles = [...originalArticles].sort((a, b) =>
                new Date(b.getAttribute('data-timestamp')) - new Date(a.getAttribute('data-timestamp'))
            );
        } else if (sortValue === 'oldest') {
            sortedArticles = [...originalArticles].sort((a, b) =>
                new Date(a.getAttribute('data-timestamp')) - new Date(b.getAttribute('data-timestamp'))
            );
        } else if (sortValue === 'alpha') {
            sortedArticles = [...originalArticles].sort((a, b) =>
                a.querySelector('h2').textContent.toLowerCase().localeCompare(
                    b.querySelector('h2').textContent.toLowerCase()
                )
            );
        } else if (sortValue === 'category') {
            sortedArticles = [...originalArticles].sort((a, b) =>
                a.getAttribute('data-category').toLowerCase().localeCompare(
                    b.getAttribute('data-category').toLowerCase()
                )
            );
        }

        sortedArticles.forEach(article => main.appendChild(article));
        articles = sortedArticles;
        totalPages = Math.ceil(articles.length / itemsPerPage);
        currentPage = 1;
        showPage(currentPage);
    }

    searchBar.addEventListener('input', performSearch);
    document.getElementById('sort-select').addEventListener('change', sortArticles);

    sortArticles();
    showPage(currentPage);
});
