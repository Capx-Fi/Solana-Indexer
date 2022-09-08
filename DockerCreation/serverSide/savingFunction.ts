// FUNCTION TO SAVE AN ENTITY TO DATABASE

const AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});




export async function saver(entityName : string,item : object) {
    console.log(process.env.PROJECT_ID)
    let temp = {}
    console.log(item);
    
    for (let key in item) {
        if (typeof item[key] === 'undefined') {
        }else if (typeof item[key] === 'number' ) {
            temp[key] = {"N":item[key].toString()}
        } else if (typeof item[key] === 'object') {
            temp[key] = item[key]
        } else if (typeof item[key] === 'boolean') {
            temp[key] = {"BOOL":item[key]}
        } else {
            console.log(typeof item[key]);
            temp[key] = {"S":item[key]}
        }
    }

    console.log(temp);
    
    let params = {
        "TableName": process.env.PROJECT_ID + "_" + entityName,
        "Item": temp
    }

    console.log(params);
    

    await ddb.putItem(params).promise();
}