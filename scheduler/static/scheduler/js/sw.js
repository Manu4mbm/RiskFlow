'use strict';

var CACHE_NAME = 'riskflow-shell-v2';
var RUNTIME_CACHE = 'riskflow-runtime-v2';

var APP_SHELL = [
    '/',
    '/static/scheduler/css/styles.css',
    '/static/scheduler/js/vendor/exceljs.min.js',
    '/static/scheduler/js/engine.js',
    '/static/scheduler/js/sample-data.js',
    '/static/scheduler/js/app.js',
    '/static/scheduler/manifest.json',
    '/static/scheduler/icons/icon-192.png',
    '/static/scheduler/icons/icon-512.png',
    '/static/scheduler/icons/apple-touch-icon.png',
    '/static/scheduler/icons/favicon-32.png',
    '/static/scheduler/icons/favicon-16.png',
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) { return cache.addAll(APP_SHELL); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(
                    keys
                        .filter(function (key) { return key !== CACHE_NAME && key !== RUNTIME_CACHE; })
                        .map(function (key) { return caches.delete(key); })
                );
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    event.respondWith(
        caches.match(request).then(function (cached) {
            if (cached) return cached;

            return fetch(request)
                .then(function (response) {
                    if (response && (response.ok || response.type === 'opaque')) {
                        var copy = response.clone();
                        caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
                    }
                    return response;
                })
                .catch(function () {
                    if (request.mode === 'navigate') return caches.match('/');
                });
        })
    );
});
