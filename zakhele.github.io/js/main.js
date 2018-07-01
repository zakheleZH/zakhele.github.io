(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
    'use strict';
    
    (function() {
      function toArray(arr) {
        return Array.prototype.slice.call(arr);
      }
    
      function promisifyRequest(request) {
        return new Promise(function(resolve, reject) {
          request.onsuccess = function() {
            resolve(request.result);
          };
    
          request.onerror = function() {
            reject(request.error);
          };
        });
      }
    
      function promisifyRequestCall(obj, method, args) {
        var request;
        var p = new Promise(function(resolve, reject) {
          request = obj[method].apply(obj, args);
          promisifyRequest(request).then(resolve, reject);
        });
    
        p.request = request;
        return p;
      }
    
      function promisifyCursorRequestCall(obj, method, args) {
        var p = promisifyRequestCall(obj, method, args);
        return p.then(function(value) {
          if (!value) return;
          return new Cursor(value, p.request);
        });
      }
    
      function proxyProperties(ProxyClass, targetProp, properties) {
        properties.forEach(function(prop) {
          Object.defineProperty(ProxyClass.prototype, prop, {
            get: function() {
              return this[targetProp][prop];
            },
            set: function(val) {
              this[targetProp][prop] = val;
            }
          });
        });
      }
    
      function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return promisifyRequestCall(this[targetProp], prop, arguments);
          };
        });
      }
    
      function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return this[targetProp][prop].apply(this[targetProp], arguments);
          };
        });
      }
    
      function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return promisifyCursorRequestCall(this[targetProp], prop, arguments);
          };
        });
      }
    
      function Index(index) {
        this._index = index;
      }
    
      proxyProperties(Index, '_index', [
        'name',
        'keyPath',
        'multiEntry',
        'unique'
      ]);
    
      proxyRequestMethods(Index, '_index', IDBIndex, [
        'get',
        'getKey',
        'getAll',
        'getAllKeys',
        'count'
      ]);
    
      proxyCursorRequestMethods(Index, '_index', IDBIndex, [
        'openCursor',
        'openKeyCursor'
      ]);
    
      function Cursor(cursor, request) {
        this._cursor = cursor;
        this._request = request;
      }
    
      proxyProperties(Cursor, '_cursor', [
        'direction',
        'key',
        'primaryKey',
        'value'
      ]);
    
      proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
        'update',
        'delete'
      ]);
    
      // proxy 'next' methods
      ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
        if (!(methodName in IDBCursor.prototype)) return;
        Cursor.prototype[methodName] = function() {
          var cursor = this;
          var args = arguments;
          return Promise.resolve().then(function() {
            cursor._cursor[methodName].apply(cursor._cursor, args);
            return promisifyRequest(cursor._request).then(function(value) {
              if (!value) return;
              return new Cursor(value, cursor._request);
            });
          });
        };
      });
    
      function ObjectStore(store) {
        this._store = store;
      }
    
      ObjectStore.prototype.createIndex = function() {
        return new Index(this._store.createIndex.apply(this._store, arguments));
      };
    
      ObjectStore.prototype.index = function() {
        return new Index(this._store.index.apply(this._store, arguments));
      };
    
      proxyProperties(ObjectStore, '_store', [
        'name',
        'keyPath',
        'indexNames',
        'autoIncrement'
      ]);
    
      proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
        'put',
        'add',
        'delete',
        'clear',
        'get',
        'getAll',
        'getKey',
        'getAllKeys',
        'count'
      ]);
    
      proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
        'openCursor',
        'openKeyCursor'
      ]);
    
      proxyMethods(ObjectStore, '_store', IDBObjectStore, [
        'deleteIndex'
      ]);
    
      function Transaction(idbTransaction) {
        this._tx = idbTransaction;
        this.complete = new Promise(function(resolve, reject) {
          idbTransaction.oncomplete = function() {
            resolve();
          };
          idbTransaction.onerror = function() {
            reject(idbTransaction.error);
          };
          idbTransaction.onabort = function() {
            reject(idbTransaction.error);
          };
        });
      }
    
      Transaction.prototype.objectStore = function() {
        return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
      };
    
      proxyProperties(Transaction, '_tx', [
        'objectStoreNames',
        'mode'
      ]);
    
      proxyMethods(Transaction, '_tx', IDBTransaction, [
        'abort'
      ]);
    
      function UpgradeDB(db, oldVersion, transaction) {
        this._db = db;
        this.oldVersion = oldVersion;
        this.transaction = new Transaction(transaction);
      }
    
      UpgradeDB.prototype.createObjectStore = function() {
        return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
      };
    
      proxyProperties(UpgradeDB, '_db', [
        'name',
        'version',
        'objectStoreNames'
      ]);
    
      proxyMethods(UpgradeDB, '_db', IDBDatabase, [
        'deleteObjectStore',
        'close'
      ]);
    
      function DB(db) {
        this._db = db;
      }
    
      DB.prototype.transaction = function() {
        return new Transaction(this._db.transaction.apply(this._db, arguments));
      };
    
      proxyProperties(DB, '_db', [
        'name',
        'version',
        'objectStoreNames'
      ]);
    
      proxyMethods(DB, '_db', IDBDatabase, [
        'close'
      ]);
    
      // Add cursor iterators
      // TODO: remove this once browsers do the right thing with promises
      ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
        [ObjectStore, Index].forEach(function(Constructor) {
          // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
          if (!(funcName in Constructor.prototype)) return;
    
          Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
            var args = toArray(arguments);
            var callback = args[args.length - 1];
            var nativeObject = this._store || this._index;
            var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
            request.onsuccess = function() {
              callback(request.result);
            };
          };
        });
      });
    
      // polyfill getAll
      [Index, ObjectStore].forEach(function(Constructor) {
        if (Constructor.prototype.getAll) return;
        Constructor.prototype.getAll = function(query, count) {
          var instance = this;
          var items = [];
    
          return new Promise(function(resolve) {
            instance.iterateCursor(query, function(cursor) {
              if (!cursor) {
                resolve(items);
                return;
              }
              items.push(cursor.value);
    
              if (count !== undefined && items.length == count) {
                resolve(items);
                return;
              }
              cursor.continue();
            });
          });
        };
      });
    
      var exp = {
        open: function(name, version, upgradeCallback) {
          var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
          var request = p.request;
    
          if (request) {
            request.onupgradeneeded = function(event) {
              if (upgradeCallback) {
                upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
              }
            };
          }
    
          return p.then(function(db) {
            return new DB(db);
          });
        },
        delete: function(name) {
          return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
        }
      };
    
      if (typeof module !== 'undefined') {
        module.exports = exp;
        module.exports.default = module.exports;
      }
      else {
        self.idb = exp;
      }
    }());
    
    },{}],2:[function(require,module,exports){
    'use strict';
    
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    var _idb = require('idb');
    
    var _idb2 = _interopRequireDefault(_idb);
    
    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    var openDatabase = function openDatabase() {
      // If the browser doesn't support service worker,
      // we don't care about having a database
      if (!navigator.serviceWorker) {
        return Promise.resolve();
      }
    
      return _idb2.default.open('olfx', 2, function (upgradeDb) {
        var store = upgradeDb.createObjectStore('olfxs');
        //store.createIndex('CurrencyIndex', ['currency.from', 'currency.to']);
      });
    };
    
    var IndexController = function () {
      function IndexController() {
        _classCallCheck(this, IndexController);
    
        this._dbPromise = openDatabase();
        this._registerServiceWorker();
      }
    
      _createClass(IndexController, [{
        key: 'setDB',
        value: function setDB(key, val) {
          return this._dbPromise.then(function (db) {
            var tx = db.transaction('olfxs', 'readwrite');
            tx.objectStore('olfxs').put(val, key);
            var splits = key.split('-');
            var newKey = splits[1] + '-' + splits[0];
            tx.objectStore('olfxs').put(val, newKey);
            return tx.complete;
          });
        }
      }, {
        key: 'getDB',
        value: function getDB(key) {
          return this._dbPromise.then(function (db) {
            return db.transaction('olfxs').objectStore('olfxs').get(key);
          });
        }
      }, {
        key: 'getDBKeys',
        value: function getDBKeys() {
          return this._dbPromise.then(function (db) {
            var tx = db.transaction('olfxs');
            var keys = [];
            var store = tx.objectStore('olfxs');
    
            // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
            // openKeyCursor isn't supported by Safari, so we fall back
            (store.iterateKeyCursor || store.iterateCursor).call(store, function (cursor) {
              if (!cursor) return;
              keys.push(cursor.key);
              cursor.continue();
            });
    
            return tx.complete.then(function () {
              return keys;
            });
          });
        }
      }, {
        key: '_registerServiceWorker',
        value: function _registerServiceWorker() {
          var _this = this;
    
          if (!navigator.serviceWorker) return;
    
          var indexController = this;
    
          navigator.serviceWorker.register('/sw.js').then(function (reg) {
            if (!navigator.serviceWorker.controller) {
              return;
            }
    
            if (reg.waiting) {
              _this._updateReady(reg.waiting);
              return;
            }
    
            if (reg.installing) {
              indexController._trackInstalling(reg.installing);
              return;
            }
    
            reg.addEventListener('updatefound', function () {
              indexController._trackInstalling(reg.installing);
            });
          });
    
          // Ensure refresh is only called once.
          // This works around a bug in "force update on reload".
          var refreshing = void 0;
          navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
          });
        }
      }, {
        key: '_updateReady',
        value: function _updateReady(worker) {
          worker.postMessage({ action: 'skipWaiting' });
        }
      }, {
        key: '_trackInstalling',
        value: function _trackInstalling(worker) {
          var indexController = this;
          worker.addEventListener('statechange', function () {
            if (worker.state == 'installed') {
              indexController._updateReady(worker);
            }
          });
        }
      }]);
    
      return IndexController;
    }();
    
    exports.default = IndexController;
    
    },{"idb":1}],3:[function(require,module,exports){
    'use strict';
    
    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.Compute = undefined;
    
    var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
    
    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
    
    var _IndexController = require('./IndexController');
    
    var _IndexController2 = _interopRequireDefault(_IndexController);
    
    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
    
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    
    //const COUNTRIESURL = '/countries.json';
    var CURRENCIESURL = 'server/currencies.json';
    var mmap = { 'to_currency_select_id': 'currency_input_1',
        'from_currency_select_id': 'currency_input_2' };
    var dmap = { 'to_currency_select_id': 'currency_input_2',
        'from_currency_select_id': 'currency_input_1' };
    
    var mcompute = void 0;
    
    var Compute = exports.Compute = function () {
        function Compute() {
            _classCallCheck(this, Compute);
    
            //this._countries = this.lfetch(COUNTRIESURL)['results'];
            this._currencies = this.lfetch(CURRENCIESURL)['results'];
            this._setting = {};
            this._cuList = [];
            this._indexController = new _IndexController2.default();
        }
    
        _createClass(Compute, [{
            key: 'lfetch',
            value: async function lfetch(url) {
                var rst = await fetch(url);
                var mm = await rst.json();
                //console.log(mm.results);
                return mm.results;
            }
        }, {
            key: 'setup',
            value: async function setup() {
                var currencies = [];
                var val = void 0;
                //console.log(this._currencies);
                var bb = await this.lfetch(CURRENCIESURL);
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;
    
                try {
                    for (var _iterator = Object.keys(bb)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var ky = _step.value;
    
                        val = bb[ky];
                        var tmpl = '<option value="' + val['id'] + '">' + val['currencyName'] + '</option>';
                        currencies.push(tmpl);
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
    
                var rst = currencies.join('');
                return rst;
            }
        }, {
            key: 'loadAfterHTML',
            value: async function loadAfterHTML() {
                var options = await this.setup();
    
                var right = document.getElementById('right');
                var left = document.getElementById('left');
                right.innerHTML = selectHMTL(options, 'to_currency_select_id');
                left.innerHTML = selectHMTL(options, 'from_currency_select_id');
            }
        }, {
            key: 'checkAndCompute',
            value: function checkAndCompute(event, from, to) {
                if (from.value < 0) { from.value = 0; return;}
            if (!this._setting[event.target.id]) {
                   if(from.value < 0) {
                     from.value = 0;
                     return; }
                     to.value = from.value;  return;
                   }
               // if (from.value < 0) { from.value = 0; return;}
                var vl = from.value * this._setting[event.target.id][1];
                to.value = Math.round(vl * 100) / 100;
            }
        }, {
            key: '_setSetting1',
            value: function _setSetting1(id1, idp1, id2, idp2) {
                var _gtSelectObjs = gtSelectObjs(),
                    _gtSelectObjs2 = _slicedToArray(_gtSelectObjs, 2),
                    from = _gtSelectObjs2[0],
                    to = _gtSelectObjs2[1];
    
                this._cuList[0] = from.value;
                this._cuList[1] = to.value;
                this._setting[id1] = [idp1];
                this._setting[id2] = [idp2];
            }
        }, {
            key: '_setSetting2',
            value: function _setSetting2(id1, idp1, id2, idp2) {
                var _gtSelectObjs3 = gtSelectObjs(),
                    _gtSelectObjs4 = _slicedToArray(_gtSelectObjs3, 2),
                    to = _gtSelectObjs4[0],
                    from = _gtSelectObjs4[1];
    
                this._cuList[0] = from.value;
                this._cuList[1] = to.value;
                this._setting[id1] = [idp1];
                this._setting[id2] = [idp2];
            }
        }, {
            key: '_addToSetting',
            value: function _addToSetting(val0, val1) {
                this._setting['currency_input_2'].push(Number(val0));
                this._setting['currency_input_1'].push(Number(val1));
            }
        }, {
            key: '_fetchUrl',
            value: async function _fetchUrl(url) {
                var rst = await fetch(url);
                var rsj = await rst.json();
                return rsj;
            }
        }, {
            key: 'processInput',
            value: async function processInput(event) {
    
                var from = void 0,
                    to = void 0,
                    total = void 0;
                if (event.target.id == 'from_currency_select_id') {
                    this._setSetting1('currency_input_1', 'from', 'currency_input_2', 'to');
                }
                if (event.target.id == 'to_currency_select_id') {
                    this._setSetting2('currency_input_2', 'from', 'currency_input_1', 'to');
                }
    
                var vl = void 0,
                    url = void 0,
                    rst = this._cuList.join('-'),
                    storeVal = await this._indexController.getDB(rst);
                    let page = `https://free.currencyconverterapi.com/api/v3/convert?q=${this._cuList[0]}_${this._cuList[1]},${this._cuList[1]}_${this._cuList[0]}&compact=ultra`;
                if (!storeVal) {
                    try {
                        url = '/currencies/' + rst;
                        //vl = await this._fetchUrl(url);
                        vl = await this._fetchUrl(page);
                        if (!vl) {
                            throw new Error();
                        }
                        console.log(vl);
                        this._indexController.setDB(rst, vl);
                        resetToMsgInnerHtml();
                    } catch (e) {
                        setErrorMsg('tomsg');
                        return;
                    }
                } else {
                    vl = storeVal;
                    resetToMsgInnerHtml();
                }
                //console.log(vl);
                var kys = Object.keys(vl);
                //console.log(kys);
                if (kys[0].startsWith(this._cuList[0])) {
                    total = calConvert(dmap[event.target.id], vl[kys[0]]);
                    setVal(mmap[event.target.id], total);
                    if (this._setting['currency_input_2'][0] == 'from') {
                        this._addToSetting(vl[kys[0]], vl[kys[1]]);
                    } else {
                        this._addToSetting(vl[kys[1]], vl[kys[0]]);
                    }
                } else if (kys[1].startsWith(this._cuList[0])) {
                    total = calConvert(dmap[event.target.id], vl[kys[1]]);
                    setVal(mmap[event.target.id], total);
                    if (this._setting['currency_input_2'][0] == 'from') {
                        this._addToSetting(vl[kys[1]], vl[kys[0]]);
                    } else {
                        this._addToSetting(vl[kys[0]], vl[kys[1]]);
                    }
                }
            }
        }]);
    
        return Compute;
    }();
    
    var gtCurrencyObjs = function gtCurrencyObjs() {
        return [document.getElementById('currency_input_1'), document.getElementById('currency_input_2')];
    };
    
    var gtSelectObjs = function gtSelectObjs() {
        return [document.getElementById('from_currency_select_id'), document.getElementById('to_currency_select_id')];
    };
    
    var resetToMsgInnerHtml = function resetToMsgInnerHtml() {
        if (document.getElementById('tomsg').innerHTML) {
            document.getElementById('tomsg').innerHTML = '';
        }
    };
    
    var setErrorMsg = function setErrorMsg(id) {
        document.getElementById(id).innerHTML = '<h3 class="net-warning" >Network is down and you have not converted before with these currencies</h3>';
    };
    
    var setVal = function setVal(id, val) {
        return document.getElementById(id).value = val;
    };
    
    var calConvert = function calConvert(id, val) {
        var total = Number(val) * document.getElementById(id).value;
        return Math.round(total * 100) / 100;
    };
    
    var selectHMTL = function selectHMTL(opts, id) {
        return '<select id=' + id + ' class="cu_kv Nlt" oninput="Mpick(event)" aria-label="Currency Type">' + opts + '</select>';
    };
    
    window.MUpdat = function (event) {
        var from = void 0,
            to = void 0;
        if (event.target.id == 'currency_input_1') {
            var _gtCurrencyObjs = gtCurrencyObjs();
    
            var _gtCurrencyObjs2 = _slicedToArray(_gtCurrencyObjs, 2);
    
            from = _gtCurrencyObjs2[0];
            to = _gtCurrencyObjs2[1];
        } else if (event.target.id == 'currency_input_2') {
            var _gtCurrencyObjs3 = gtCurrencyObjs();
    
            var _gtCurrencyObjs4 = _slicedToArray(_gtCurrencyObjs3, 2);
    
            to = _gtCurrencyObjs4[0];
            from = _gtCurrencyObjs4[1];
        }
        //trigger computation with all
        mcompute.checkAndCompute(event, from, to);
    };
    
    window.Mpick = function (event) {
        return mcompute.processInput(event);
    };
    
    window.onload = async function () {
        mcompute = new Compute();
        mcompute.loadAfterHTML();
    };
    
    },{"./IndexController":2}]},{},[3]);
    