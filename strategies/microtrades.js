'use strict'
const Utils = require('../utils')
const Trader = require('../trader')


class Bot extends Trader {
  constructor(options){
    super(options)
    this.TP = 1.2
    this._TP_p = 1.03
    this._SL_p = 1.025
    this._TRAIL_p = 1.005
    this.targetPrice = null
    this.stopLoss = null
    this.persistence = 0
    this.startTime = Date.now()
    // this.updatedPrice = this.buyPrice * this._TP_p
  }

  forcePriceUpdate(interval){
    setInterval(() => {
      this.listen_to_messages()
    }, interval)
  }

  _execute_trading_strategy() {
    let now = Date.now()
    let diff = new Date(now - this.startTime).getHours()
    if(diff > 24){return this.sellMarket()}
    this.forcePriceUpdate(3600000)
    if(!this.last_price){
      this.listen_to_messages()
    }

    if(this._retry > 3){
      return this.stop_trading()
    }

    // if(this._is_buying || this._is_selling){
    //   this._retry++
    //   return this.chekOrder()
    // }

    if(this._busy_executing){
      this._retry++
      return this.chekOrder()
    }


    if(this._is_selling || this._is_buying){
      this._retry++
      this.chekOrder().then(res => {
        let now = Date.now()
        let diff = now - this._myorders.data.transactTime

        if(diff > 300000 && !this._busy_executing){
          this.log('Order up for: ', Utils.milliToMin(diff))
          return this.cancelOrder(this.order_id)
        }

        this.log(`(${this._is_selling ? 'Sell' : 'Buy'}) Diff: ${Utils.milliToMin(diff)}`)
      })
    }

    //console.log(this.buyPrice, this.sellPrice, this.last_price)
    if(this.is_trading){
      if(!this._initial_prices){
        this.targetPrice = this.buyPrice * this._TP_p
        this.stopLoss = this.buyPrice / this._SL_p
        this.sellPrice = this.stopLoss
        this._initial_prices = true
        return
      }
      this.log(`\nPair: ${this._asset} ${new Date().toTimeString()}\nLast Price: ${this.last_price}\nBuy Price: ${this.buyPrice}\nSell Price: ${this.sellPrice.toFixed(8)}\nStop Loss: ${this.stopLoss.toFixed(8)}\nTarget Price: ${this.targetPrice.toFixed(8)}\n`)
      // log(`Last Price: ${this.last_price}`.cyan)
      // log(`Buy Price: ${this.buyPrice}`.red)
      // log(`Sell Price: ${this.sellPrice.toFixed(8)}`.green)
      // log(`Stop Loss: ${this.stopLoss.toFixed(8)}`.red)
      // log(`Target Price: ${this.targetPrice.toFixed(8)}`.green)
      if(!this._is_selling){
        if(this.last_price > this.buyPrice * this.TP){
          this.log('Top target achieved. Selling!')
          return this.sellMarket()
        }
        if(this.last_price > this.targetPrice){
          this.sellPrice = this.targetPrice / this._TRAIL_p
          this.targetPrice *= this._TP_p
          this.log('Sell price updated:', this.sellPrice)
          return
        }
        if(this.last_price <= this.stopLoss){
          this.log('Stop Loss trigered. Selling!')
          return this.sellMarket()
        }
        if(this.last_price <= this.sellPrice){
          if(this.persistence <= 3) {
            this.log(`Sell price triggered, persistence activated: ${this.persistence}`)
            this.emit('traderPersistenceTrigger', this.persistence)
            return this.persistence++
          }
          this.log('Selling!')
          this.persistence = 0
          this.emit('traderSelling', this.sellPrice)
          return this.sellMarket()
        }
        this.persistence > 0 ? this.persistence = 0 : null
      }
    }
    return
  }
}

module.exports = Bot