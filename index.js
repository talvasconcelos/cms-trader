const WebSocket = require('ws')
const Sockette = require('sockette')
const api = require('binance')
const Utils = require('./utils')
const config = require('./config')
const Trader = require(`./strategies/${config.strategy}`)
const args = process.argv.slice(2)

const slimbot = Utils.telegram(config.telegramAPI)
let telegramInt

let CACHE

const cmsWS = new Sockette('wss://market-scanner.herokuapp.com', {
  timeout: 5e3,
  maxAttempts: 10,
  onopen: e => console.log('Connected!', e),
  onmessage: msg => {
    const data = JSON.parse(msg)
    CACHE = data
    return startTrader(data)
  },
  onreconnect: e => console.log('Reconnecting...', e),
  onmaximum: e => console.log('Stop Attempting!', e),
  onclose: e => console.log('Closed!', e),
  onerror: e => console.log('Error:', e)
})
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

args.length && bot.start_trading({pair: args[0], time: 60000})

// cmsWS.on('open', () => {console.log(`Connected to CMS`)})
// cmsWS.on('close', () => {console.log(`Lost connection!!`)})

// cmsWS.on('message', (msg) => {
//     const data = JSON.parse(msg)
//     CACHE = data
//     return startTrader(data)
// })

const startTrader = (data) => {
  const regex = RegExp(/(BTC)$/g)
  // const regex = RegExp('\\/(' + config.currency.toUpperCase() +')\\$\\/', 'g')
  if (data.hasOwnProperty('to') && data.to == 'trader'){
    // console.log(data)
    if(bot && bot.is_trading){
      console.log(`Bot is trading!`)
      return
    }
    const pair = data.data.sort((a, b) => {
        return b.prob - a.prob
    }).filter(p => (regex).test(p.pair))
    // console.log(pair)
    if(pair.length === 0) {
      console.log(new Date())
      console.log('No pairs to trade!')
      return
    }
    // if(pair[0].pair === 'BNBBTC'){
    //   pair.shift()
    // }
    console.log(pair)
    let now = Date.now()
    let diff = new Date(now - data.timestamp).getMinutes()
    if(pair[0].pair && diff < 15){
      bot.start_trading({pair: pair[0].pair, time: 60000}).catch(console.error)
    } else {
      console.log(`Signal is outdated! Sent ${diff} minutes ago!`)
    }
  }
  return
}

bot.on('traderStart', () => {
  let msg = `Buying ${bot._asset}.`
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
})

bot.on('tradeInfo', () => {
  let msg = `*${bot.product}*
  *Last Price:* ${bot.last_price}
  *Buy Price:* ${bot.buyPrice}
  *Sell Price:* ${bot.sellPrice}
  *Stop Loss:* ${bot.stopLoss}
  *Target Price:* ${bot.targetPrice}`
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
})

bot.on('tradeInfoStop', () => {
  let msg = `${bot._asset} trade ended!`
  slimbot.sendMessage(config.telegramUserID, msg, {parse_mode: 'Markdown'}).catch(console.error)
  return startTrader(CACHE)
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