const EventEmitter = require('events')

const continuous = require('continuous')
const Utils = require('./utils')

class Trader extends EventEmitter{
    constructor(opts) {
        super(opts)
        this._test = true
        this._busy_executing = false
        this._is_buying = false
        this._is_selling = false
        this._is_trading = false
        this._retry = 0
        opts = opts || {}
        this.log = opts.log || console.log
        this.client = opts.client || null
        this._base = opts.base || 'BTC'
        this._websocket = opts.websocket || null
        this._timer = null
        this.product = null
        this.buyPrice = false
        this.sellPrice = false
        this.init_state()
    }

    get order_id() {
        return this._order_id
    }

    get ticker() {
        return this._ticker
    }

    get my_orders() {
        return this._myorders
    }

    get trade_balance() {
        return this._tradebalance
    }

    get base_balance() {
        return this._tradebalance.base
    }

    get asset_balance() {
        return this._tradebalance.asset
    }

    get last_price() {
        return this._last_price
    }

    get is_trading() {
        return this._is_trading
    }

    // get bought_price() {
    //   return new Promise(resolve => {
    //     this.client.myTrades({
    //       symbol: this.product,
    //       timestamp: new Date().getTime()
    //     }).then(res => {
    //
    //     })
    //   })
    // }

    get midmarket_price() {
        let book = this.ticker.data
        let bid = book.bidPrice
        let ask = book.askPrice
        if (bid && ask) {
            return (0.5 * (+bid + +ask)).toFixed(8)
        }
        else {
            return null
        }
    }

    async init_market() {
        let market = await this.client.exchangeInfo().then(res => {
            return res.symbols.find(m => m.symbol === this.product.toUpperCase())
        })
        this._asset = market.baseAsset
        this._minQty = market.filters[2].minQty
        this._tickSize = market.filters[0].tickSize
        this._minOrder = market.filters[3].minNotional
        return Promise.resolve()
    }

    init_state() {
        this._ticker = { updated: null, data: null, errors: [] }
        this._myorders = { updated: null, data: null, errors: [] }
        this._tradebalance = { updated: null, base: null, asset: null, errors: [] }
    }

    stateReset() {
        this._busy_executing = false
        this._is_buying = false
        this._is_selling = false
        this._is_trading = false
        this._retry = 0
        this.product = null
        this.buyPrice = false
        this.sellPrice = false
        this.targetPrice = null
        this._last_price = null
        this.stopLoss = null
        this.persistence = 0
        this._initial_prices = false
        this._timer = null
        this.product = null
    }

    telegramInfoStart(options) {
        options = options || {}
        let time = options.time || 1.8e+6
        this._telegramInfo = setInterval(() => {
            this.emit('tradeInfo')
        }, time)
    }

    telegramInfoStop() {
        clearInterval(this._telegramInfo)
        this.emit('tradeInfoStop')
    }

    /**
     * Starts trading with the bot.
     * @param options
     * @param options.limit: {Number} - optional, default: -1(forever)
     * @param options.time: {Number} - milliseconds between runs (non-random only), default: 1000
     * @param options.minTime: {Number} - min allowed milliseconds between runs (random only), default: 0
     * @param options.maxTime: {Number} - max allowed milliseconds between runs (random only), default: 1000
     * @param options.random: {Boolean} - whether or not it should run randomly between minTime and maxTime, default: false
     * @returns {Promise}
     */
    start_trading(options) {
        let self = this
        options = options || {}
        this.product = options.pair
        options.callback = this._execute_trading_strategy.bind(this)
        return new Promise(resolve => {
            if (self.is_trading) {
                return resolve(false)
            }
            let timer = new continuous(options)
            timer.on('stopped', () => {
                this._is_trading = false
            })
            this._timer = timer
            timer.on('started', async () => {
                this._is_trading = true
                this.listen_to_messages()
            })
            this.init_market()
                .then(async () => {
                    await self.fetch_balances()
                    await self.fetch_ticker()
                    return await self.buy()
                })
                .then((res) => {
                    if (res !== false) {
                        console.log('Started trading!')
                        timer.start()
                        this.emit('traderStart')
                        this.telegramInfoStart()
                        return resolve(true)
                    } else {
                        this.stop_trading()
                        return resolve(false)
                    }
                })
                .catch(err => {
                    console.log(err)
                    return resolve(false)
                })
        })
    }

    /**
     * Stop the trading bot
     * @param options
     * @param options.cancel {boolean} if true, calls #cancel_all_orders before stopping
     * @returns {Promise}
     */
    stop_trading(options) {
        if (!this.is_trading) {
            return Promise.resolve()
        }
        options = options || { cancel: false }
        const self = this
        let cancel = options.cancel ? self.cancel_order() : Promise.resolve()
        return cancel.then(() => {
            this._timer.stop()
            this.stateReset()
            console.log('Trader stopped!')
            this.telegramInfoStop()
            return Promise.resolve()
        })
    }

    /**
     * Sub-classes override this method to enact their trading strategy
     * @private
     * @returns {Promise}
     */
    _execute_trading_strategy() {
        return Promise.resolve()
    }

    addOrder(options) {
        let self = this
        console.log('Trying to', options.side.toLowerCase() + ':', options.quantity, this._asset, 'at', options.price)
        const order = {
            symbol: self.product || self.asset + self.base,
            side: options.side,
            type: options.type || 'LIMIT',
            price: options.price,
            timeInForce: options.timeInForce || 'FOK',
            quantity: options.quantity,
            // newClientOrderId: this.clientOrderId,
            timestamp: new Date().getTime()
        }
        if(options.type === 'MARKET'){
            delete order.price
            delete order.timeInForce
        }
        this.client.newOrder(order)
            .then(data => {
                //console.log(data)
                data.side === 'BUY' ? self._is_buying = true : self._is_selling = true
                self._myorders.updated = new Date()
                self._myorders.data = data
                self._order_id = data.orderId
                return true
            })
            .catch(err => {
                self._myorders.errors.push({
                    timestamp: new Date(),
                    error: err
                })
                console.error(err)
                return false
            })
    }

    async chekOrder() {
        let self = this
        this.client.queryOrder({
            symbol: self.product,
            orderId: self._order_id
        })
            .then(data => {
                let filled = data.status === 'FILLED'
                let stillThere = data.status === 'NEW' || data.status === 'PARTIALLY_FILLED'
                let canceledManually = data.status === 'CANCELED' || data.status === 'REJECTED' || data.status === 'EXPIRED'

                if (data.side === 'SELL') {
                    if (!stillThere && !canceledManually) {
                        self._is_selling = false
                        self._busy_executing = false
                        self._myorders.updated = new Date()
                        self._myorders.data = data
                        return self.stop_trading()
                    }

                    if (canceledManually) {
                        self._is_selling = false
                        this._busy_executing = false
                        return self.sell()
                    }
                }

                if (data.side === 'BUY') {
                    // if(filled) {
                    //     this._tradebalance.asset = +data.executedQty
                    //     this._busy_executing = false
                    //     self._is_buying = false
                    //     return
                    // }
                    if (stillThere) {
                        this._busy_executing = true
                        this._retry = 0
                        return
                    }
                    if (!stillThere && !canceledManually) {
                        self._myorders.updated = new Date()
                        self._myorders.data = data
                        self._is_buying = false
                        this._busy_executing = false
                        self.buyPrice = self._myorders.data.price
                        self.fetch_balances()
                        //self.start_trading()
                    }

                    if (canceledManually) {
                        self._is_buying = false
                        return this.stop_trading()
                    }
                }
                let msg = `${data.side}: ${this.product}
                Status: ${data.status}
                OrderID: ${self._order_id}
                Price: ${data.price}
                Qty: ${data.executedQty}/${data.origQty}
                buying: ${self._is_buying}
                selling: ${self._is_selling}
                busy: ${self._busy_executing}`

                this.emit('traderCheckOrder', msg)
                console.log(msg)
                //console.log(data)
                return data
            })
            .catch(err => {
                self._myorders.errors.push({
                    timestamp: new Date(),
                    error: err
                })
                console.error(err)
                return false
            })
    }

    cancelOrder(orderId) {
        let self = this
        this.client.cancelOrder({
            symbol: self.product,
            orderId: orderId
        })
            .then(data => {
                console.log('Order canceled!', data)
                self._myorders.updated = new Date()
                self._myorders.data = data
                self._is_buying ? self._is_buying = false : self._is_selling = false
                return data
            })
            .catch(err => {
                self._myorders.errors.push({
                    timestamp: new Date(),
                    error: err
                })
                console.error(err)
                return false
            })
    }

    buy(opts) {
        opts = opts || {}
        if (!this.product) {
            console.error('No pair specified!')
            return false
        }
        if (this._retry > 3) {
            this.fetch_ticker()
        }
        if(this.base_balance < this._minOrder){
            console.log('Insuficient funds!')
            return false
        }
        let price = Utils.roundToNearest(this._retry > 3 ? this.ticker.data.askPrice : this.last_price, this._tickSize)
        let qty = Utils.roundToNearest((this.base_balance / price), this._minQty)
        // let qty = Utils.roundToNearest((0.002 / price), this._minQty)
        if (price * qty < this._minOrder) {
            console.error('Minimum order must be', this._minOrder + '.')
            return false
        }
        if(price < 0.00000099){
            console.log('Price too low!')
            return false
        }

        const order = {
            side: 'BUY',
            quantity: qty,
            price: price.toFixed(8)
        }
        if(opts.market){order.type = 'MARKET'}
        return this.addOrder(order)
    }

    sell() {
        let price = Utils.roundToNearest((this.last_price), this._tickSize)
        let qty = Utils.roundToNearest(this.asset_balance, this._minQty)
        return this.addOrder({
            side: 'SELL',
            quantity: qty,
            price: price.toFixed(8),
            timeInForce: 'GTC'
        })
    }

    sellMarket() {
        let qty = Utils.roundToNearest(this.asset_balance, this._minQty)
        return this.addOrder({
            side: 'SELL',
            quantity: qty,
            type: 'MARKET',
            timeInForce: 'GTC'
        })
    }

    fetch_balances() {
        console.log('starting fetch_balances')
        let self = this
        if (!this.product) {
            this.product = this.asset + this.base
        }
        return new Promise((resolve, reject) => {
            self.client.account()
                .then(data => {
                    if (self.product)
                        self._tradebalance.base = data.balances.find(b => b.asset === self._base).free
                        self._tradebalance.asset = Math.min(this._tradebalance.asset, data.balances.find(b => b.asset === self._asset).free)
                    resolve(data)
                })
                .catch(err => console.error(err))
        })
    }

    fetch_ticker() {
        let self = this
        return new Promise(resolve => {
            self.client.ticker24hr(self.product, (err, data) => {
                if (err) {
                    self._ticker.errors.push({
                        timestamp: new Date(),
                        error: err
                    })
                    return resolve(null)
                }
                self._ticker.updated = new Date()
                self._ticker.data = data
                self._last_price = data.lastPrice
                resolve(data)
            })
        })
    }

    listen_to_messages() {
        let feed = this._websocket
        if (!feed) return
        if (this.product) {
            feed.onAggTrade(this.product, msg => {
                this._stats = {
                    updated: new Date(),
                    last_msg: msg
                }
                this._last_price = msg.price
            })
        }
    }
}

module.exports = Trader