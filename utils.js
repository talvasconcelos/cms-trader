const fs = require('fs')
const Slimbot = require('slimbot')

let _config = false

const utils = {
  getConfig: () => {
    if(_config){
      return _config
    }
    if(!fs.existsSync(utils.dirs().config)){
      console.log('Cannot find config file')
      return
    }
    _config = require('../config')
    return _config
  },  

  roundToNearest: (numToRound, numToRoundTo) => {
    numToRoundTo = 1 / (numToRoundTo)
    let nearest = Math.floor(numToRound * numToRoundTo) / numToRoundTo
    return Math.round(nearest * 100000000) / 100000000
  },

  getOrderMinSize: (currency) => {
    if (currency === 'BTC') return 0.001
    else if (currency === 'ETH') return 0.01
    else return 1
  },

  normalize: (val, min, max, round) => {
    let normalized = (val - min) / (max - min)
    return !round ? normalized : Math.round(normalized * round) / round
  },

  milliToMin: (time) => {
    let minutes = Math.floor(time / 60000)
    let seconds = ((time % 60000) / 1000).toFixed(0)
    return (seconds == 60 ? (minutes+1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds)
  },

  delayedStart: (interval, serverTime) => {
    let startTime = new Date(serverTime)
    let minutes = Math.ceil(startTime.getMinutes() / interval) * interval
    startTime.setMinutes(minutes)
    startTime.setSeconds(0)
    let startInMilli = startTime.getTime() - serverTime
    return startInMilli
  },

  telegram: (apikey) => {
    const slimbot = new Slimbot(apikey)
    slimbot.startPolling()
    return slimbot
  }
}


module.exports = utils
