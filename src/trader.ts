const EventEmitter = require('events')

class Trader extends EventEmitter{
    constructor(options: {}){
        super()
        options = options || {}
        this.isTrading = false
        this.isBuying = false
        this.isSelling = false
        this.product = null
    }

    sayHi = () => {
        const time = new Date()
        console.log('Hi', time.getHours(), time.getUTCMinutes(), time.getSeconds())
    }

    startTrading = (opts) => {
        this.product = opts.pair
    }

    executeTradingStrategy = () => {
        return Promise.resolve()
    }
}

export default Trader