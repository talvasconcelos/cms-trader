declare const EventEmitter: any;
declare class Trader extends EventEmitter {
    constructor(options: {});
    sayHi: () => void;
    startTrading: (opts: any) => void;
    executeTradingStrategy: () => Promise<void>;
}
export default Trader;
