'use strict'

const https = require('https');

const productsToMonitor = [
    {
        url: 'https://www.amazon.in/Microsoft-Office-365-people-Windows/dp/B00UP4GPQO',
        tP: 4300
    },
    {
        url: 'https://www.amazon.in/Karcher-WD-Multi-Purpose-Vacuum-Cleaner/dp/B00JBNZPFM',
        tp: 5200
    },
    {
        url: 'https://www.amazon.in/Raspberry-Pi-3B-plus-Motherboard/dp/B07BDR5PDW',
        tp: 2700
    }
];

const ObjTableData = function (pk, pdtName, price) {
    this.PartitionKey = pk;
    this.RowKey = Date.now().toString();
    this.Price = price;
    this.ProductName = pdtName;
};

const ObjPrice = function (tblData, pChange, url) {
    this.TblData = tblData;
    this.PriceChangeWrtTarget = pChange;
    this.Url = url;
};


function getHtmlPage(pdt) {
    return new Promise(function (resolve, reject) {
        https.get(pdt.url, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                resolve({ data, pdt });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function getCurrentPrice(result) {
    return new Promise((res, rej) => {
        try {
            const pk = result.pdt.url.split('/').pop();
            let pName = result.data.split('<title>')[1].split('</title>')[0].split(':')[0];
            let price = parseFloat(result.data.split('d="priceblock_ourprice"')[1].split('</span>')[0].split('>₹ ')[1].replace(/,/g, ''));
            res(
                new ObjPrice(
                    new ObjTableData(pk, pName, price),
                    price - result.pdt.tP,
                    result.pdt.url)
            );
        } catch (err) {
            rej(err);
        }
    });
}

function processData(ctx, res, savedData, dat) {
    const prevEntry = savedData.filter((d) => { return d.PartitionKey === dat.TblData.PartitionKey; });
    // Save dtata to Tabe Storage if new
    if (prevEntry.length === 0 || prevEntry.length > 0 && prevEntry[0].Price != dat.TblData.Price) {
        ctx.bindings.outputTable.push(dat.TblData);
    }
    // Save email data to Queue Storage if price reached target price
    if (dat.PriceChangeWrtTarget <= 0) {
        ctx.bindings.outputQueue.push({
            sub: 'Price dropped by ' + Math.round(100 * (Math.abs(dat.PriceChangeWrtTarget) / dat.TblData.Price)) + '%',
            pdtName: dat.TblData.ProductName.replace(/|/g, ''),
            pChange: dat.PriceChangeWrtTarget,
            url: dat.Url
        });
    }
    ctx.log(dat.TblData.ProductName + ' - OK');
    res('Done');
}

async function startPriceCheck(ctx) {
    let count = productsToMonitor.length - 1;
    ctx.bindings.outputTable = [];
    ctx.bindings.outputQueue = [];
    const savedData = ctx.bindings.inputTable;
    while (count >= 0) {
        await new Promise((res, rej) => {
            getHtmlPage(productsToMonitor[count])
                .then(getCurrentPrice)
                .then(processData.bind(null, ctx, res, savedData))
                .catch((err) => {
                    ctx.error(err);
                    rej(err);
                });
        });
        count -= 1;
    };
    ctx.done();
}

module.exports.startPriceCheck = startPriceCheck;
