const Trader = require('./trader')
const WebSocket = require('ws')
const api = require('binance')
const config = require('config')

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
if(config.telegram){
  const Slimbot = require('slimbot');
  const slimbot = new Slimbot(config.telegramAPI)
  slimbot.startPolling()
}

const trader = new Trader()


cmsWS.on('open', () => {console.log(`Connected to CMS`)})
cmsWS.on('close', () => {console.log(`Lost connection!!`)})

cmsWS.on('message', (msg) => {
    if(trader.is_trading){
      console.log(`Bot is trading!`)
      return
    }
    const data = JSON.parse(msg)
    if (data.hasOwnProperty('to') && data.to == 'trader'){
        const pair = data.data.sort((a, b) => {
            return b.prob - a.prob
        }).filter(p => (/(BTC)$/g).test(p.pair))
        // console.log(pair, data.timestamp)
        let now = Date.now()
        let diff = new Date(now - data.timestamp).getMinutes()
        if(pair[0].pair && diff < 6){
            trader.start_trading({
                pair: pair[0].pair
            })
        }
    }
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