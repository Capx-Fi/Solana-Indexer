const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});

const ddb = new AWS.DynamoDB({apiVersion:'2012-08-10'});

module.exports = async(slot) => {
    let params = {
        "TableName": "devnet-blocks",
        "Item" : {
            "slot" : {"N":slot?.slot?.toString()},
            "blockHash" : {"S":slot?.blockHash},
            "blockHeight" : {"N":slot?.blockHeight?.toString()},
            "blockLogs" : {"L":slot?.blockLogs?.map(function(log) {return {"S" : log?.toString()}} )},
            "blockTime" : {"N":slot?.blockTime?.toString()},
            "parentSlot" : {"N":slot?.parentSlot?.toString()},
            "transactions" : {"L":slot?.transactions?.map(function(tx) {return {"S" : tx?.toString()}} )}
        }
    }
    try {
        await ddb.putItem(params).promise();
        console.log("Slot",slot?.slot?.toString(),"- Insert:",true);
    } catch (err){
        return {
            status: false
        }
    }
}