"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var EventEmitter = require('events');
var Trader = /** @class */ (function (_super) {
    __extends(Trader, _super);
    function Trader(options) {
        var _this = _super.call(this) || this;
        _this.sayHi = function () {
            var time = new Date();
            console.log('Hi', time.getHours(), time.getUTCMinutes(), time.getSeconds());
        };
        _this.startTrading = function (opts) {
            _this.product = opts.pair;
        };
        _this.executeTradingStrategy = function () {
            return Promise.resolve();
        };
        options = options || {};
        _this.isTrading = false;
        _this.isBuying = false;
        _this.isSelling = false;
        _this.product = null;
        return _this;
    }
    return Trader;
}(EventEmitter));
exports.default = Trader;
//# sourceMappingURL=trader.js.map