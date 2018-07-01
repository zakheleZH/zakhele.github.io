

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

var staticCacheName = 'olfx-static-v10';
//r contentRatesCache = 'olfx-content-rates';
var allCaches = [staticCacheName];
//'countries.json',
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(staticCacheName).then(function (cache) {
    return cache.addAll(['./', './public/js/main.js', './css/styles.css', './public/imgs/icon.png', './server/currencies.json']);
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (cacheNames) {
    return Promise.all(cacheNames.filter(function (cacheName) {
      return cacheName.startsWith('olfx-') && !allCaches.includes(cacheName);
    }).map(function (cacheName) {
      return caches.delete(cacheName);
    }));
  }));
});

self.addEventListener('fetch', function (event) {
this.addEventListener('fetch', function (event) {

  event.respondWith(caches.match(event.request).then(function (response) {
    return response || fetch(event.request);
  }));
});

/////

self.addEventListener('message', function (event) {
  if (event.data.action === 'skipWaiting' && event.data.action == 'skipWaiting') {
    self.skipWaiting();
  }
});

},{}]}