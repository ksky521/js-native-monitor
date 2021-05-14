const fs = require('fs');
// const jsNative = require.resolve('js-native');
const jsNative = require.resolve('@baidu/boxx');
module.exports = (router) => {
    router.get('/js-native.js', (ctx) => {
        ctx.res.setHeader('Access-Control-Allow-Origin', '*');
        ctx.res.setHeader('content-type', 'application/javascript');
        ctx.body = fs.createReadStream(jsNative);
    });
};
