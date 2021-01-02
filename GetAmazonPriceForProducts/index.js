const PriceChecker = require('./PriceChecker');
module.exports = async function (context) {
    await PriceChecker.startPriceCheck(context);
};