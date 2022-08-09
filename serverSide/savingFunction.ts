// FUNCTION TO SAVE AN ENTITY TO DATABASE

const AWS = require('aws-sdk');
AWS.config.update({region: 'US-EAST-1'});
var ddb = new AWS.DynamoDB();



export async function saver(entityName : string,item : object) {
    let temp = {}
    for (let key in item) {
        if (typeof item[key] === 'number') {
            temp[key] = {"N":item[key].toString()}
        } else if (typeof item[key] === 'boolean') {
            temp[key] = {"BOOL":item[key]}
        } else {
            temp[key] = {"S":item[key]}
        }
    }
    let params = {
        "TableName": process.env.PROJECT_ID + "_" + entityName,
        "Item": temp
    }

    await ddb.putItem(params).promise();
}