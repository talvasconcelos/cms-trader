const WebSocket = require('ws')
const api = require('binance')
const Utils = require('./utils')
const config = require('./config')
const Trader = require(`./strategies/${config.strategy}`)

const slimbot = Utils.telegram(config.telegramAPI)

const cmsWS = new WebSocket('wss://market-scanner.herokuapp.com')
const client = new api.BinanceRest({
    key: config.API_KEY, // Get this from your account on binance.com
    secret: config.API_SECRET, // Same for this
    timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
    recvWindow: 20000, // Optional, defaults to 5000, increase if you're getting timestamp errors
    disableBeautification: false,
    handleDrift: true
  })

const websocket = new api.BinanceWS()

const bot = new Trader({
  client,
  base: config.currency,
  websocket
})

slimbot.sendMessage(config.telegramUserID, `Trader Started!`, {parse_mode: 'Markdown'}).catch(console.error)

cmsWS.on('open', () => {console.log(`Connected to CMS`)})
cmsWS.on('close', () => {console.log(`Lost connection!!`)})

cmsWS.on('message', (msg) => {
    const data = JSON.parse(msg)
    const regex = new RegExp(/(BTC)$/g)
    if (data.hasOwnProperty('to') && data.to == 'trader'){
      if(bot && bot.is_trading){
        console.log(`Bot is trading!`)
        return
      }
      const pair = data.data.sort((a, b) => {
          return b.prob - a.prob
      }).filter(p => (regex).test(p.pair))
      console.log(pair)
      if(pair.length === 0) {
        console.log(new Date())
        console.log('No pairs to trade!')
        return
      }
      if(pair[0].pair === 'BNBBTC'){
        pair.shift()
      }
      // console.log(pair, data.timestamp)
      let now = Date.now()
      let diff = new Date(now - data.timestamp).getMinutes()
      if(pair[0].pair && diff < 15){          
        return bot.start_trading({pair: pair[0].pair, time: 30000})
      }
    }
    return
})

bot.on('traderStart', () => {
  if(bot.buyPrice){
    const telegramInt = setInterval(() => {
      let msg = `*${bot.product}*
      *Last Price:* ${bot.last_price}
      *Buy Price:* ${bot.buyPrice}
      *Sell Price:* ${bot.sellPrice.toFixed(8)}
      *Stop Loss:* ${bot.stopLoss.toFixed(8)}
      *Target Price:* ${bot.targetPrice.toFixed(8)}`
      slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
    }, 1800000)
    telegramInt()
  }
})

bot.on('traderStop', (msg) => {
  clearInterval(telegramInt)
})

bot.on('traderCheckOrder', (msg) => {
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
})

bot.on('traderPersistenceTrigger', (persistence) => {
  let msg = `Sell price triggered, persistence activated: ${this.persistence}!`
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
})
bot.on('traderSelling', (price) => {
  let msg = `Trying to sell ${bot._asset} for ${price}!`
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
})


/*
{ symbol: 'STORJETH',
  status: 'TRADING',
  baseAsset: 'STORJ',
  baseAssetPrecision: 8,
  quoteAsset: 'ETH',
  quotePrecision: 8,
  orderTypes: 
   [ 'LIMIT',
     'LIMIT_MAKER',
     'MARKET',
     'STOP_LOSS_LIMIT',
     'TAKE_PROFIT_LIMIT' ],
  icebergAllowed: true,
  isSpotTradingAllowed: true,
  isMarginTradingAllowed: false,
  filters: 
   [ { filterType: 'PRICE_FILTER',
       minPrice: '0.00000000',
       maxPrice: '0.00000000',
       tickSize: '0.00000010' },
     { filterType: 'PERCENT_PRICE',
       multiplierUp: '10',
       multiplierDown: '0.1',
       avgPriceMins: 5 },
     { filterType: 'LOT_SIZE',
       minQty: '1.00000000',
       maxQty: '90000000.00000000',
       stepSize: '1.00000000' },
     { filterType: 'MIN_NOTIONAL',
       minNotional: '0.01000000',
       applyToMarket: true,
       avgPriceMins: 5 },
     { filterType: 'ICEBERG_PARTS', limit: 10 },
     { filterType: 'MAX_NUM_ALGO_ORDERS', maxNumAlgoOrders: 5 } ] }
     */