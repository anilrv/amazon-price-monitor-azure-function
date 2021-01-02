module.exports = async function (context, mailOrders) {
    const msg = mailOrders;
    context.log('JavaScript queue trigger function processed order', msg.pdtName);

    context.bindings.message = {
        subject: msg.sub,
        content: [{
            type: 'text/html',
            value: '<h3>Price dropped for <br/>' + msg.pdtName + '<br/>by Rs ' + msg.pChange + '</h3><br/><a href=' + msg.url + '>Go to Amazon</a>'
        }]
    };
}