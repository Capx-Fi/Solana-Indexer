const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});

const ddb = new AWS.DynamoDB({apiVersion:'2012-08-10'});

module.exports = async(slot) => {
    let queryParams = {
        TableName: 'devnet-blocks',
        Key: {
            'slot':{ N: slot.toString() }
        },
    };
    // Call DynamoDB to read the item from the table
    try {
        let response = await ddb.getItem(queryParams).promise();
        if (Object.keys(response).length > 0){
            return {
                status: true,
                data: response.Item
            }
        }
        return {
            status: false,
            data: {}
        }
    } catch (err){
        return {
            status: false,
            data: {}
        }
    }
}